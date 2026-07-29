import request from 'supertest'

import { NotFoundError } from '../src/shared/errors/AppError.js'
import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

describe('prediction endpoints', () => {
  function createPredictionApp(overrides = {}) {
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

    return {
      app: createApp({
        env: createTestEnv({
          http: {
            rateLimitWindowMs: 60_000,
            rateLimitMaxRequests: 20
          },
          ...overrides.env
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
        }),
        explainPrediction: async ({ predictionId, force }) => ({
          status: 'ready',
          predictionId,
          force
        }),
        explainTodayPredictions: async ({ limit } = {}) => ({
          status: 'ok',
          explainablePredictions: 1,
          readyCount: 1,
          fallbackCount: 0,
          limit
        }),
        ...overrides.app
      }),
      prediction
    }
  }

  test('prediction routes expose today, top, detail and manual odds contracts', async () => {
    const { app } = createPredictionApp()

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
      .set('x-admin-token', 'test-admin-token')
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

    const explanationResponse = await request(app)
      .post('/api/admin/predictions/1/explanation')
      .set('x-admin-token', 'test-admin-token')

    expect(explanationResponse.status).toBe(200)
    expect(explanationResponse.body.data.status).toBe('ready')

    const dailyExplanationsResponse = await request(app)
      .post('/api/admin/predictions/explanations/today')
      .set('x-admin-token', 'test-admin-token')

    expect(dailyExplanationsResponse.status).toBe(200)
    expect(dailyExplanationsResponse.body.data.readyCount).toBe(1)
  })

  test('admin explanation routes require authentication', async () => {
    const { app } = createPredictionApp()

    const response = await request(app).post(
      '/api/admin/predictions/1/explanation'
    )

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  test('admin explanation routes reject invalid tokens', async () => {
    const { app } = createPredictionApp()

    const response = await request(app)
      .post('/api/admin/predictions/1/explanation')
      .set('x-admin-token', 'wrong-token')

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  test('admin explanation routes fail closed when admin auth is not configured', async () => {
    const { app } = createPredictionApp({
      env: {
        admin: {
          tokenConfigured: false,
          token: '',
          rateLimitWindowMs: 60_000,
          rateLimitMaxRequests: 20
        }
      }
    })

    const response = await request(app)
      .post('/api/admin/predictions/1/explanation')
      .set('x-admin-token', 'test-admin-token')

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('ADMIN_AUTH_NOT_CONFIGURED')
  })

  test('prediction explanation route validates id and payload', async () => {
    const { app } = createPredictionApp()

    const invalidIdResponse = await request(app)
      .post('/api/admin/predictions/not-a-number/explanation')
      .set('x-admin-token', 'test-admin-token')

    expect(invalidIdResponse.status).toBe(400)
    expect(invalidIdResponse.body.error.code).toBe('VALIDATION_ERROR')

    const invalidBodyResponse = await request(app)
      .post('/api/admin/predictions/1/explanation')
      .set('x-admin-token', 'test-admin-token')
      .send({
        force: 'yes'
      })

    expect(invalidBodyResponse.status).toBe(400)
    expect(invalidBodyResponse.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('today explanations route validates batch limit', async () => {
    const { app } = createPredictionApp()

    const response = await request(app)
      .post('/api/admin/predictions/explanations/today')
      .set('x-admin-token', 'test-admin-token')
      .send({
        limit: 41
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
