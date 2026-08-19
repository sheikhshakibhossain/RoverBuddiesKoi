import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { calculateAvailability, getDhakaTimeParts, timeToMinutes, format12Hour, isFreeDuringInterval } from "../services/availability.js"
import { DayOfWeek } from "@prisma/client"

const TEAMS = ["UMRT", "URRT", "Team XYZ"]
const SUBTEAMS = ["Software", "Mechanical", "Electrical", "Communication", "Science", "Media", "UI/UX"]
const DAYS: DayOfWeek[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]

const DAY_ALIASES: Record<string, DayOfWeek> = {
  saturday: "Sat", sat: "Sat", "6": "Sat",
  sunday: "Sun", sun: "Sun", "0": "Sun",
  monday: "Mon", mon: "Mon", "1": "Mon",
  tuesday: "Tue", tue: "Tue", "2": "Tue",
  wednesday: "Wed", wed: "Wed", "3": "Wed",
  thursday: "Thu", thu: "Thu", "4": "Thu",
  friday: "Fri", fri: "Fri", "5": "Fri",
}

function getTodayAndTomorrow(dhakaDay: DayOfWeek): { today: DayOfWeek; tomorrow: DayOfWeek } {
  const daysList: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const currentIdx = daysList.indexOf(dhakaDay)
  const tomIdx = (currentIdx + 1) % 7
  return { today: dhakaDay, tomorrow: daysList[tomIdx] }
}

function extractTeam(q: string, existingTeams: string[]): string | null {
  const lowerQ = q.toLowerCase()
  for (const t of existingTeams) {
    if (lowerQ.includes(t.toLowerCase())) return t
  }
  for (const t of TEAMS) {
    if (lowerQ.includes(t.toLowerCase())) return t
  }
  return null
}

function extractSubteam(q: string, existingSubteams: string[]): string | null {
  const lowerQ = q.toLowerCase()
  if (lowerQ.includes("comunication") || lowerQ.includes("communication") || lowerQ.includes("comm") || lowerQ.includes("comms")) {
    return "Communication"
  }
  if (lowerQ.includes("mech") || lowerQ.includes("mechanical")) return "Mechanical"
  if (lowerQ.includes("elec") || lowerQ.includes("electrical")) return "Electrical"
  if (lowerQ.includes("soft") || lowerQ.includes("software") || lowerQ.includes("dev")) return "Software"
  if (lowerQ.includes("science") || lowerQ.includes("sci")) return "Science"
  if (lowerQ.includes("media") || lowerQ.includes("pr") || lowerQ.includes("graphics")) return "Media"

  for (const s of existingSubteams) {
    if (lowerQ.includes(s.toLowerCase())) return s
  }
  for (const s of SUBTEAMS) {
    if (lowerQ.includes(s.toLowerCase())) return s
  }
  return null
}

function extractDay(q: string, dhakaDay: DayOfWeek): DayOfWeek | null {
  const lowerQ = q.toLowerCase()
  const { today, tomorrow } = getTodayAndTomorrow(dhakaDay)
  if (lowerQ.includes("today") || lowerQ.includes("tonight") || lowerQ.includes("now")) return today
  if (lowerQ.includes("tomorrow")) return tomorrow
  for (const [alias, day] of Object.entries(DAY_ALIASES)) {
    // Word boundary or standalone match
    const regex = new RegExp(`\\b${alias}\\b`, "i")
    if (regex.test(lowerQ)) return day
  }
  return null
}

