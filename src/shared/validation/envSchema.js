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

export const runtimeEnvSchema = z
  .object({
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
    RATE_LIMIT_MAX_REQUESTS: intString
  })
  .superRefine((env, context) => {
    const dbValues = [
      env.DB_HOST,
      env.DB_PORT,
      env.DB_USER,
      env.DB_PASSWORD,
      env.DB_NAME
    ]
    const provided = dbValues.filter((value) => `${value}`.length > 0).length

    if (provided > 0 && provided < dbValues.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Database configuration must be fully provided or omitted entirely.'
      })
    }
  })

export function formatEnvError(error) {
  return error.issues.map((issue) => issue.message).join('; ')
}
