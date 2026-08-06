import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"

// Get all teams with subteams for this org
export async function getTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!
    let whereClause: any = { organizationId: currentUser.organizationId }

    // Scope: Team Manager only sees their team
    if (currentUser.role === "TEAM_MANAGER" && currentUser.teamId) {
      whereClause.id = currentUser.teamId
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      include: { subteams: true },
      orderBy: { name: "asc" },
    })
    res.json(teams)
  } catch (error) {
    next(error)
  }
}

// Get org metadata: unique batches, skills for filter dropdowns
export async function getOrgMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!

    // Batches: distinct batch values for this org
    const users = await prisma.user.findMany({
      where: { organizationId: currentUser.organizationId },
      select: { batch: true },
    })
    const batches = [...new Set(users.map((u) => u.batch).filter(Boolean))].sort()

    // Skills catalog
    const skills = await prisma.skill.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    })

    res.json({ batches, skills })
  } catch (error) {
    next(error)
  }
}
