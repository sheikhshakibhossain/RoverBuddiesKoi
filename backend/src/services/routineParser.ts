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
 * Parses UIU-style time strings like:
 *   "11:11:AM - 01:40:PM"
 *   "08:30:AM - 09:50:AM"
 *   "03:11:PM - 04:30:PM"
 * Also handles standard formats:
 *   "9:00 AM", "1:30 PM", "09:00", "13:30"
 */
function parseTimeRange(raw: string): { startTime: string; endTime: string } | null {
  const str = raw.trim()

  // ── UIU format: "11:11:AM - 01:40:PM" ──────────────────────────────────────
  // Pattern: HH:MM:AM/PM - HH:MM:AM/PM  (colon before AM/PM)
  const uiuRange = str.match(
    /^(\d{1,2}):(\d{2}):(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2}):(AM|PM)$/i
  )
  if (uiuRange) {
    const startTime = convertTo24h(parseInt(uiuRange[1]), parseInt(uiuRange[2]), uiuRange[3].toUpperCase())
    const endTime   = convertTo24h(parseInt(uiuRange[4]), parseInt(uiuRange[5]), uiuRange[6].toUpperCase())
    return { startTime, endTime }
  }

  // ── Standard AM/PM range: "9:00 AM - 10:30 AM" ─────────────────────────────
  const stdRange = str.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  )
  if (stdRange) {
    const startTime = convertTo24h(parseInt(stdRange[1]), parseInt(stdRange[2]), stdRange[3].toUpperCase())
    const endTime   = convertTo24h(parseInt(stdRange[4]), parseInt(stdRange[5]), stdRange[6].toUpperCase())
    return { startTime, endTime }
  }

  // ── Single time value: "9:00 AM" ───────────────────────────────────────────
  const singleAmPm = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (singleAmPm) {
    const t = convertTo24h(parseInt(singleAmPm[1]), parseInt(singleAmPm[2]), singleAmPm[3].toUpperCase())
    return { startTime: t, endTime: t }
  }

  // ── Single time value with colon before AM/PM: "09:00:AM" ──────────────────
  const singleUiu = str.match(/^(\d{1,2}):(\d{2}):(AM|PM)$/i)
  if (singleUiu) {
    const t = convertTo24h(parseInt(singleUiu[1]), parseInt(singleUiu[2]), singleUiu[3].toUpperCase())
    return { startTime: t, endTime: t }
  }

  // ── 24-hour range: "09:00 - 10:30" ─────────────────────────────────────────
  const h24Range = str.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/)
  if (h24Range) {
    const startTime = `${parseInt(h24Range[1]).toString().padStart(2, "0")}:${h24Range[2]}`
    const endTime   = `${parseInt(h24Range[3]).toString().padStart(2, "0")}:${h24Range[4]}`
    return { startTime, endTime }
  }

  return null
}

function convertTo24h(h: number, m: number, meridiem: string): string {
  if (meridiem === "AM") {
    if (h === 12) h = 0
  } else {
    if (h !== 12) h += 12
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/**
 * Parse any time cell value — handles Excel serial numbers or string formats.
 */
function parseSingleTime(raw: any): string | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "number") return excelSerialToHHmm(raw)
  const str = String(raw).trim()
  const result = parseTimeRange(str)
  return result ? result.startTime : null
}

// ── Strategy helpers ──────────────────────────────────────────────────────────

/**
 * UIU Report Format:
 *   Row 7 header: Formal Code (col 0) | Course Title (col 3) | Day (col 7) | Room (col 9) | Time Slot (col 10)
 *   Data rows can have an empty col 0 (continuation of previous course, different day).
 */
