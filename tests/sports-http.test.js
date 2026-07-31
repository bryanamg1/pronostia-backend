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
          id: null,
          key: 'laliga',
          targetKey: 'laliga',
          name: 'LaLiga',
          country: 'Spain',
          region: null,
          type: 'DOMESTIC_LEAGUE',
          availabilityStatus: 'PARTIAL',
          season: 2026,
          isEnabled: true,
          displayOrder: 0,
          fixtureCount: 1,
          predictionCount: 1,
          historicalFixtureCount: 0,
          hasHistoricalDataOnly: false
        }
      ]
    })

    const response = await request(app).get('/api/competitions')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].providerId).toBeUndefined()
    expect(response.body.data[0].coverage).toBeUndefined()
    expect(response.body.data[0].key).toBe('laliga')
    expect(response.body.data[0].targetKey).toBe('laliga')
    expect(response.body.data[0].fixtureCount).toBe(1)
    expect(response.body.data[0].predictionCount).toBe(1)
  })

  test('/api/fixtures/today and /api/fixtures/:id expose fixture data and 404s', async () => {
    const { logger } = createTestLogger()
    const fixture = {
      id: 1,
      kickoffAt: '2026-07-28T10:00:00.000Z',
      status: 'NS',
      isHistorical: false,
      competition: {
        id: 1,
        key: 'laliga',
        name: 'La Liga',
        country: 'Spain',
        season: 2026
      },
      homeTeam: {
        id: 10,
        key: '10',
        name: 'Home'
      },
      awayTeam: {
        id: 11,
        key: '11',
        name: 'Away'
      },
      prediction: {
        id: 17,
        market: 'MATCH_RESULT',
        selection: 'HOME',
        recommendation: 'CONSIDER',
        confidenceScore: 82
      }
    }
    const fixtureFiltersCalls = []
    const listTodayFixtures = async (filters) => {
      fixtureFiltersCalls.push(filters)

      return [fixture]
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
      listTodayFixtures,
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
    expect(listResponse.body.data[0].prediction.id).toBe(17)
    expect(listResponse.body.data[0].homeTeam.providerId).toBeUndefined()
    expect(listResponse.body.data[0].competition.providerId).toBeUndefined()
    expect(fixtureFiltersCalls[0]).toEqual({
      competition: undefined,
      team: undefined
    })

    const filteredResponse = await request(app).get(
      '/api/fixtures/today?competition=laliga&team=10'
    )
    expect(filteredResponse.status).toBe(200)
    expect(fixtureFiltersCalls.at(-1)).toEqual({
      competition: 'laliga',
      team: '10'
    })

    const detailResponse = await request(app).get('/api/fixtures/1')
    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.data.id).toBe(1)
    expect(detailResponse.body.data.awayTeam.key).toBe('11')

    const missingResponse = await request(app).get('/api/fixtures/999')
    expect(missingResponse.status).toBe(404)
    expect(missingResponse.body.error.code).toBe('NOT_FOUND')
  })
})
