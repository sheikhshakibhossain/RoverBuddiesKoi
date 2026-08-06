import { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { prisma } from "../db.js"
import { config } from "../config/index.js"
import { AppError, UnauthorizedError, ValidationError } from "../utils/errors.js"
import { Role } from "@prisma/client"
import { parseRoutineExcel } from "../services/routineParser.js"

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.nativeEnum(Role).default(Role.MEMBER),
    teamName: z.string().optional(),
    subteamNames: z.array(z.string()).optional(),
    batch: z.string().default("2023"),
    whatsapp: z.string().min(8, "Valid WhatsApp number required"),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
})

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    let { name, email, password, role, teamName, subteamNames, batch, whatsapp } = req.body

    if (typeof subteamNames === "string") {
      try {
        subteamNames = JSON.parse(subteamNames)
      } catch (e) {
        subteamNames = [subteamNames]
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      throw new ValidationError("An account with this email already exists")
    }

    // Default Org
    let org = await prisma.organization.findFirst()
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "CAIR Lab", code: "cair-lab" },
      })
    }

    // Team Lookup
    let teamId: string | null = null
    if (teamName) {
      let team = await prisma.team.findFirst({
        where: { name: teamName, organizationId: org.id },
      })
      if (!team) {
        team = await prisma.team.create({
          data: { name: teamName, organizationId: org.id },
        })
      }
      teamId = team.id
    }

    // Password Hashing
    const passwordHash = await bcrypt.hash(password, 10)

    // Initials calculation
    const initials = name
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

    const actualRole = role
    const requestedRole = null

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: actualRole as Role,
        requestedRole: requestedRole as Role | null,
        initials,
        organizationId: org.id,
        teamId,
        batch: batch || "2023",
        whatsapp: whatsapp || "880123456789",
      },
    })

    // Assign subteams
    if (subteamNames && Array.isArray(subteamNames) && teamId) {
      for (const stName of subteamNames) {
        let subteam = await prisma.subteam.findFirst({
          where: { name: stName, teamId },
        })
        if (!subteam) {
          subteam = await prisma.subteam.create({
            data: { name: stName, teamId },
          })
        }
        await prisma.userSubteam.create({
          data: { userId: user.id, subteamId: subteam.id },
        })
      }
    }

    // Handle routine file if uploaded during register
    if (req.file) {
      const activeSemester = await prisma.semester.findFirst({
        where: { organizationId: org.id, isActive: true },
      })
      if (activeSemester) {
        const slots = parseRoutineExcel(req.file.buffer)
        for (const slot of slots) {
          await prisma.classRoutine.create({
            data: {
              userId: user.id,
              semesterId: activeSemester.id,
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              course: slot.course,
              room: slot.room,
            },
          })
        }
      }
    }

    const accessToken = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: "15m" })
    const refreshToken = jwt.sign({ userId: user.id }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" })

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        batch: user.batch,
        whatsapp: user.whatsapp,
        team: teamName || "UMRT",
        subteam: subteamNames?.[0] || "Software",
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        team: true,
        subteams: { include: { subteam: true } },
      },
    })

    if (!user) {
      throw new UnauthorizedError("Invalid email or password")
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password")
    }

    const accessToken = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: "15m" })
    const refreshToken = jwt.sign({ userId: user.id }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" })

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const primarySubteam = user.subteams[0]?.subteam?.name || "Software"

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        batch: user.batch,
        whatsapp: user.whatsapp,
        team: user.team?.name || "UMRT",
        subteam: primarySubteam,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    next(error)
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body
    if (!token) throw new UnauthorizedError("Refresh token is required")

    const savedToken = await prisma.refreshToken.findUnique({ where: { token } })
    if (!savedToken || savedToken.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token")
    }

    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as { userId: string }
    const accessToken = jwt.sign({ userId: decoded.userId }, config.JWT_SECRET, { expiresIn: "15m" })

    res.json({ accessToken })
  } catch (error) {
    next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } })
    }
    res.json({ message: "Logout successful" })
  } catch (error) {
    next(error)
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError()
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        team: true,
        subteams: { include: { subteam: true } },
      },
    })

    if (!user) throw new UnauthorizedError()

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      batch: user.batch,
      whatsapp: user.whatsapp,
      team: user.team?.name || "UMRT",
      subteam: user.subteams[0]?.subteam?.name || "Software",
    })
  } catch (error) {
    next(error)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      // Password reset token or email notification
    }
    res.json({ message: "If account exists, password reset instructions have been dispatched." })
  } catch (error) {
    next(error)
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError()
    
    // Prisma will handle cascading deletes if configured in schema, 
    // otherwise we can just delete the user and rely on cascading.
    await prisma.user.delete({
      where: { id: req.user.id }
    })

    res.json({ message: "Account deleted successfully." })
  } catch (error) {
    next(error)
  }
}
