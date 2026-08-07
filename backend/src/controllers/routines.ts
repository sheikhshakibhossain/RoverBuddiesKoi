import { Request, Response, NextFunction } from "express"
import { prisma } from "../db.js"
import { parseRoutineExcel } from "../services/routineParser.js"
import { ValidationError } from "../utils/errors.js"

export async function uploadRoutine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    if (!req.file) {
      throw new ValidationError("Spreadsheet file is required")
    }

    // Find active semester — auto-create a default one if none exists
    let activeSemester = await prisma.semester.findFirst({
      where: { organizationId: req.user!.organizationId, isActive: true },
    })

    if (!activeSemester) {
      // Auto-create a default semester so upload always works
      const now = new Date()
      const end = new Date(now)
      end.setMonth(end.getMonth() + 6)
      activeSemester = await prisma.semester.create({
        data: {
          organizationId: req.user!.organizationId,
          name: "Current Semester",
          startDate: now,
          endDate: end,
          routineDeadline: end,
          isActive: true,
        },
      })
    }

    const parsedSlots = parseRoutineExcel(req.file.buffer)
    if (parsedSlots.length === 0) {
      console.error("[routineParser] Parsed 0 slots. File size:", req.file.size, "Original name:", req.file.originalname)
      throw new ValidationError(
        "Could not parse class slots from the uploaded file. " +
        "Please upload a UIU RptStudentClassRoutine.xlsx file."
      )
    }

    // Replace user's old routines for this semester
    await prisma.classRoutine.deleteMany({
      where: { userId, semesterId: activeSemester.id },
    })

    const createdRoutines = []
    for (const slot of parsedSlots) {
      const cr = await prisma.classRoutine.create({
        data: {
          userId,
          semesterId: activeSemester.id,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          course: slot.course,
          room: slot.room,
        },
      })
      createdRoutines.push(cr)
    }

    res.json({
      message: `Routine uploaded successfully! ${createdRoutines.length} class slots synced.`,
      count: createdRoutines.length,
      schedule: createdRoutines,
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyRoutine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const routines = await prisma.classRoutine.findMany({
      where: { userId },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    })
    res.json(routines)
  } catch (error) {
    next(error)
  }
}