function parseUIUFormat(rows: any[][]): ParsedClassSlot[] {
  const slots: ParsedClassSlot[] = []

  // Find header row by looking for "Formal Code" or "Course Title" and "Day" and "Time Slot"
  let headerRowIdx = -1
  let colCode = -1, colTitle = -1, colDay = -1, colRoom = -1, colTime = -1

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r]
    if (!row) continue
    let foundDay = false, foundTime = false, foundCode = false
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").trim().toLowerCase()
      if (cell === "formal code" || cell === "course code")  { colCode = c; foundCode = true }
      if (cell === "course title" || cell === "subject")     { colTitle = c }
      if (cell === "day")                                     { colDay = c; foundDay = true }
      if (cell === "room" || cell === "venue")                { colRoom = c }
      if (cell === "time slot" || cell === "time" || cell === "class time") { colTime = c; foundTime = true }
    }
    if (foundDay && foundTime) {
      headerRowIdx = r
      break
    }
  }

  if (headerRowIdx === -1) return []

  let lastCourse = "Class"
  let lastRoom: string | undefined = undefined

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue

    const rawCode  = colCode  >= 0 ? String(row[colCode]  || "").trim() : ""
    const rawTitle = colTitle >= 0 ? String(row[colTitle] || "").trim() : ""
    const rawDay   = colDay   >= 0 ? String(row[colDay]   || "").trim() : ""
    const rawRoom  = colRoom  >= 0 ? String(row[colRoom]  || "").trim() : ""
    const rawTime  = colTime  >= 0 ? String(row[colTime]  || "").trim() : ""

    // Update last known course if this row has one
    if (rawCode && rawCode.length >= 2) {
      lastCourse = rawTitle || rawCode
      lastRoom   = rawRoom || undefined
    } else if (rawTitle && rawTitle.length >= 2) {
      lastCourse = rawTitle
      lastRoom   = rawRoom || undefined
    }

    if (!rawDay) continue
    const day = DAYS_MAP[rawDay.toLowerCase()]
    if (!day) continue

    if (!rawTime) continue
    const timeRange = parseTimeRange(rawTime)
    if (!timeRange) continue

    slots.push({
      day,
      startTime: timeRange.startTime,
      endTime:   timeRange.endTime,
      course:    lastCourse,
      room:      rawRoom || lastRoom || undefined,
    })
  }

  return slots
}

/**
 * Generic table format with flexible header detection.
 */
function parseGenericTableFormat(rows: any[][]): ParsedClassSlot[] {
  const COL_ALIASES: Record<string, string[]> = {
    day:       ["day", "weekday", "days"],
    startTime: ["start time", "start", "from", "time from", "begin", "class time", "starttime", "start_time"],
    endTime:   ["end time", "end", "to", "time to", "finish", "endtime", "end_time"],
    course:    ["course", "subject", "class", "course name", "course code", "subject name", "coursename", "course title", "formal code"],
    room:      ["room", "venue", "location", "room no", "classroom", "lab", "room number"],
    timeSlot:  ["time slot", "time", "class time", "slot"],
  }

  let headerRowIdx = -1
  const headerMap: Record<string, number> = {}

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r]
    if (!row) continue
    let matchCount = 0
    const tempMap: Record<string, number> = {}

    for (let c = 0; c < row.length; c++) {
      const cellStr = String(row[c] || "").trim().toLowerCase()
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        if (aliases.includes(cellStr)) {
          tempMap[field] = c
          matchCount++
          break
        }
      }
    }

    if (matchCount >= 2 && "day" in tempMap && ("course" in tempMap || "timeSlot" in tempMap)) {
      Object.assign(headerMap, tempMap)
      headerRowIdx = r
      break
    }
  }

  if (headerRowIdx === -1) return []

  const slots: ParsedClassSlot[] = []

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue

    const rawDay    = String(row[headerMap.day]       || "").trim()
    const rawCourse = String(row[headerMap.course]     || "").trim()
    const rawRoom   = headerMap.room !== undefined ? String(row[headerMap.room] || "").trim() : ""

    if (!rawDay) continue
    const day = DAYS_MAP[rawDay.toLowerCase()]
    if (!day) continue

    // Try combined time slot column first
    if (headerMap.timeSlot !== undefined) {
      const rawTime = String(row[headerMap.timeSlot] || "").trim()
      const timeRange = parseTimeRange(rawTime)
      if (timeRange && rawCourse) {
        slots.push({ day, startTime: timeRange.startTime, endTime: timeRange.endTime, course: rawCourse, room: rawRoom || undefined })
        continue
      }
    }

    // Try separate start/end columns
    const startTime = parseSingleTime(row[headerMap.startTime])
    const endTime   = headerMap.endTime !== undefined ? parseSingleTime(row[headerMap.endTime]) : null

    if (startTime && rawCourse) {
      slots.push({ day, startTime, endTime: endTime || startTime, course: rawCourse, room: rawRoom || undefined })
    }
  }

  return slots
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseRoutineExcel(buffer: Buffer): ParsedClassSlot[] {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })

  // Try UIU format first (has "Formal Code", "Day", "Time Slot" columns)
  const uiuSlots = parseUIUFormat(rows)
  if (uiuSlots.length > 0) return uiuSlots

  // Fallback to generic table format
  const genericSlots = parseGenericTableFormat(rows)
  if (genericSlots.length > 0) return genericSlots

  return []
}
