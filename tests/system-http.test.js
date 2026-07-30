import request from 'supertest'

import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

describe('system endpoints', () => {
  test('/api/system/runs/latest returns the latest run contract', async () => {
    const { logger } = createTestLogger()
    const app = createApp({
      env: createTestEnv({
        http: {
          rateLimitWindowMs: 60_000,
          rateLimitMaxRequests: 10
        }
      }),
      logger,
      getHealthStatus: () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-29T00:00:00.000Z',
        environment: 'test'
      }),
      getReadinessStatus: async () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-29T00:00:00.000Z',
        environment: 'test',
        checks: {
          database: {
            status: 'ok'
          }
        }
      }),
      getLatestSystemRun: async () => ({
        runId: 'run-1',
        runType: 'SPORTS_SYNC',
        status: 'COMPLETED',
        startedAt: '2026-07-29T06:00:00.000Z',
        finishedAt: '2026-07-29T06:02:00.000Z',
        errorCode: null
      })
    })

    const response = await request(app).get('/api/system/runs/latest')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.runId).toBe('run-1')
    expect(response.body.data.errorCode).toBeNull()
  })
})
