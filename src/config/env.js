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

export function bootstrapEnv({
  env = process.env,
  shouldLoadDotenv = true
} = {}) {
  if (shouldLoadDotenv && env.NODE_ENV !== 'test') {
    dotenv.config({
      processEnv: env,
      override: false,
      quiet: true
    })
  }

  return env
}

export function loadEnv({ env = process.env, shouldLoadDotenv = true } = {}) {
  const runtimeEnv = bootstrapEnv({
    env,
    shouldLoadDotenv
  })

  const parsed = runtimeEnvSchema.safeParse({
    NODE_ENV: runtimeEnv.NODE_ENV,
    PORT: runtimeEnv.PORT,
    FRONTEND_URL: runtimeEnv.FRONTEND_URL,
    LOG_LEVEL: runtimeEnv.LOG_LEVEL,
    TIMEZONE: runtimeEnv.TIMEZONE,
    DB_HOST: runtimeEnv.DB_HOST,
    DB_PORT: runtimeEnv.DB_PORT,
    DB_USER: runtimeEnv.DB_USER,
    DB_PASSWORD: runtimeEnv.DB_PASSWORD,
    DB_NAME: runtimeEnv.DB_NAME,
    SCHEDULER_ENABLED: runtimeEnv.SCHEDULER_ENABLED ?? false,
    SCHEDULER_CRON: runtimeEnv.SCHEDULER_CRON ?? '0 6 * * *',
    RATE_LIMIT_WINDOW_MS:
      runtimeEnv.RATE_LIMIT_WINDOW_MS ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS:
      runtimeEnv.RATE_LIMIT_MAX_REQUESTS ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS
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
