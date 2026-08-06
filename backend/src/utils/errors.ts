export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden resource") {
    super(message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400)
  }
}
