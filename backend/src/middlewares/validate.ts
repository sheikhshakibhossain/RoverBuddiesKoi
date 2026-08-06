import { Request, Response, NextFunction } from "express"
import { AnyZodObject, ZodError } from "zod"
import { ValidationError } from "../utils/errors.js"

export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        next(new ValidationError(`Validation failed: ${issues}`))
      } else {
        next(error)
      }
    }
  }
}
