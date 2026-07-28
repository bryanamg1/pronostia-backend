import request from 'supertest'

import { NotFoundError } from '../src/shared/errors/AppError.js'
import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

describe('sports endpoints', () => {
  test('/api/competitions returns the configured competitions contract', async () => {
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
            status: 'ok'
          }
        }
      }),
      listCompetitions: async () => [
        {
          id: 1,
          targetKey: 'laliga',
          providerId: 140,
          name: 'La Liga',
          country: 'Spain',
          season: 2026,
          enabled: true
        }
      ]
    })

    const response = await request(app).get('/api/competitions')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].targetKey).toBe('laliga')
  })

  test('/api/fixtures/today and /api/fixtures/:id expose fixture data and 404s', async () => {
    const { logger } = createTestLogger()
    const fixture = {
      id: 1,
      providerId: 9001,
      kickoffAt: '2026-07-28T10:00:00.000Z',
      status: 'NS',
      homeGoals: null,
      awayGoals: null,
      competition: {
        id: 1,
        targetKey: 'laliga',
        providerId: 140,
        name: 'La Liga',
        country: 'Spain',
        season: 2026
      },
      homeTeam: {
        id: 10,
        providerId: 100,
        name: 'Home'
      },
      awayTeam: {
        id: 11,
        providerId: 101,
        name: 'Away'
      }
    }

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
            status: 'ok'
          }
        }
      }),
      listTodayFixtures: async () => [fixture],
      getFixtureById: async (id) => {
        if (String(id) === '1') {
          return fixture
        }

        throw new NotFoundError('Fixture not found')
      }
    })

    const listResponse = await request(app).get('/api/fixtures/today')
    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data).toHaveLength(1)

    const detailResponse = await request(app).get('/api/fixtures/1')
    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.data.id).toBe(1)

    const missingResponse = await request(app).get('/api/fixtures/999')
    expect(missingResponse.status).toBe(404)
    expect(missingResponse.body.error.code).toBe('NOT_FOUND')
  })
})
