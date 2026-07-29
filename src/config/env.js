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
import {
  DEFAULT_SPORTS_API_BASE_URL,
  DEFAULT_SPORTS_API_MIN_INTERVAL_MS,
  DEFAULT_SPORTS_API_PROVIDER,
  DEFAULT_SPORTS_API_RETRY_AFTER_FALLBACK_MS,
  DEFAULT_SPORTS_API_SOFT_LIMIT_PERCENT,
  DEFAULT_SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN,
  DEFAULT_SPORTS_SYNC_LOOKAHEAD_HOURS,
  DEFAULT_SPORTS_SYNC_MAX_FIXTURES
} from '../shared/constants/sports.js'
import {
  DEFAULT_OPENAI_ALERT_PERCENT,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS,
  DEFAULT_OPENAI_DEGRADED_PERCENT,
  DEFAULT_OPENAI_HARD_LIMIT_PERCENT,
  DEFAULT_OPENAI_INPUT_COST_USD_PER_1M_TOKENS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_MONTHLY_BUDGET_USD,
  DEFAULT_OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS,
  DEFAULT_OPENAI_TIMEOUT_MS
} from '../shared/constants/openai.js'

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
  const defaultSportsSeason = new Date().getUTCFullYear()

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
      runtimeEnv.RATE_LIMIT_MAX_REQUESTS ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS,
    SPORTS_API_PROVIDER:
      runtimeEnv.SPORTS_API_PROVIDER ?? DEFAULT_SPORTS_API_PROVIDER,
    SPORTS_API_BASE_URL:
      runtimeEnv.SPORTS_API_BASE_URL ?? DEFAULT_SPORTS_API_BASE_URL,
    SPORTS_API_KEY: runtimeEnv.SPORTS_API_KEY ?? '',
    SPORTS_DEFAULT_SEASON:
      runtimeEnv.SPORTS_DEFAULT_SEASON ?? defaultSportsSeason,
    SPORTS_API_MIN_INTERVAL_MS:
      runtimeEnv.SPORTS_API_MIN_INTERVAL_MS ??
      DEFAULT_SPORTS_API_MIN_INTERVAL_MS,
    SPORTS_API_RETRY_AFTER_FALLBACK_MS:
      runtimeEnv.SPORTS_API_RETRY_AFTER_FALLBACK_MS ??
      DEFAULT_SPORTS_API_RETRY_AFTER_FALLBACK_MS,
    SPORTS_API_SOFT_LIMIT_PERCENT:
      runtimeEnv.SPORTS_API_SOFT_LIMIT_PERCENT ??
      DEFAULT_SPORTS_API_SOFT_LIMIT_PERCENT,
    SPORTS_SYNC_LOOKAHEAD_HOURS:
      runtimeEnv.SPORTS_SYNC_LOOKAHEAD_HOURS ??
      DEFAULT_SPORTS_SYNC_LOOKAHEAD_HOURS,
    SPORTS_SYNC_MAX_FIXTURES:
      runtimeEnv.SPORTS_SYNC_MAX_FIXTURES ?? DEFAULT_SPORTS_SYNC_MAX_FIXTURES,
    SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN:
      runtimeEnv.SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN ??
      DEFAULT_SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN,
    OPENAI_API_KEY: runtimeEnv.OPENAI_API_KEY ?? '',
    OPENAI_ENABLED: runtimeEnv.OPENAI_ENABLED ?? false,
    OPENAI_BASE_URL: runtimeEnv.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    OPENAI_MODEL: runtimeEnv.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    OPENAI_MONTHLY_BUDGET_USD:
      runtimeEnv.OPENAI_MONTHLY_BUDGET_USD ?? DEFAULT_OPENAI_MONTHLY_BUDGET_USD,
    OPENAI_MONTHLY_ALERT_PERCENT:
      runtimeEnv.OPENAI_MONTHLY_ALERT_PERCENT ?? DEFAULT_OPENAI_ALERT_PERCENT,
    OPENAI_MONTHLY_DEGRADED_PERCENT:
      runtimeEnv.OPENAI_MONTHLY_DEGRADED_PERCENT ??
      DEFAULT_OPENAI_DEGRADED_PERCENT,
    OPENAI_HARD_LIMIT_PERCENT:
      runtimeEnv.OPENAI_HARD_LIMIT_PERCENT ?? DEFAULT_OPENAI_HARD_LIMIT_PERCENT,
    OPENAI_TIMEOUT_MS:
      runtimeEnv.OPENAI_TIMEOUT_MS ?? DEFAULT_OPENAI_TIMEOUT_MS,
    OPENAI_INPUT_COST_USD_PER_1M_TOKENS:
      runtimeEnv.OPENAI_INPUT_COST_USD_PER_1M_TOKENS ??
      DEFAULT_OPENAI_INPUT_COST_USD_PER_1M_TOKENS,
    OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS:
      runtimeEnv.OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS ??
      DEFAULT_OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS,
    OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS:
      runtimeEnv.OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS ??
      DEFAULT_OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS,
    ADMIN_API_TOKEN: runtimeEnv.ADMIN_API_TOKEN ?? '',
    ADMIN_RATE_LIMIT_WINDOW_MS: runtimeEnv.ADMIN_RATE_LIMIT_WINDOW_MS ?? 60000,
    ADMIN_RATE_LIMIT_MAX_REQUESTS:
      runtimeEnv.ADMIN_RATE_LIMIT_MAX_REQUESTS ?? 20
  })

  if (!parsed.success) {
    throw new ValidationError(
      `Invalid environment configuration: ${formatEnvError(parsed.error)}`
    )
  }

  if (
    parsed.data.OPENAI_MONTHLY_DEGRADED_PERCENT <
    parsed.data.OPENAI_MONTHLY_ALERT_PERCENT
  ) {
    throw new ValidationError(
      'Invalid environment configuration: OPENAI_MONTHLY_DEGRADED_PERCENT must be greater than or equal to OPENAI_MONTHLY_ALERT_PERCENT'
    )
  }

  if (
    parsed.data.OPENAI_HARD_LIMIT_PERCENT <
    parsed.data.OPENAI_MONTHLY_DEGRADED_PERCENT
  ) {
    throw new ValidationError(
      'Invalid environment configuration: OPENAI_HARD_LIMIT_PERCENT must be greater than or equal to OPENAI_MONTHLY_DEGRADED_PERCENT'
    )
  }

  if (parsed.data.OPENAI_ENABLED && !parsed.data.OPENAI_MODEL) {
    throw new ValidationError(
      'Invalid environment configuration: OPENAI_MODEL is required when OPENAI_ENABLED=true'
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
    sports: {
      configured: Boolean(parsed.data.SPORTS_API_KEY),
      provider: parsed.data.SPORTS_API_PROVIDER,
      baseUrl: parsed.data.SPORTS_API_BASE_URL,
      apiKey: parsed.data.SPORTS_API_KEY,
      defaultSeason: parsed.data.SPORTS_DEFAULT_SEASON,
      minIntervalMs: parsed.data.SPORTS_API_MIN_INTERVAL_MS,
      retryAfterFallbackMs: parsed.data.SPORTS_API_RETRY_AFTER_FALLBACK_MS,
      softLimitPercent: parsed.data.SPORTS_API_SOFT_LIMIT_PERCENT,
      sync: {
        lookaheadHours: parsed.data.SPORTS_SYNC_LOOKAHEAD_HOURS,
        maxFixtures: parsed.data.SPORTS_SYNC_MAX_FIXTURES,
        historyMaxPagesPerRun: parsed.data.SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN
      }
    },
    database: {
      configured: hasDatabaseConfig,
      host: parsed.data.DB_HOST,
      port: Number(parsed.data.DB_PORT || 0),
      user: parsed.data.DB_USER,
      password: parsed.data.DB_PASSWORD,
      name: parsed.data.DB_NAME
    },
    admin: {
      tokenConfigured: Boolean(parsed.data.ADMIN_API_TOKEN),
      token: parsed.data.ADMIN_API_TOKEN,
      rateLimitWindowMs: parsed.data.ADMIN_RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: parsed.data.ADMIN_RATE_LIMIT_MAX_REQUESTS
    },
    openai: {
      enabled: parsed.data.OPENAI_ENABLED,
      configured:
        parsed.data.OPENAI_ENABLED && Boolean(parsed.data.OPENAI_API_KEY),
      baseUrl: parsed.data.OPENAI_BASE_URL,
      apiKey: parsed.data.OPENAI_API_KEY,
      model: parsed.data.OPENAI_MODEL,
      timeoutMs: parsed.data.OPENAI_TIMEOUT_MS,
      budget: {
        monthlyUsd: parsed.data.OPENAI_MONTHLY_BUDGET_USD,
        alertPercent: parsed.data.OPENAI_MONTHLY_ALERT_PERCENT,
        degradedPercent: parsed.data.OPENAI_MONTHLY_DEGRADED_PERCENT,
        hardLimitPercent: parsed.data.OPENAI_HARD_LIMIT_PERCENT
      },
      pricing: {
        inputUsdPer1MTokens: parsed.data.OPENAI_INPUT_COST_USD_PER_1M_TOKENS,
        cachedInputUsdPer1MTokens:
          parsed.data.OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS,
        outputUsdPer1MTokens: parsed.data.OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS
      }
    }
  }
}
