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
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2], 10)
    const isPM = match12[3].toUpperCase() === "PM"
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    return h * 60 + m
  }
  const [h, m] = clean.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
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
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  })
  const parts = formatter.formatToParts(date)
  let day: DayOfWeek = "Mon"
  let hours = 0
  let minutes = 0
  for (const p of parts) {
    if (p.type === "weekday") {
      day = p.value as DayOfWeek
    } else if (p.type === "hour") {
      hours = parseInt(p.value, 10)
    } else if (p.type === "minute") {
      minutes = parseInt(p.value, 10)
    }
  }
  const timeStr24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  const totalMinutes = hours * 60 + minutes
  return { day, hours, minutes, timeStr24, totalMinutes }
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
