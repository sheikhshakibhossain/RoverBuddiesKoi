import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { calculateAvailability } from "../services/availability.js"
import { DayOfWeek } from "@prisma/client"
import { NotFoundError } from "../utils/errors.js"

export async function getMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!
    const { team, subteam, status, day, time, skill, batch, search } = req.query

    // Target day & time calculation
    const targetDayStr = (day as string) || getCurrentDayOfWeek()
    const targetTimeStr = (time as string) || getCurrentTimeStr()

    // Build RBAC & Query filter
    const whereClause: any = {
      organizationId: currentUser.organizationId,
    }

    // Role-based scope checks
    if (currentUser.role === "TEAM_MANAGER" && currentUser.teamId) {
      whereClause.teamId = currentUser.teamId
    } else if ((currentUser.role === "SUBTEAM_MANAGER" || currentUser.role === "MEMBER") && currentUser.subteamIds.length > 0) {
      whereClause.subteams = {
        some: {
          subteamId: { in: currentUser.subteamIds },
        },
      }
    }

    // Explicit Filter Overrides if allowed
    if (team && typeof team === "string" && team !== "all") {
      const teamObj = await prisma.team.findFirst({ where: { name: team, organizationId: currentUser.organizationId } })
      if (teamObj) whereClause.teamId = teamObj.id
    }

    if (subteam && typeof subteam === "string" && subteam !== "all") {
      const subteamObj = await prisma.subteam.findFirst({ where: { name: subteam } })
      if (subteamObj) {
        whereClause.subteams = {
          some: { subteamId: subteamObj.id },
        }
      }
    }

    if (batch && typeof batch === "string" && batch !== "all") {
      whereClause.batch = batch
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        team: true,
        subteams: { include: { subteam: true } },
        routines: true,
        skills: {
          where: { status: "APPROVED" },
          include: { skill: true },
        },
      },
      orderBy: { name: "asc" },
    })

    let mappedMembers = users.map((u) => {
      const schedule = u.routines.map((r) => ({
        day: r.day,
        startTime: r.startTime,
        endTime: r.endTime,
        course: r.course,
        room: r.room,
      }))

      const avail = calculateAvailability(
        schedule,
        targetDayStr as DayOfWeek,
        targetTimeStr
      )

      const approvedSkillNames = u.skills.map((s) => s.skill.name)
      const subteamNames = u.subteams.map((st) => st.subteam.name)

      return {
        id: u.id,
        name: u.name,
        initials: u.initials,
        org: "CAIR Lab",
        team: u.team?.name || "UMRT",
        subteams: subteamNames.length > 0 ? subteamNames : ["Software"],
        status: avail.status,
        nextChange: avail.nextChange,
        currentClass: avail.currentClass,
        remainingMin: avail.remainingMin,
        skills: approvedSkillNames,
        batch: u.batch,
        whatsapp: u.whatsapp,
        role: roleLabel(u.role),
        schedule,
      }
    })

    // Filter by calculated status if requested
    if (status && typeof status === "string" && status !== "all") {
      mappedMembers = mappedMembers.filter((m) => m.status === status)
    }

    // Filter by skill if requested
    if (skill && typeof skill === "string" && skill !== "all") {
      mappedMembers = mappedMembers.filter((m) => m.skills.includes(skill))
    }

    res.json(mappedMembers)
  } catch (error) {
    next(error)
  }
}

export async function getMemberById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const u = await prisma.user.findUnique({
      where: { id },
      include: {
        team: true,
        subteams: { include: { subteam: true } },
        routines: true,
        skills: {
          where: { status: "APPROVED" },
          include: { skill: true },
        },
      },
    })

    if (!u) throw new NotFoundError("Member not found")

    const schedule = u.routines.map((r) => ({
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      course: r.course,
      room: r.room,
    }))

    const avail = calculateAvailability(schedule, getCurrentDayOfWeek(), getCurrentTimeStr())

    res.json({
      id: u.id,
      name: u.name,
      initials: u.initials,
      org: "CAIR Lab",
      team: u.team?.name || "UMRT",
      subteams: u.subteams.map((st) => st.subteam.name),
      status: avail.status,
      nextChange: avail.nextChange,
      currentClass: avail.currentClass,
      remainingMin: avail.remainingMin,
      skills: u.skills.map((s) => s.skill.name),
      batch: u.batch,
      whatsapp: u.whatsapp,
      role: roleLabel(u.role),
      schedule,
    })
  } catch (error) {
    next(error)
  }
}

export async function getPendingRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!

    let whereClause: any = {
      organizationId: currentUser.organizationId,
      requestedRole: { not: null },
    }

    if (currentUser.role === "TEAM_MANAGER" && currentUser.teamId) {
      whereClause.teamId = currentUser.teamId
    }

    const pendingUsers = await prisma.user.findMany({
      where: whereClause,
      include: {
        team: true,
        subteams: { include: { subteam: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = pendingUsers.map((u) => ({
      id: u.id,
      name: u.name,
      team: u.team?.name || "UMRT",
      subteam: u.subteams[0]?.subteam?.name || "Software",
      currentRole: u.role,
      requestedRole: u.requestedRole,
      requestedAt: u.createdAt, // Just using createdAt since we don't have a specific requestedAt timestamp
    }))

    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const { action } = req.body // "approve" or "reject"
    const currentUser = req.user!

    const userToUpdate = await prisma.user.findUnique({ where: { id } })
    if (!userToUpdate) throw new NotFoundError("Member not found")
    if (userToUpdate.organizationId !== currentUser.organizationId) {
      throw new NotFoundError("Member not found")
    }

    if (currentUser.role === "TEAM_MANAGER" && userToUpdate.teamId !== currentUser.teamId) {
      throw new NotFoundError("Member not found in your team")
    }

    if (!userToUpdate.requestedRole) {
      return res.status(400).json({ error: "User has no pending role request" })
    }

    if (action === "approve") {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          role: userToUpdate.requestedRole,
          requestedRole: null,
        },
      })
      res.json({ message: "Role approved", user: updated })
    } else {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          requestedRole: null,
        },
      })
      res.json({ message: "Role rejected", user: updated })
    }
  } catch (error) {
    next(error)
  }
}

function getCurrentDayOfWeek(): DayOfWeek {
  const days: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return days[new Date().getDay()]
}

function getCurrentTimeStr(): string {
  const now = new Date()
  const h = now.getHours().toString().padStart(2, "0")
  const m = now.getMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

function roleLabel(role: string): string {
  switch (role) {
    case "ORG_OWNER": return "Organization Owner"
    case "TEAM_MANAGER": return "Team Manager"
    case "SUBTEAM_MANAGER": return "Subteam Manager"
    default: return "Member"
  }
}
