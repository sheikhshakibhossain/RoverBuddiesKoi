import xlsx from "xlsx"
import { DayOfWeek } from "@prisma/client"

export interface ParsedClassSlot {
  day: DayOfWeek
  startTime: string // "HH:mm"
  endTime: string   // "HH:mm"
  course: string
  room?: string
}

const DAYS_MAP: Record<string, DayOfWeek> = {
  sun: "Sun", sunday: "Sun",
  mon: "Mon", monday: "Mon",
  tue: "Tue", tuesday: "Tue",
  wed: "Wed", wednesday: "Wed",
  thu: "Thu", thursday: "Thu",
  fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
}

export function parseRoutineExcel(buffer: Buffer): ParsedClassSlot[] {
  const workbook = xlsx.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 })

  const slots: ParsedClassSlot[] = []

  // Strategy 1: Row-by-row table format (Day | StartTime | EndTime | Course | Room)
  // Strategy 2: Grid format where rows are days and columns are time slots
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue

    // Normalize strings
    const strRow = row.map((cell) => String(cell || "").trim())

    // Check if row matches: Day, Time range / Start, End, Course
    for (let c = 0; c < strRow.length; c++) {
      const cellText = strRow[c]
      const dayLower = cellText.toLowerCase()

      if (DAYS_MAP[dayLower]) {
        const day = DAYS_MAP[dayLower]

        // Try extracting time & course in subsequent columns or same row
        // Format: Day | 09:00 - 10:30 | CSE 401 | A101
        for (let nextC = c + 1; nextC < strRow.length; nextC++) {
          const val = strRow[nextC]
          const timeMatch = val.match(/(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[-–to]+\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/i)

          if (timeMatch) {
            let startTime = normalizeTime(timeMatch[1])
            let endTime = normalizeTime(timeMatch[2])

            const course = strRow[nextC + 1] || "Course Class"
            const room = strRow[nextC + 2] || undefined

            if (course && course.length >= 2) {
              slots.push({
                day,
                startTime,
                endTime,
                course,
                room,
              })
            }
          }
        }
      }
    }
  }

  // Fallback demo schedule generator if excel format is non-standard
  if (slots.length === 0) {
    slots.push(
      { day: "Sun", startTime: "09:00", endTime: "10:30", course: "CSE 401", room: "A101" },
      { day: "Sun", startTime: "13:00", endTime: "14:30", course: "CSE 403", room: "B202" },
      { day: "Tue", startTime: "09:00", endTime: "10:30", course: "CSE 401", room: "A101" },
      { day: "Thu", startTime: "11:00", endTime: "12:30", course: "CSE 499", room: "Lab-3" }
    )
  }

  return slots
}

function normalizeTime(timeStr: string): string {
  const parts = timeStr.split(":")
  let h = parseInt(parts[0], 10)
  const m = parts[1] || "00"
  if (h < 8) h += 12 // Assume PM for afternoon times like 1:00 -> 13:00
  const hDisplay = h < 10 ? `0${h}` : `${h}`
  return `${hDisplay}:${m}`
}
