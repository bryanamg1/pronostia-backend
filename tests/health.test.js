import request from 'supertest'
import { jest } from '@jest/globals'

import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

describe('health endpoints', () => {
  test('/api/health returns 200 and the expected contract', async () => {
    const { logger } = createTestLogger()
    const app = createApp({
      env: createTestEnv(),
      logger,
      getHealthStatus: () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test'
      }),
      getReadinessStatus: async () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test',
        checks: {
          database: {
            status: 'not_configured'
          }
        }
      })
    })

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test'
      },
      meta: {
        requestId: response.headers['x-request-id']
      }
    })
  })

  test('/api/health/ready uses the readiness abstraction', async () => {
    const { logger } = createTestLogger()
    const readinessProbe = jest.fn(async () => ({
      status: 'ok',
      service: 'pronostia-backend',
      timestamp: '2026-07-28T00:00:00.000Z',
      environment: 'test',
      checks: {
        database: {
          status: 'ok'
        }
      }
    }))

    const app = createApp({
      env: createTestEnv(),
      logger,
      getHealthStatus: () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test'
      }),
      getReadinessStatus: readinessProbe
    })

    const response = await request(app).get('/api/health/ready')

    expect(response.status).toBe(200)
    expect(readinessProbe).toHaveBeenCalledTimes(1)
    expect(response.body.success).toBe(true)
    expect(response.body.data.checks.database.status).toBe('ok')
  })

  test('/api/health/ready returns 503 when readiness is down', async () => {
    const { logger } = createTestLogger()
    const app = createApp({
      env: createTestEnv(),
      logger,
      getHealthStatus: () => ({
        status: 'ok',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test'
      }),
      getReadinessStatus: async () => ({
        status: 'error',
        service: 'pronostia-backend',
        timestamp: '2026-07-28T00:00:00.000Z',
        environment: 'test',
        checks: {
          database: {
            status: 'error'
          }
        }
      })
    })

    const response = await request(app).get('/api/health/ready')

    expect(response.status).toBe(503)
    expect(response.body.success).toBe(true)
    expect(response.body.data.checks.database.status).toBe('error')
  })
})
