import request from 'supertest'

import { createApp } from '../src/presentation/app.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { createTestEnv } from './helpers/testEnv.js'

function createTestApp({
  envOverrides = {},
  enableTestRoutes = true,
  jsonLimit = '1kb'
} = {}) {
  const { logger, entries } = createTestLogger()

  const app = createApp({
    env: createTestEnv(envOverrides),
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
    }),
    enableTestRoutes,
    jsonLimit
  })

  return { app, entries }
}

describe('http foundation', () => {
  test('request ids are generated and returned in headers', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/health')

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  test('helmet sets security headers', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/health')

    expect(response.headers['x-dns-prefetch-control']).toBe('off')
  })

  test('cors respects the configured origin', async () => {
    const { app } = createTestApp()
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173'
    )
  })

  test('rate limiting is configured', async () => {
    const { app } = createTestApp()

    await request(app).get('/api/health')
    await request(app).get('/api/health')
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(429)
  })

  test('payloads over the configured limit are rejected', async () => {
    const { app } = createTestApp({ jsonLimit: '50b' })
    const response = await request(app)
      .post('/api/unknown')
      .send({
        value: 'x'.repeat(200)
      })

    expect(response.status).toBe(413)
  })

  test('unknown routes return a uniform 404 contract', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/missing')

    expect(response.status).toBe(404)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(response.body.error.requestId).toBe(response.headers['x-request-id'])
  })

  test('controlled errors pass through the central error middleware', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/test/controlled-error')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.message).toBe('Controlled validation failure')
  })

  test('unexpected errors do not expose secrets', async () => {
    const { app } = createTestApp()
    const response = await request(app).get('/api/test/unexpected-error')

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('INTERNAL_ERROR')
    expect(response.body.error.message).toBe('Internal server error')
    expect(JSON.stringify(response.body)).not.toContain('secret')
  })

  test('http logs are sanitized', async () => {
    const { app, entries } = createTestApp()

    await request(app).get('/api/health').set('Authorization', 'Bearer abc123')

    const httpEntry = entries.find((entry) => entry.level === 'http')
    expect(httpEntry).toBeDefined()
    expect(JSON.stringify(httpEntry)).not.toContain('abc123')
  })
})
