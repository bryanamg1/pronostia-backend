import { AppError } from '../../../shared/errors/AppError.js'
import { toErrorLogPayload } from '../../../shared/utils/sanitize.js'

function buildErrorLogPayload({ error, knownError, payloadTooLarge }) {
  if (knownError) {
    return toErrorLogPayload(error)
  }

  if (payloadTooLarge) {
    return {
      name: error?.name,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Payload too large'
    }
  }

  return {
    name: error?.name,
    code: error?.code ?? 'INTERNAL_ERROR',
    message: 'Internal server error'
  }
}

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
      method: request.method,
      path: request.originalUrl ?? request.url,
      error: buildErrorLogPayload({
        error,
        knownError,
        payloadTooLarge
      })
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
