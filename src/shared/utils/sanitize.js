const REDACTED = '[REDACTED]'

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'password',
  'db_password',
  'jwt_secret',
  'sports_api_key'
])

export function sanitizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        return [key, REDACTED]
      }

      return [key, value]
    })
  )
}

export function sanitizeObject(input) {
  if (Array.isArray(input)) {
    return input.map((value) => sanitizeObject(value))
  }

  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          return [key, REDACTED]
        }

        return [key, sanitizeObject(value)]
      })
    )
  }

  if (typeof input === 'string') {
    return input
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, `Bearer ${REDACTED}`)
      .replace(
        /(password|secret|api[_-]?key)\s*[:=]\s*[^,\s]+/gi,
        '$1=' + REDACTED
      )
  }

  return input
}

export function toErrorLogPayload(error) {
  return sanitizeObject({
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details
  })
}
