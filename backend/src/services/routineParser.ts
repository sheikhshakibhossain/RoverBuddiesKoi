import xlsx from "xlsx"
import { DayOfWeek } from "@prisma/client"

export interface ParsedClassSlot {
  day: DayOfWeek
  startTime: string // "HH:mm" 24-hour
  endTime: string   // "HH:mm" 24-hour
  course: string
  room?: string
}

// Maps common day name variants to the DayOfWeek enum
const DAYS_MAP: Record<string, DayOfWeek> = {
  sun: "Sun", sunday: "Sun",
  mon: "Mon", monday: "Mon",
  tue: "Tue", tuesday: "Tue",
  wed: "Wed", wednesday: "Wed",
  thu: "Thu", thursday: "Thu",
  fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
}

/**
 * Converts an Excel serial date/time decimal to "HH:mm" string.
 * Excel stores times as fractions of a day (e.g. 0.375 = 09:00).
 */
function excelSerialToHHmm(serial: number): string {
  const totalMinutes = Math.round(serial * 24 * 60)
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/**
 * Converts a 12-hour time string like "9:00 AM" or "1:30 PM" to "HH:mm" 24-hour.
 */
function parse12HourTo24(timeStr: string): string | null {
  const clean = timeStr.trim()

  // Match "9:00 AM", "09:00AM", "1:30 PM", etc.
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null

  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()

  if (meridiem === "AM") {
    if (h === 12) h = 0
  } else {
    if (h !== 12) h += 12
  }

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/**
 * Parse any time value from a cell — handles:
 *  - Excel time serial (number)
 *  - "9:00 AM" / "1:30 PM" strings
 *  - "09:00" / "13:30" 24-hour strings
 *  - "9:00-10:30" combined range (returns just start)
 */
function parseTime(raw: any): string | null {
  if (raw === null || raw === undefined || raw === "") return null

  // Excel stores time as a fraction of a day
  if (typeof raw === "number") {
    return excelSerialToHHmm(raw)
  }

  const str = String(raw).trim()

  // 12-hour format with AM/PM
  const ampm = parse12HourTo24(str)
  if (ampm) return ampm

  // 24-hour format HH:mm
  const hhmm = str.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const h = parseInt(hhmm[1], 10)
    const m = parseInt(hhmm[2], 10)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
  }

  return null
}

/**
 * Finds the header row index and returns a mapping of
 * column name (lowercase) -> column index.
 */
function findHeaderMapping(rows: any[][]): { rowIdx: number; map: Record<string, number> } | null {
  const COL_ALIASES: Record<string, string[]> = {
    day:       ["day", "weekday", "days"],
    startTime: ["start time", "start", "from", "time from", "begin", "class time", "starttime", "start_time"],
    endTime:   ["end time", "end", "to", "time to", "finish", "endtime", "end_time"],
    course:    ["course", "subject", "class", "course name", "course code", "subject name", "coursename", "course title"],
    room:      ["room", "venue", "location", "room no", "classroom", "lab", "room number"],
  }

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue

    const headerMap: Record<string, number> = {}
    let matchCount = 0

    for (let c = 0; c < row.length; c++) {
      const cellStr = String(row[c] || "").trim().toLowerCase()
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        if (aliases.includes(cellStr)) {
          headerMap[field] = c
          matchCount++
          break
        }
      }
    }

    // We need at least day + startTime + course to proceed
    if (matchCount >= 3 && "day" in headerMap && "startTime" in headerMap && "course" in headerMap) {
      return { rowIdx: r, map: headerMap }
    }
  }
  return null
}

export function parseRoutineExcel(buffer: Buffer): ParsedClassSlot[] {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  // raw:true preserves Excel serial numbers instead of formatting them as strings
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })

  const slots: ParsedClassSlot[] = []

  // ── Strategy 1: Standard table with header row ─────────────────────────────
  const header = findHeaderMapping(rows)
  if (header) {
    const { rowIdx, map } = header
    for (let r = rowIdx + 1; r < rows.length; r++) {
      const row = rows[r]
      if (!row || row.length === 0) continue

      const rawDay    = String(row[map.day]       || "").trim().toLowerCase()
      const rawStart  = row[map.startTime]
      const rawEnd    = map.endTime !== undefined ? row[map.endTime] : null
      const rawCourse = String(row[map.course]     || "").trim()
      const rawRoom   = map.room !== undefined ? String(row[map.room] || "").trim() : undefined

      if (!rawDay || !rawCourse || rawCourse.length < 2) continue

      const day = DAYS_MAP[rawDay]
      if (!day) continue

      const startTime = parseTime(rawStart)
      if (!startTime) continue

      const endTime = rawEnd ? parseTime(rawEnd) : null

      slots.push({
        day,
        startTime,
        endTime: endTime || startTime, // fallback: same as start
        course: rawCourse,
        room: rawRoom || undefined,
      })
    }
  }

  // ── Strategy 2: Two-column "Day Time | Course" row-based format ────────────
  // e.g. row: ["Sunday 9:00 AM - 10:30 AM", "CSE 401", "A101"]
  if (slots.length === 0) {
    for (const row of rows) {
      if (!row || row.length < 2) continue
      const first = String(row[0] || "").trim()

      const rangeMatch = first.match(
        /^(\w+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i
      )
      if (!rangeMatch) continue

      const dayKey = rangeMatch[1].toLowerCase()
      const day = DAYS_MAP[dayKey]
      if (!day) continue

      const startTime = parse12HourTo24(rangeMatch[2]) || parseTime(rangeMatch[2])
      const endTime   = parse12HourTo24(rangeMatch[3]) || parseTime(rangeMatch[3])
      const course    = String(row[1] || "").trim()
      const room      = row[2] ? String(row[2]).trim() : undefined

      if (!startTime || !course) continue
      slots.push({ day, startTime, endTime: endTime || startTime, course, room })
    }
  }

  return slots
}
