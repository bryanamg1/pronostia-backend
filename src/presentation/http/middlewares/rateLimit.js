import rateLimit from 'express-rate-limit'

export function createRateLimitMiddleware({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false
  })
}
