import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { config } from "../config/index.js"
import { UnauthorizedError } from "../utils/errors.js"
import { prisma } from "../db.js"
import { Role } from "@prisma/client"

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: Role
  organizationId: string
  teamId: string | null
  subteamIds: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authentication token is missing")
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subteams: true,
      },
    })

    if (!user) {
      throw new UnauthorizedError("User profile not found")
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      teamId: user.teamId,
      subteamIds: user.subteams.map((st) => st.subteamId),
    }

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Invalid or expired authentication token"))
    } else {
      next(error)
    }
  }
}
