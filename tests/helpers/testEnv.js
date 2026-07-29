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
    admin: {
      tokenConfigured: true,
      token: 'test-admin-token',
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 20
    },
    sports: {
      configured: false,
      provider: 'api-football',
      baseUrl: 'https://v3.football.api-sports.io',
      apiKey: '',
      defaultSeason: 2026,
      minIntervalMs: 7000,
      retryAfterFallbackMs: 65000,
      softLimitPercent: 80,
      sync: {
        lookaheadHours: 24,
        maxFixtures: 40,
        historyMaxPagesPerRun: 2
      }
    },
    openai: {
      enabled: false,
      configured: false,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-5-mini',
      timeoutMs: 30000,
      budget: {
        monthlyUsd: 20,
        alertPercent: 70,
        degradedPercent: 85,
        hardLimitPercent: 100
      },
      pricing: {
        inputUsdPer1MTokens: 0.25,
        cachedInputUsdPer1MTokens: 0.025,
        outputUsdPer1MTokens: 2
      }
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
