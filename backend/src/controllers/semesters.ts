import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { ValidationError } from "../utils/errors.js"

export async function getSemesters(req: Request, res: Response, next: NextFunction) {
  try {
    const semesters = await prisma.semester.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { startDate: "desc" },
    })
    res.json(semesters)
  } catch (error) {
    next(error)
  }
}

export async function createSemester(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startDate, endDate, routineDeadline } = req.body
    if (!name || !startDate || !endDate || !routineDeadline) {
      throw new ValidationError("Missing required semester fields")
    }

    // Deactivate previous active semesters
    await prisma.semester.updateMany({
      where: { organizationId: req.user!.organizationId, isActive: true },
      data: { isActive: false },
    })

    const semester = await prisma.semester.create({
      data: {
        organizationId: req.user!.organizationId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        routineDeadline: new Date(routineDeadline),
        isActive: true,
      },
    })

    res.status(201).json(semester)
  } catch (error) {
    next(error)
  }
}
