import { sanitizeHeaders } from '../../../shared/utils/sanitize.js'

export function createHttpLogger({ logger, now = () => Date.now() }) {
  return function httpLogger(request, response, next) {
    const startedAt = now()

    response.on('finish', () => {
      logger.http('HTTP request completed', {
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: now() - startedAt,
        headers: sanitizeHeaders(request.headers)
      })
    })

    next()
  }
}
