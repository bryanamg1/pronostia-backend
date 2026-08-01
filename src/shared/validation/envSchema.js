import { z } from 'zod'

const booleanString = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  return value.toLowerCase() === 'true'
})

const intString = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .pipe(z.number().int().positive())

const floatString = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .pipe(z.number().nonnegative())

export const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: intString,
  FRONTEND_URL: z.string().min(1),
  LOG_LEVEL: z.enum([
    'error',
    'warn',
    'info',
    'http',
    'verbose',
    'debug',
    'silent'
  ]),
  TIMEZONE: z.string().min(1),
  DB_HOST: z.string().optional().default(''),
  DB_PORT: z.union([z.string(), z.number()]).optional().default(''),
  DB_USER: z.string().optional().default(''),
  DB_PASSWORD: z.string().optional().default(''),
  DB_NAME: z.string().optional().default(''),
  SCHEDULER_ENABLED: booleanString,
  SCHEDULER_CRON: z.string().min(1),
  RATE_LIMIT_WINDOW_MS: intString,
  RATE_LIMIT_MAX_REQUESTS: intString,
  CURRENT_FIXTURES_PROVIDER: z.string().optional().default(''),
  CURRENT_FIXTURES_TIMEOUT_MS: intString.optional().default(10000),
  CURRENT_FIXTURES_MAX_RETRIES: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === undefined || value === null || value === '' ? 2 : Number(value)
    )
    .pipe(z.number().int().min(0).max(5)),
  CURRENT_FIXTURES_WINDOW_HOURS: intString.optional().default(24),
  CURRENT_FIXTURES_MAX_MATCHES: intString.optional().default(40),
  SPORTS_API_PROVIDER: z.string().min(1),
  SPORTS_API_BASE_URL: z.string().url(),
  SPORTS_API_KEY: z.string().optional().default(''),
  FOOTBALL_DATA_API_KEY: z.string().optional().default(''),
  SPORTMONKS_API_TOKEN: z.string().optional().default(''),
  SPORTS_DEFAULT_SEASON: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === undefined || value === null || value === ''
        ? null
        : Number(value)
    )
    .pipe(z.number().int().positive().nullable()),
  SPORTS_API_MIN_INTERVAL_MS: intString,
  SPORTS_API_RETRY_AFTER_FALLBACK_MS: intString,
  SPORTS_API_SOFT_LIMIT_PERCENT: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(100)),
  SPORTS_SYNC_LOOKAHEAD_HOURS: intString,
  SPORTS_SYNC_MAX_FIXTURES: intString,
  SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN: intString,
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_ENABLED: booleanString.optional().default(false),
  OPENAI_BASE_URL: z.string().url(),
  OPENAI_MODEL: z.string().min(1),
  OPENAI_MONTHLY_BUDGET_USD: floatString,
  OPENAI_MONTHLY_ALERT_PERCENT: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(100)),
  OPENAI_MONTHLY_DEGRADED_PERCENT: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(100)),
  OPENAI_HARD_LIMIT_PERCENT: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(100)),
  OPENAI_TIMEOUT_MS: intString,
  OPENAI_INPUT_COST_USD_PER_1M_TOKENS: floatString,
  OPENAI_CACHED_INPUT_COST_USD_PER_1M_TOKENS: floatString,
  OPENAI_OUTPUT_COST_USD_PER_1M_TOKENS: floatString,
  OPENAI_EXPLANATION_BATCH_LIMIT: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === undefined || value === null || value === '' ? 5 : Number(value)
    )
    .pipe(z.number().int().min(1).max(20)),
  ADMIN_API_TOKEN: z.string().optional().default(''),
  ADMIN_RATE_LIMIT_WINDOW_MS: intString.optional().default(60000),
  ADMIN_RATE_LIMIT_MAX_REQUESTS: intString.optional().default(20)
})

export function formatEnvError(error) {
  return error.issues.map((issue) => issue.message).join('; ')
}
