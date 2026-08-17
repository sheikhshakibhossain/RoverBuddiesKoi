import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { NotFoundError, ValidationError } from "../utils/errors.js"

export async function getSkillsCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } })

    const userSkills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    })

    const allApproved = await prisma.userSkill.groupBy({
      by: ['skillId'],
      where: { status: "APPROVED" },
      _count: { userId: true }
    })
    
    const countMap = Object.fromEntries(allApproved.map(a => [a.skillId, a._count.userId]))

    const catalog = skills.map(s => ({
      ...s,
      count: countMap[s.id] || 0
    }))

    res.json({
      catalog,
      mySkills: userSkills.map((us) => ({
        id: us.id,
        skillId: us.skillId,
        name: us.skill.name,
        status: us.status,
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function requestSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const { skillName } = req.body

    if (!skillName || typeof skillName !== "string") {
      throw new ValidationError("skillName is required")
    }

    let skill = await prisma.skill.findUnique({ where: { name: skillName } })
    if (!skill) {
      skill = await prisma.skill.create({ data: { name: skillName } })
    }

    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: skill.id } },
    })

    if (existing) {
      if (existing.status === "APPROVED") {
        throw new ValidationError("Skill is already approved on your profile")
      }
      if (existing.status === "PENDING") {
        throw new ValidationError("Skill request is already pending manager approval")
      }
      // If REJECTED, update to PENDING
      const updated = await prisma.userSkill.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
      })
      return res.json({ message: "Skill request resubmitted", userSkill: updated })
    }

    const userSkill = await prisma.userSkill.create({
      data: {
        userId,
        skillId: skill.id,
        status: "PENDING",
      },
    })

    res.status(201).json({ message: "Skill request submitted for manager approval", userSkill })
  } catch (error) {
    next(error)
  }
}

export async function getPendingSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUser = req.user!

    const pending = await prisma.userSkill.findMany({
      where: { 
        status: "PENDING",
      },
      include: {
        user: {
          include: {
            team: true,
            subteams: { include: { subteam: true } },
          },
        },
        skill: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Filter by manager RBAC scope
    let scopedPending = pending
    if (currentUser.role === "TEAM_MANAGER" && currentUser.teamId) {
      scopedPending = pending.filter((p) => p.user.teamId === currentUser.teamId)
    } else if (currentUser.role === "SUBTEAM_MANAGER" && currentUser.subteamIds.length > 0) {
      scopedPending = pending.filter((p) => 
        p.user.subteams.some((st) => currentUser.subteamIds.includes(st.subteamId))
      )
    }

    const result = scopedPending.map((p) => ({
      id: p.id,
      memberName: p.user.name,
      member: p.user.name,
      initials: p.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U",
      memberRole: p.user.role,
      team: p.user.team?.name || "UMRT",
      subteam: p.user.subteams[0]?.subteam?.name || "Software",
      skillName: p.skill.name,
      skill: p.skill.name,
      requestedAt: p.createdAt,
      requested: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dhaka" }),
    }))

    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function approveSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const managerId = req.user!.id

    const userSkill = await prisma.userSkill.findUnique({ where: { id } })
    if (!userSkill) throw new NotFoundError("Skill request not found")

    const updated = await prisma.userSkill.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedByUserId: managerId,
      },
    })

    res.json({ message: "Skill request approved", userSkill: updated })
  } catch (error) {
    next(error)
  }
}

export async function rejectSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const managerId = req.user!.id

    const userSkill = await prisma.userSkill.findUnique({ where: { id } })
    if (!userSkill) throw new NotFoundError("Skill request not found")

    const updated = await prisma.userSkill.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedByUserId: managerId,
      },
    })

    res.json({ message: "Skill request rejected", userSkill: updated })
  } catch (error) {
    next(error)
  }
}
