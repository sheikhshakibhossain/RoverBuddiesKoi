import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { calculateAvailability } from "../services/availability.js"
import { DayOfWeek } from "@prisma/client"

const DAYS: DayOfWeek[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
]

// ─── Core computation ────────────────────────────────────────────────────────

async function computeHeatmapMatrix(organizationId: string) {
  const users = await prisma.user.findMany({
    where: { organizationId },
    include: {
      team: true,
      subteams: { include: { subteam: { include: { team: true } } } },
      routines: true,
    },
  })

  // Build team-level matrix: team → day → hour → {free, total, pct}
  const teamMatrix: Record<string, Record<string, Record<string, { free: number; total: number; pct: number }>>> = {}
  // Build subteam-level matrix: team → subteam → day → hour → {free, total, pct}
  const subteamMatrix: Record<string, Record<string, Record<string, Record<string, { free: number; total: number; pct: number }>>>> = {}
  // Totals
  const teamTotals: Record<string, number> = {}
  const subteamTotals: Record<string, Record<string, number>> = {}

  for (const u of users) {
    const teamName = u.team?.name
    if (!teamName) continue

    // Init team matrix
    if (!teamMatrix[teamName]) {
      teamMatrix[teamName] = {}
      teamTotals[teamName] = 0
      subteamMatrix[teamName] = {}
      subteamTotals[teamName] = {}
      for (const d of DAYS) {
        teamMatrix[teamName][d] = {}
        for (const h of HOURS) teamMatrix[teamName][d][h] = { free: 0, total: 0, pct: 0 }
      }
    }
    teamTotals[teamName]++

    // Init subteam matrices
    for (const us of u.subteams) {
      const subName = us.subteam.name
      if (!subteamMatrix[teamName][subName]) {
        subteamMatrix[teamName][subName] = {}
        subteamTotals[teamName][subName] = 0
        for (const d of DAYS) {
          subteamMatrix[teamName][subName][d] = {}
          for (const h of HOURS) subteamMatrix[teamName][subName][d][h] = { free: 0, total: 0, pct: 0 }
        }
      }
      subteamTotals[teamName][subName]++
    }

    const schedule = u.routines.map((r) => ({
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      course: r.course,
      room: r.room,
    }))

    for (const day of DAYS) {
      for (const hour of HOURS) {
        const avail = calculateAvailability(schedule, day, hour)
        const isFree = avail.status === "free"

        // Increment team counters
        teamMatrix[teamName][day][hour].total++
        if (isFree) teamMatrix[teamName][day][hour].free++

        // Increment subteam counters
        for (const us of u.subteams) {
          const subName = us.subteam.name
          if (subteamMatrix[teamName]?.[subName]?.[day]?.[hour]) {
            subteamMatrix[teamName][subName][day][hour].total++
            if (isFree) subteamMatrix[teamName][subName][day][hour].free++
          }
        }
      }
    }
  }

  // Compute percentages
  for (const team in teamMatrix) {
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const cell = teamMatrix[team][day][hour]
        cell.pct = cell.total > 0 ? Math.round((cell.free / cell.total) * 100) : 0
      }
    }
  }
  for (const team in subteamMatrix) {
    for (const sub in subteamMatrix[team]) {
      for (const day of DAYS) {
        for (const hour of HOURS) {
          const cell = subteamMatrix[team][sub][day][hour]
          cell.pct = cell.total > 0 ? Math.round((cell.free / cell.total) * 100) : 0
        }
      }
    }
  }

  return { days: DAYS, hours: HOURS, teamMatrix, subteamMatrix, teamTotals, subteamTotals }
}

// ─── Live heatmap endpoint ────────────────────────────────────────────────────

