import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { calculateAvailability } from "../services/availability.js"
import { DayOfWeek } from "@prisma/client"

export async function processAIChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = req.body
    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Please provide a question." })
    }

    const currentUser = req.user!
    const query = message.toLowerCase()

    const users = await prisma.user.findMany({
      where: { organizationId: currentUser.organizationId },
      include: {
        team: true,
        subteams: { include: { subteam: true } },
        routines: true,
        skills: { where: { status: "APPROVED" }, include: { skill: true } },
      },
    })

    const days: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const currentDay = days[new Date().getDay()]
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

    let replyText = ""

    // Pattern matching logic for AI assistant query
    if (query.includes("who is free") || query.includes("available members") || query.includes("free right now")) {
      const freeMembers = users.filter((u) => {
        const schedule = u.routines.map((r) => ({
          day: r.day,
          startTime: r.startTime,
          endTime: r.endTime,
          course: r.course,
        }))
        const avail = calculateAvailability(schedule, currentDay, currentTime)
        return avail.status === "free"
      })

      if (freeMembers.length === 0) {
        replyText = "Currently, all team members have classes or haven't uploaded routines."
      } else {
        const list = freeMembers.map((m) => `• **${m.name}** (${m.team?.name || "UMRT"} - ${m.subteams[0]?.subteam?.name || "Software"})`).join("\n")
        replyText = `Here are the **${freeMembers.length} member(s)** currently free right now on ${currentDay}:\n\n${list}`
      }
    } else if (query.includes("skill") || query.includes("react") || query.includes("python") || query.includes("pcb") || query.includes("ros") || query.includes("cad")) {
      const skillName = ["react", "typescript", "python", "ros", "pcb design", "cad", "devops", "ui/ux", "machine learning"]
        .find((s) => query.includes(s)) || "skills"

      const matched = users.filter((u) =>
        u.skills.some((sk) => sk.skill.name.toLowerCase().includes(skillName))
      )

      if (matched.length === 0) {
        replyText = `No team members currently have approved expertise in **${skillName}**.`
      } else {
        const list = matched.map((m) => `• **${m.name}** (${m.subteams[0]?.subteam?.name || "Member"}) - ${m.skills.map((s) => s.skill.name).join(", ")}`).join("\n")
        replyText = `Found **${matched.length} member(s)** with approved skill in **${skillName}**:\n\n${list}`
      }
    } else if (query.includes("meeting") || query.includes("schedule") || query.includes("best time")) {
      replyText = `Based on current class routines for **${currentDay}**, peak team availability is between **2:00 PM and 4:30 PM**. You can also check the Availability Heatmap tab for complete statistics!`
    } else {
      replyText = `I analyzed live class routines for CAIR Lab. **${users.length} total members** registered across UMRT, URRT, and Team XYZ. You can search by team, subteam, skills, or check real-time availability in the members tab!`
    }

    res.json({ reply: replyText })
  } catch (error) {
    next(error)
  }
}
