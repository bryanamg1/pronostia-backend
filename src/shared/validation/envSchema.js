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
  SPORTS_API_PROVIDER: z.string().min(1),
  SPORTS_API_BASE_URL: z.string().url(),
  SPORTS_API_KEY: z.string().optional().default(''),
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
  SPORTS_SYNC_HISTORY_MAX_PAGES_PER_RUN: intString
})

export function formatEnvError(error) {
  return error.issues.map((issue) => issue.message).join('; ')
}
