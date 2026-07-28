import { NotFoundError } from '../../../shared/errors/AppError.js'

export function notFoundHandler(request, response, next) {
  next(
    new NotFoundError(
      `Route ${request.method} ${request.originalUrl} was not found`
    )
  )
}
