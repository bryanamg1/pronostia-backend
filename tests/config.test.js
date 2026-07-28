import { loadEnv } from '../src/config/env.js'
import { ValidationError } from '../src/shared/errors/AppError.js'

describe('configuration', () => {
  test('invalid configuration fails in a controlled way', () => {
    expect(() =>
      loadEnv({
        shouldLoadDotenv: false,
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
          FRONTEND_URL: 'http://localhost:5173',
          LOG_LEVEL: 'info',
          TIMEZONE: 'America/Argentina/Buenos_Aires',
          DB_HOST: 'localhost',
          DB_PORT: '',
          DB_USER: '',
          DB_PASSWORD: '',
          DB_NAME: '',
          SCHEDULER_ENABLED: 'false',
          SCHEDULER_CRON: '0 6 * * *',
          RATE_LIMIT_WINDOW_MS: '1000',
          RATE_LIMIT_MAX_REQUESTS: '100'
        }
      })
    ).toThrow(ValidationError)
  })

  test('valid configuration supports omitted database settings', () => {
    const env = loadEnv({
      shouldLoadDotenv: false,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        FRONTEND_URL: 'http://localhost:5173',
        LOG_LEVEL: 'info',
        TIMEZONE: 'America/Argentina/Buenos_Aires',
        SCHEDULER_ENABLED: 'false',
        SCHEDULER_CRON: '0 6 * * *',
        RATE_LIMIT_WINDOW_MS: '1000',
        RATE_LIMIT_MAX_REQUESTS: '100'
      }
    })

    expect(env.database.configured).toBe(false)
  })
})
