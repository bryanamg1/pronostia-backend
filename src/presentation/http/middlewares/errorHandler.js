import { AppError } from '../../../shared/errors/AppError.js'

export function createErrorHandler({ environment, logger }) {
  return function errorHandler(error, request, response, next) {
    void next
    const requestId = request.requestId
    const knownError = error instanceof AppError
    const payloadTooLarge =
      error?.status === 413 ||
      error?.statusCode === 413 ||
      error?.type === 'entity.too.large'

    logger.error('HTTP request failed', {
      requestId,
      error
    })

    const statusCode = knownError
      ? error.statusCode
      : payloadTooLarge
        ? 413
        : 500
    const message = payloadTooLarge
      ? 'Payload too large'
      : knownError && error.expose
        ? error.message
        : environment === 'production'
          ? 'Internal server error'
          : 'Internal server error'

    response.status(statusCode).json({
      success: false,
      error: {
        code: payloadTooLarge
          ? 'PAYLOAD_TOO_LARGE'
          : knownError
            ? error.code
            : 'INTERNAL_ERROR',
        message,
        requestId
      }
    })
  }
}
