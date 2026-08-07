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

    const activeSemester = await prisma.semester.findFirst({
      where: { organizationId: req.user!.organizationId, isActive: true },
    })

    if (!activeSemester) {
      throw new ValidationError("No active semester found. Contact organization owner.")
    }

    const parsedSlots = parseRoutineExcel(req.file.buffer)
    if (parsedSlots.length === 0) {
      console.error("[routineParser] Parsed 0 slots. File size:", req.file.size, "Original name:", req.file.originalname)
      throw new ValidationError(
        "Could not parse class slots from the uploaded file. " +
        "Please make sure your Excel file has columns: Day, Start Time, End Time, Course, Room " +
        "(with times like '9:00 AM' or '1:30 PM')."
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
      message: "Routine uploaded and parsed successfully",
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
