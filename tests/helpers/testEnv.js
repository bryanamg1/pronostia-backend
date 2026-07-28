export function createTestEnv(overrides = {}) {
  return {
    nodeEnv: 'test',
    port: 3001,
    frontendUrl: 'http://localhost:5173',
    logLevel: 'info',
    timezone: 'America/Argentina/Buenos_Aires',
    scheduler: {
      enabled: false,
      cron: '0 6 * * *'
    },
    http: {
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 2
    },
    database: {
      configured: false,
      host: '',
      port: 0,
      user: '',
      password: '',
      name: ''
    },
    ...overrides
  }
}
