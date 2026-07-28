export class AppError extends Error {
  constructor({
    code,
    message,
    statusCode = 500,
    expose = true,
    details,
    cause
  }) {
    super(message, { cause })
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.expose = expose
    this.details = details
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      statusCode: 400,
      details
    })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({
      code: 'NOT_FOUND',
      message,
      statusCode: 404
    })
  }
}

export class InfrastructureError extends AppError {
  constructor(message, details, cause) {
    super({
      code: 'INFRASTRUCTURE_ERROR',
      message,
      statusCode: 503,
      details,
      expose: true,
      cause
    })
  }
}
