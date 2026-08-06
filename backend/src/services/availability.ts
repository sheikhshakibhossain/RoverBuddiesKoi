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

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

function format12Hour(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":")
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12
  h = h ? h : 12 // hour 0 is 12
  const minuteDisplay = m < 10 ? `0${m}` : m
  return `${h}:${minuteDisplay} ${ampm}`
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
