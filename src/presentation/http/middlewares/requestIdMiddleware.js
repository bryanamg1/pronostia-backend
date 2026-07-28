import { randomUUID } from 'node:crypto'

export function createRequestIdMiddleware(uuidFactory = randomUUID) {
  return function requestIdMiddleware(request, response, next) {
    const requestId = uuidFactory()
    request.requestId = requestId
    response.setHeader('x-request-id', requestId)
    next()
  }
}