export async function getHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!
    const data = await computeHeatmapMatrix(currentUser.organizationId)

    // RBAC scoping: only return what this user should see
    let filteredTeamMatrix = data.teamMatrix
    let filteredSubteamMatrix = data.subteamMatrix
    let filteredTeamTotals = data.teamTotals
    let filteredSubteamTotals = data.subteamTotals

    if (currentUser.role === "TEAM_MANAGER" && currentUser.teamId) {
      const teams = await prisma.team.findMany({ where: { id: currentUser.teamId } })
      const allowedTeams = teams.map((t) => t.name)
      filteredTeamMatrix = Object.fromEntries(
        Object.entries(data.teamMatrix).filter(([k]) => allowedTeams.includes(k))
      )
      filteredSubteamMatrix = Object.fromEntries(
        Object.entries(data.subteamMatrix).filter(([k]) => allowedTeams.includes(k))
      )
      filteredTeamTotals = Object.fromEntries(
        Object.entries(data.teamTotals).filter(([k]) => allowedTeams.includes(k))
      )
      filteredSubteamTotals = Object.fromEntries(
        Object.entries(data.subteamTotals).filter(([k]) => allowedTeams.includes(k))
      )
    } else if (
      (currentUser.role === "SUBTEAM_MANAGER" || currentUser.role === "MEMBER") &&
      currentUser.subteamIds.length > 0
    ) {
      const subteams = await prisma.subteam.findMany({
        where: { id: { in: currentUser.subteamIds } },
        include: { team: true },
      })
      // Only show the teams/subteams they belong to
      const teamSubMap: Record<string, string[]> = {}
      for (const st of subteams) {
        if (!teamSubMap[st.team.name]) teamSubMap[st.team.name] = []
        teamSubMap[st.team.name].push(st.name)
      }
      filteredTeamMatrix = Object.fromEntries(
        Object.entries(data.teamMatrix).filter(([k]) => k in teamSubMap)
      )
      filteredTeamTotals = Object.fromEntries(
        Object.entries(data.teamTotals).filter(([k]) => k in teamSubMap)
      )
      filteredSubteamMatrix = {}
      filteredSubteamTotals = {}
      for (const [teamName, subs] of Object.entries(teamSubMap)) {
        if (data.subteamMatrix[teamName]) {
          filteredSubteamMatrix[teamName] = Object.fromEntries(
            Object.entries(data.subteamMatrix[teamName]).filter(([k]) => subs.includes(k))
          )
          filteredSubteamTotals[teamName] = Object.fromEntries(
            Object.entries(data.subteamTotals[teamName] || {}).filter(([k]) => subs.includes(k))
          )
        }
      }
    }

    res.json({
      ...data,
      teamMatrix: filteredTeamMatrix,
      subteamMatrix: filteredSubteamMatrix,
      teamTotals: filteredTeamTotals,
      subteamTotals: filteredSubteamTotals,
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

// ─── Compute + store snapshot ─────────────────────────────────────────────────

export async function computeSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!
    if (currentUser.role !== "ORG_OWNER") {
      return res.status(403).json({ error: "Only Org Owner can trigger snapshots" })
    }
    const data = await computeHeatmapMatrix(currentUser.organizationId)
    await prisma.heatmapSnapshot.create({
      data: {
        organizationId: currentUser.organizationId,
        matrix: data as any,
      },
    })
    res.json({ message: "Snapshot computed and stored", computedAt: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
}

// ─── Cron endpoint (called every 12 hrs by Vercel cron / external scheduler) ──

export async function cronComputeAllSnapshots(req: Request, res: Response, next: NextFunction) {
  try {
    // Secret key guard
    const secret = req.headers["x-cron-secret"] || req.query["secret"]
    if (secret !== (process.env.CRON_SECRET || "roverbuddies-cron-2026")) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const orgs = await prisma.organization.findMany()
    const results: string[] = []

    for (const org of orgs) {
      const data = await computeHeatmapMatrix(org.id)
      await prisma.heatmapSnapshot.create({
        data: { organizationId: org.id, matrix: data as any },
      })
      results.push(org.id)
    }

    // Keep only last 14 snapshots per org (7 days × 2 per day)
    for (const org of orgs) {
      const snapshots = await prisma.heatmapSnapshot.findMany({
        where: { organizationId: org.id },
        orderBy: { computedAt: "desc" },
        select: { id: true },
      })
      if (snapshots.length > 14) {
        const toDelete = snapshots.slice(14).map((s) => s.id)
        await prisma.heatmapSnapshot.deleteMany({ where: { id: { in: toDelete } } })
      }
    }

    res.json({ message: "Snapshots computed", orgs: results, at: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
}

// ─── Get snapshot history ─────────────────────────────────────────────────────

export async function getSnapshots(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!
    const snapshots = await prisma.heatmapSnapshot.findMany({
      where: { organizationId: currentUser.organizationId },
      orderBy: { computedAt: "desc" },
      take: 14,
      select: {
        id: true,
        computedAt: true,
        matrix: true,
      },
    })
    res.json(snapshots)
  } catch (error) {
    next(error)
  }
}