function extractTime(q: string): string | null {
  const lowerQ = q.toLowerCase()
  // 12-hour with AM/PM (e.g., "3pm", "03:30 pm", "2:00:pm", "11am")
  const m12 = lowerQ.match(/\b(\d{1,2})(?::(\d{2}))?\s*[:\s]?(am|pm)\b/i)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const m = m12[2] ? m12[2].padStart(2, "0") : "00"
    const meridiem = m12[3].toLowerCase()
    if (meridiem === "pm" && h !== 12) h += 12
    if (meridiem === "am" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${m}`
  }
  // 24-hour "HH:mm" (e.g. "14:30")
  const m24 = lowerQ.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (m24) {
    const h = m24[1].padStart(2, "0")
    return `${h}:${m24[2]}`
  }
  // "at 3", "after 4", "around 2"
  const mat = lowerQ.match(/\b(?:at|after|around|by)\s+(\d{1,2})\b/i)
  if (mat) {
    let h = parseInt(mat[1], 10)
    if (h < 9) h += 12 // Assume PM for daytime lab queries (1-8)
    return `${String(h).padStart(2, "0")}:00`
  }
  return null
}

function extractBatch(q: string): string | null {
  const m = q.match(/\b(20\d{2})\b/)
  return m ? m[1] : null
}

export async function processAIChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = req.body
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ reply: "Please provide a question or instruction.", members: [] })
    }

    const currentUser = req.user!
    const query = message.trim()
    const lowerQ = query.toLowerCase()

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: DATABASE
    // Fetch live organization members, routines, subteams, and approved skills
    // ──────────────────────────────────────────────────────────────────────────
    const users = await prisma.user.findMany({
      where: { organizationId: currentUser.organizationId },
      include: {
        team: true,
        subteams: { include: { subteam: true } },
        routines: true,
        skills: { where: { status: "APPROVED" }, include: { skill: true } },
      },
      orderBy: { name: "asc" },
    })

    const allSkillsList = await prisma.skill.findMany({ select: { name: true } })
    const skillNames = allSkillsList.map(s => s.name)
    const existingTeams = [...new Set(users.map(u => u.team?.name).filter(Boolean))] as string[]
    const existingSubteams = [...new Set(users.flatMap(u => u.subteams.map(st => st.subteam.name)))]

    // Current Dhaka Time (BST, UTC+6)
    const dhakaNow = getDhakaTimeParts()
    const currentDay = dhakaNow.day
    const currentTime = dhakaNow.timeStr24

    // Map database users to Member interface with live status computation
    const mappedMembers = users.map((u) => {
      const schedule = u.routines.map((r) => ({
        day: r.day,
        startTime: r.startTime,
        endTime: r.endTime,
        course: r.course,
        room: r.room,
      }))

      const avail = calculateAvailability(schedule, currentDay, currentTime)
      const approvedSkills = u.skills.map((s) => s.skill.name)
      const subteamNames = u.subteams.map((st) => st.subteam.name)

      return {
        id: u.id,
        name: u.name,
        initials: u.initials || u.name.slice(0, 2).toUpperCase(),
        org: "CAIR Lab",
        team: u.team?.name || "General",
        subteams: subteamNames.length > 0 ? subteamNames : ["Software"],
        status: avail.status,
        nextChange: avail.nextChange,
        currentClass: avail.currentClass,
        remainingMin: avail.remainingMin,
        skills: approvedSkills,
        batch: u.batch,
        whatsapp: u.whatsapp,
        role: u.role,
        schedule,
      }
    })

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: PROCESSING (Case-Insensitive NLP Extraction & Entity Filtering)
    // ──────────────────────────────────────────────────────────────────────────
    const targetTeam = extractTeam(lowerQ, existingTeams)
    const targetSubteam = extractSubteam(lowerQ, existingSubteams)
    const targetDay = extractDay(lowerQ, currentDay)
    const targetTime = extractTime(lowerQ)
    const targetBatch = extractBatch(lowerQ)

    // Match skills case-insensitively
    let targetSkill: string | null = null
    for (const sk of skillNames) {
      if (lowerQ.includes(sk.toLowerCase())) {
        targetSkill = sk
        break
      }
    }
    if (!targetSkill) {
      const commonTech = ["react", "typescript", "python", "ros", "pcb design", "cad", "machine learning", "ui/ux", "devops", "embedded"]
      const matched = commonTech.find(t => lowerQ.includes(t))
      if (matched) targetSkill = matched
    }

    let pool = [...mappedMembers]
    if (targetTeam) pool = pool.filter(m => m.team.toLowerCase() === targetTeam.toLowerCase())
    if (targetSubteam) pool = pool.filter(m => m.subteams.some(s => s.toLowerCase() === targetSubteam.toLowerCase()))
    if (targetBatch) pool = pool.filter(m => m.batch === targetBatch)

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: ANSWER GENERATION
    // ──────────────────────────────────────────────────────────────────────────
    let replyText = ""
    let resultMembers: typeof mappedMembers = []
    let metaInfo: string | undefined

    const hasTerm = (...patterns: string[]) => patterns.some(p => lowerQ.includes(p.toLowerCase()))

    // 1. Greetings & capabilities
    if (hasTerm("hello", "hi", "hey", "help", "what can you do", "who are you")) {
      replyText = `👋 Hello! I am your **RoverBuddies AI Assistant** connected to live class schedules and member databases.\n\nHere are some things you can ask me:\n• *"Who is free right now?"*\n• *"Find React developers in Software"*\n• *"Who is in class right now?"*\n• *"Who will be free next?"*\n• *"Who is free on Wednesday at 3:00 PM?"*\n• *"When can Software and Mechanical meet?"*\n• *"Which team has the highest availability?"*`
    }
    // 2. Specific day + time availability query
    else if (targetDay && targetTime) {
      const dayTimeFree = pool.filter(m => {
        if (!m.schedule || m.schedule.length === 0) return false
        const tMins = timeToMinutes(targetTime)
        return !m.schedule.some(slot => {
          if (slot.day !== targetDay) return false
          const startM = timeToMinutes(slot.startTime)
          const endM = timeToMinutes(slot.endTime)
          return tMins >= startM && tMins < endM
        })
      })

      const formatted12 = format12Hour(targetTime)
      const contextStr = [targetSubteam, targetTeam].filter(Boolean).join(" · ") || "All Teams"

      if (dayTimeFree.length === 0) {
        replyText = `No members are free on **${targetDay} at ${formatted12}** in **${contextStr}** based on weekly routine schedules.`
      } else {
        replyText = `Found **${dayTimeFree.length} member(s)** free on **${targetDay} at ${formatted12}** (${contextStr}):`
        resultMembers = dayTimeFree
        metaInfo = `${dayTimeFree.length}/${pool.length} available at ${formatted12} BST`
      }
    }
    // 3. Meeting scheduling query / common free time
    else if (hasTerm("meeting", "schedule", "best time", "when can", "meet together", "common time")) {
      const mentionedSubteams = SUBTEAMS.filter(s => lowerQ.includes(s.toLowerCase()))
      if (mentionedSubteams.length >= 2) {
        const groupA = mappedMembers.filter(m => m.subteams.includes(mentionedSubteams[0]))
        const groupB = mappedMembers.filter(m => m.subteams.includes(mentionedSubteams[1]))
        const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
        let bestSlot = ""
        let maxScore = -1

        for (const d of DAYS) {
          for (const h of hours) {
            const freeA = groupA.filter(m => !m.schedule.some(s => s.day === d && timeToMinutes(h) >= timeToMinutes(s.startTime) && timeToMinutes(h) < timeToMinutes(s.endTime))).length
            const freeB = groupB.filter(m => !m.schedule.some(s => s.day === d && timeToMinutes(h) >= timeToMinutes(s.startTime) && timeToMinutes(h) < timeToMinutes(s.endTime))).length
            const score = freeA + freeB
            if (score > maxScore && freeA > 0 && freeB > 0) {
              maxScore = score
              bestSlot = `**${d} at ${format12Hour(h)}** (${freeA}/${groupA.length} ${mentionedSubteams[0]} + ${freeB}/${groupB.length} ${mentionedSubteams[1]} free)`
            }
          }
        }

        if (bestSlot) {
          replyText = `📅 **Recommended Meeting Time** for **${mentionedSubteams[0]}** and **${mentionedSubteams[1]}**:\n\n${bestSlot}\n\nYou can also use the **AI Scheduler** tab for full calendar synchronization!`
        } else {
          replyText = `Could not find a conflict-free window where members from both **${mentionedSubteams[0]}** and **${mentionedSubteams[1]}** are available.`
        }
      } else {
        const ctx = targetSubteam || targetTeam || "Team"
        const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
        let best = { day: currentDay, hour: "14:00", count: 0 }

        for (const d of DAYS) {
          for (const h of hours) {
            const count = pool.filter(m => !m.schedule.some(s => s.day === d && timeToMinutes(h) >= timeToMinutes(s.startTime) && timeToMinutes(h) < timeToMinutes(s.endTime))).length
            if (count > best.count) best = { day: d, hour: h, count }
          }
        }

        const formatted12 = format12Hour(best.hour)
        replyText = `📅 **Optimal Meeting Window** for **${ctx}**:\n\n**${best.day} at ${formatted12}** (${best.count}/${pool.length} members free, ${Math.round((best.count / Math.max(pool.length, 1)) * 100)}% attendance rate).\n\nCheck the **AI Scheduler** tab for full breakdown and calendar export.`
        resultMembers = pool.filter(m => !m.schedule.some(s => s.day === best.day && timeToMinutes(best.hour) >= timeToMinutes(s.startTime) && timeToMinutes(best.hour) < timeToMinutes(s.endTime)))
        metaInfo = `${best.count}/${pool.length} free on ${best.day} at ${formatted12}`
      }
    }
    // 4. Currently in-class / busy members
    else if (hasTerm("in class", "busy", "who is busy", "in-class", "unavailable", "attending class")) {
      const busy = pool.filter(m => m.status === "in-class")
      if (busy.length === 0) {
        replyText = `All members${targetSubteam ? ` in **${targetSubteam}**` : targetTeam ? ` in **${targetTeam}**` : ""} are currently free of classes right now on ${currentDay} (${format12Hour(currentTime)} BST).`
      } else {
        replyText = `**${busy.length} member(s)** currently in class right now:`
        resultMembers = busy
        metaInfo = `${busy.length} busy · ${pool.length - busy.length} free`
      }
    }
    // 5. Becoming free next / ending class soon
    else if (hasTerm("becoming free", "will be free", "free soon", "free next", "ending", "finishing class", "soon")) {
      const becoming = pool
        .filter(m => (m.status === "in-class" || m.status === "soon") && m.remainingMin !== undefined)
        .sort((a, b) => (a.remainingMin ?? 99) - (b.remainingMin ?? 99))

      if (becoming.length === 0) {
        replyText = `No team members are currently nearing the end of a class right now.`
      } else {
        replyText = `**${becoming.length} member(s)** becoming free soon on ${currentDay}:`
        resultMembers = becoming
        metaInfo = becoming.map(m => `${m.name} (${m.remainingMin}m remaining)`).join(", ")
      }
    }
    // 6. Missing routine
    else if (hasTerm("no routine", "missing routine", "without routine", "no schedule", "expired")) {
      const missing = pool.filter(m => m.status === "missing")
      if (missing.length === 0) {
        replyText = `All members have uploaded their class routine for this semester! 🎉`
      } else {
        replyText = `**${missing.length} member(s)** have not uploaded a class routine yet:`
        resultMembers = missing
        metaInfo = `${missing.length} missing routine`
      }
    }
    // 7. Team / Subteam availability comparison
    else if (hasTerm("highest availability", "most available", "most free", "which team", "compare team")) {
      const teamStats = existingTeams.map(t => {
        const tm = mappedMembers.filter(m => m.team === t)
        const freeCount = tm.filter(m => m.status === "free").length
        return { team: t, free: freeCount, total: tm.length, pct: Math.round((freeCount / Math.max(tm.length, 1)) * 100) }
      }).sort((a, b) => b.pct - a.pct)

      const best = teamStats[0]
      if (best) {
        const breakdown = teamStats.map(t => `• **${t.team}**: ${t.free}/${t.total} free (${t.pct}%)`).join("\n")
        replyText = `🏆 **${best.team}** has the highest availability right now (${best.pct}% free):\n\n${breakdown}`
        resultMembers = mappedMembers.filter(m => m.team === best.team && m.status === "free")
        metaInfo = `Ranked by current availability %`
      } else {
        replyText = "No team statistics available yet."
      }
    }
    // 8. Skill search
    else if (targetSkill) {
      const withSkill = pool.filter(m => m.skills.some(s => s.toLowerCase().includes(targetSkill!.toLowerCase())))
      const freeWithSkill = withSkill.filter(m => m.status === "free")

      if (hasTerm("free", "now", "available")) {
        if (freeWithSkill.length === 0) {
          replyText = `No members with approved skill in **${targetSkill}** are currently free right now (${withSkill.length} total registered).`
        } else {
          replyText = `**${freeWithSkill.length} member(s)** with **${targetSkill}** skill free right now:`
          resultMembers = freeWithSkill
          metaInfo = `${freeWithSkill.length} of ${withSkill.length} free right now`
        }
      } else {
        if (withSkill.length === 0) {
          replyText = `No members currently have verified expertise in **${targetSkill}**${targetTeam ? ` in ${targetTeam}` : ""}.`
        } else {
          replyText = `Found **${withSkill.length} member(s)** with verified skill in **${targetSkill}** (${freeWithSkill.length} currently free):`
          resultMembers = withSkill
          metaInfo = `${withSkill.length} verified in ${targetSkill}`
        }
      }
    }
    // 9. Free right now query (default availability search)
    else if (hasTerm("who is free", "free now", "available now", "who's free", "currently free", "available members", "free")) {
      const freeMembers = pool.filter(m => m.status === "free")
      const ctx = [targetSubteam, targetTeam].filter(Boolean).join(" · ") || "All Teams"

      if (freeMembers.length === 0) {
        replyText = `Currently, all members in **${ctx}** are in class or have not uploaded their routine.`
      } else {
        replyText = `**${freeMembers.length} member(s)** free right now in **${ctx}** (${format12Hour(currentTime)} BST):`
        resultMembers = freeMembers
        metaInfo = `${freeMembers.length} free · ${pool.length - freeMembers.length} unavailable`
      }
    }
    // 10. General overview / Fallback
    else {
      const freeTotal = pool.filter(m => m.status === "free").length
      replyText = `Analyzed **${pool.length} member(s)** across **${existingTeams.join(", ") || "all teams"}**. Currently **${freeTotal} free**, **${pool.filter(m => m.status === "in-class").length} in class**.\n\nYou can ask me to find free members, check skills (React, PCB, CAD), or schedule meetings between teams!`
    }

    res.json({
      reply: replyText,
      members: resultMembers,
      meta: metaInfo,
    })
  } catch (error) {
    next(error)
  }
}
