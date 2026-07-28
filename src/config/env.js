import dotenv from 'dotenv'

import {
  runtimeEnvSchema,
  formatEnvError
} from '../shared/validation/envSchema.js'
import { ValidationError } from '../shared/errors/AppError.js'
import {
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_RATE_LIMIT_WINDOW_MS
} from '../shared/constants/http.js'

export function loadEnv({ env = process.env, shouldLoadDotenv = true } = {}) {
  if (shouldLoadDotenv && env.NODE_ENV !== 'test') {
    dotenv.config()
  }

  const parsed = runtimeEnvSchema.safeParse({
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    FRONTEND_URL: env.FRONTEND_URL,
    LOG_LEVEL: env.LOG_LEVEL,
    TIMEZONE: env.TIMEZONE,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_USER: env.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD,
    DB_NAME: env.DB_NAME,
    SCHEDULER_ENABLED: env.SCHEDULER_ENABLED ?? false,
    SCHEDULER_CRON: env.SCHEDULER_CRON ?? '0 6 * * *',
    RATE_LIMIT_WINDOW_MS:
      env.RATE_LIMIT_WINDOW_MS ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS:
      env.RATE_LIMIT_MAX_REQUESTS ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS
  })

  if (!parsed.success) {
    throw new ValidationError(
      `Invalid environment configuration: ${formatEnvError(parsed.error)}`
    )
  }

  const hasDatabaseConfig = Boolean(
    parsed.data.DB_HOST &&
    parsed.data.DB_PORT &&
    parsed.data.DB_USER &&
    parsed.data.DB_NAME &&
    (parsed.data.DB_PASSWORD || parsed.data.DB_PASSWORD === '')
  )

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    frontendUrl: parsed.data.FRONTEND_URL,
    logLevel: parsed.data.LOG_LEVEL,
    timezone: parsed.data.TIMEZONE,
    scheduler: {
      enabled: parsed.data.SCHEDULER_ENABLED,
      cron: parsed.data.SCHEDULER_CRON
    },
    http: {
      rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS
    },
    database: {
      configured: hasDatabaseConfig,
      host: parsed.data.DB_HOST,
      port: Number(parsed.data.DB_PORT || 0),
      user: parsed.data.DB_USER,
      password: parsed.data.DB_PASSWORD,
      name: parsed.data.DB_NAME
    }
  }
}
