import request from 'supertest'

import { NotFoundError } from '../src/shared/errors/AppError.js'
import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

describe('prediction endpoints', () => {
  test('prediction routes expose today, top, detail and manual odds contracts', async () => {
    const { logger } = createTestLogger()
    const prediction = {
      id: 1,
      fixtureId: 10,
      market: 'MATCH_RESULT',
      selection: 'HOME',
      recommendation: 'CONSIDER',
      confidenceScore: 76,
      edgePp: 6.2
    }

    const app = createApp({
      env: createTestEnv({
        http: {
          rateLimitWindowMs: 60_000,
          rateLimitMaxRequests: 20
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
      listTodayPredictions: async () => [prediction],
      listTopPredictions: async () => [prediction],
      getPredictionById: async (id) => {
        if (String(id) === '1') {
          return prediction
        }

        throw new NotFoundError('Prediction not found')
      },
      recordManualOdds: async (payload) => ({
        status: 'ok',
        odds: {
          id: 1,
          ...payload
        }
      })
    })

    const todayResponse = await request(app).get('/api/predictions/today')
    expect(todayResponse.status).toBe(200)
    expect(todayResponse.body.data).toHaveLength(1)

    const topResponse = await request(app).get('/api/predictions/top')
    expect(topResponse.status).toBe(200)
    expect(topResponse.body.data[0].id).toBe(1)

    const detailResponse = await request(app).get('/api/predictions/1')
    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.data.selection).toBe('HOME')

    const missingResponse = await request(app).get('/api/predictions/999')
    expect(missingResponse.status).toBe(404)

    const manualOddsResponse = await request(app)
      .post('/api/admin/odds/manual')
      .send({
        fixtureId: 10,
        bookmaker: 'Betano',
        market: 'MATCH_RESULT',
        selection: 'HOME',
        decimalOdds: 2.1,
        enteredBy: 'operator'
      })

    expect(manualOddsResponse.status).toBe(201)
    expect(manualOddsResponse.body.data.status).toBe('ok')
    expect(manualOddsResponse.body.data.odds.bookmaker).toBe('Betano')
  })
})
