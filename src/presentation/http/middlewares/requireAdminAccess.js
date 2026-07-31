import { createHash, timingSafeEqual } from 'node:crypto'

import { AppError } from '../../../shared/errors/AppError.js'

function readTokenFromRequest(request) {
  const headerToken = request.headers['x-admin-token']

  if (typeof headerToken === 'string' && headerToken.length > 0) {
    return headerToken
  }

  const authorization = request.headers.authorization

  if (
    typeof authorization === 'string' &&
    authorization.toLowerCase().startsWith('bearer ')
  ) {
    return authorization.slice(7).trim()
  }

  return ''
}

function hashToken(token) {
  return createHash('sha256').update(token).digest()
}

function tokensMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false
  }

  return timingSafeEqual(hashToken(left), hashToken(right))
}

export function createRequireAdminAccess({ tokenConfigured, token }) {
  return function requireAdminAccess(request, response, next) {
    void response

    if (!tokenConfigured || !token) {
      next(
        new AppError({
          code: 'ADMIN_AUTH_NOT_CONFIGURED',
          message: 'Admin access is not configured',
          statusCode: 503
        })
      )
      return
    }

    const requestToken = readTokenFromRequest(request)

    if (!requestToken) {
      next(
        new AppError({
          code: 'UNAUTHORIZED',
          message: 'Admin authentication is required',
          statusCode: 401
        })
      )
      return
    }

    if (!tokensMatch(requestToken, token)) {
      next(
        new AppError({
          code: 'FORBIDDEN',
          message: 'Admin token is not valid',
          statusCode: 403
        })
      )
      return
    }

    next()
  }
}
