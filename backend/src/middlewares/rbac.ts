import { Request, Response, NextFunction } from "express"
import { Role } from "@prisma/client"
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js"

export function authorize(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Access denied: Insufficient privileges"))
    }

    next()
  }
}
