import { DayOfWeek } from "@prisma/client"

export interface ClassSlot {
  day: DayOfWeek
  startTime: string // "HH:mm"
  endTime: string   // "HH:mm"
  course: string
  room?: string | null
}

export interface AvailabilityResult {
  status: "free" | "in-class" | "soon" | "missing"
  nextChange: string
  currentClass?: string
  remainingMin?: number
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const clean = timeStr.trim()

  // Format 1: "02:00:PM" or "02:00:AM" (UIU format with colon before AM/PM)
  const matchColonAmPm = clean.match(/^(\d{1,2}):(\d{2}):(AM|PM)$/i)
  if (matchColonAmPm) {
    let h = parseInt(matchColonAmPm[1], 10)
    const m = parseInt(matchColonAmPm[2], 10)
    const isPM = matchColonAmPm[3].toUpperCase() === "PM"
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    return h * 60 + m
  }

  // Format 2: "02:00 PM" or "2:00PM" or "02:00:00 PM" (Standard 12-hour AM/PM)
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2], 10)
    const isPM = match12[3].toUpperCase() === "PM"
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    return h * 60 + m
  }

  // Format 3: Range string e.g. "14:00 - 16:30" (extract first time if passed)
  if (clean.includes("-") || clean.includes("–")) {
    const firstPart = clean.split(/[-–]/)[0].trim()
    return timeToMinutes(firstPart)
  }

  // Format 4: 24-hour "HH:mm" or "HH:mm:ss"
  const parts = clean.split(":").map(Number)
  const h = parts[0] || 0
  const m = parts[1] || 0
  return h * 60 + m
}

export function format12Hour(timeStr: string): string {
  if (!timeStr) return ""
  const mins = timeToMinutes(timeStr)
  let h = Math.floor(mins / 60)
  const m = mins % 60
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12
  h = h ? h : 12 // hour 0 is 12
  const minuteDisplay = m < 10 ? `0${m}` : m
  return `${h}:${minuteDisplay} ${ampm}`
}

export function getDhakaTimeParts(date: Date = new Date()): {
  day: DayOfWeek
  hours: number
  minutes: number
  timeStr24: string
  totalMinutes: number
} {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date()

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
    const parts = formatter.formatToParts(d)
    let day: DayOfWeek = "Mon"
    let hours = 0
    let minutes = 0
    let isPM = false
    let isAM = false

    for (const p of parts) {
      if (p.type === "weekday") {
        day = p.value as DayOfWeek
      } else if (p.type === "hour") {
        hours = parseInt(p.value, 10)
      } else if (p.type === "minute") {
        minutes = parseInt(p.value, 10)
      } else if (p.type === "dayPeriod") {
        const val = p.value.toUpperCase()
        if (val === "PM") isPM = true
        if (val === "AM") isAM = true
      }
    }

    if (isPM && hours < 12) {
      hours += 12
    } else if (isAM && hours === 12) {
      hours = 0
    }
    if (hours === 24) {
      hours = 0
    }

    const timeStr24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    const totalMinutes = hours * 60 + minutes
    return { day, hours, minutes, timeStr24, totalMinutes }
  } catch {
    // Robust UTC + 6 hours fallback
    const days: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000)
    const dhakaTime = new Date(utcTime + (6 * 3600000))
    const day = days[dhakaTime.getDay()]
    const hours = dhakaTime.getHours()
    const minutes = dhakaTime.getMinutes()
    const timeStr24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    const totalMinutes = hours * 60 + minutes
    return { day, hours, minutes, timeStr24, totalMinutes }
  }
}

export function calculateAvailability(
  schedule: ClassSlot[],
  targetDay: DayOfWeek,
  targetTimeStr: string // "HH:mm"
): AvailabilityResult {
  if (!schedule || schedule.length === 0) {
    return {
      status: "missing",
      nextChange: "Routine not uploaded",
    }
  }

  const todayClasses = schedule.filter((s) => s.day === targetDay)
  if (todayClasses.length === 0) {
    return {
      status: "free",
      nextChange: "Free all day",
    }
  }

  const currentMins = timeToMinutes(targetTimeStr)

  // 1. Check if currently in class
  for (const slot of todayClasses) {
    const startMins = timeToMinutes(slot.startTime)
    const endMins = timeToMinutes(slot.endTime)

    if (currentMins >= startMins && currentMins < endMins) {
      const remainingMin = endMins - currentMins
      return {
        status: "in-class",
        nextChange: `Free at ${format12Hour(slot.endTime)}`,
        currentClass: slot.course,
        remainingMin,
      }
    }
  }

  // 2. Check if class starting soon (within 30 minutes)
  const upcomingClasses = todayClasses
    .filter((slot) => timeToMinutes(slot.startTime) > currentMins)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  if (upcomingClasses.length > 0) {
    const nextSlot = upcomingClasses[0]
    const nextStartMins = timeToMinutes(nextSlot.startTime)
    const diff = nextStartMins - currentMins

    if (diff <= 30) {
      return {
        status: "soon",
        nextChange: `Class in ${diff} min`,
        currentClass: nextSlot.course,
      }
    }

    return {
      status: "free",
      nextChange: `Free until ${format12Hour(nextSlot.startTime)}`,
    }
  }

  return {
    status: "free",
    nextChange: "Free rest of the day",
  }
}

/**
 * Checks if a member's schedule has any class conflict during [startMins, endMins) on targetDay.
 */
export function isFreeDuringInterval(
  schedule: ClassSlot[],
  targetDay: DayOfWeek,
  startTimeStr: string,
  endTimeStr: string
): { isFree: boolean; conflict?: ClassSlot } {
  if (!schedule || schedule.length === 0) return { isFree: false }

  const startMins = timeToMinutes(startTimeStr)
  const endMins = timeToMinutes(endTimeStr)

  for (const slot of schedule) {
    if (slot.day !== targetDay) continue
    const slotStart = timeToMinutes(slot.startTime)
    const slotEnd = timeToMinutes(slot.endTime)

    // Overlap condition: startA < endB && endA > startB
    if (startMins < slotEnd && endMins > slotStart) {
      return { isFree: false, conflict: slot }
    }
  }

  return { isFree: true }
}
