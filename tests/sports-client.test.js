import { jest } from '@jest/globals'

import {
  createApiFootballClient,
  parseRetryAfterMs
} from '../src/infrastructure/sports/apiFootball/createApiFootballClient.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('api-football client', () => {
  test('spaces requests sequentially and tracks quota conservatively', async () => {
    const { logger, entries } = createTestLogger()
    let currentMs = 0
    const sleepCalls = []
    const fetchCalls = []
    const fetchImpl = jest.fn(async (url) => {
      fetchCalls.push({
        url: url.toString(),
        startedAtMs: currentMs
      })

      if (url.toString().includes('/status')) {
        return new Response(
          JSON.stringify({
            response: {
              subscription: {
                plan: 'Free'
              },
              requests: {
                current: 10,
                limit_day: 100
              }
            }
          }),
          {
            status: 200,
            headers: {
              'x-ratelimit-requests-remaining': '90'
            }
          }
        )
      }

      return new Response(JSON.stringify({ response: [] }), {
        status: 200
      })
    })

    const client = createApiFootballClient({
      baseUrl: 'https://example.test',
      apiKey: 'secret-token',
      minIntervalMs: 7000,
      retryAfterFallbackMs: 65000,
      softLimitPercent: 80,
      logger,
      fetchImpl,
      nowMs: () => currentMs,
      sleep: async (ms) => {
        sleepCalls.push(ms)
        currentMs += ms
      }
    })

    await client.getStatus()
    await client.getLeague({
      providerId: 140,
      season: 2026
    })
    await client.getFixturesByDate({
      date: '2026-07-28',
      timezone: 'America/Argentina/Buenos_Aires'
    })

    expect(fetchCalls).toHaveLength(3)
    expect(fetchCalls[1].startedAtMs - fetchCalls[0].startedAtMs).toBe(7000)
    expect(fetchCalls[2].startedAtMs - fetchCalls[1].startedAtMs).toBe(7000)
    expect(sleepCalls).toEqual([7000, 7000])
    expect(client.getQuotaSnapshot()).toMatchObject({
      plan: 'Free',
      current: 10,
      limitDay: 100,
      conservativeCurrent: 12,
      remaining: 88
    })
    expect(JSON.stringify(entries)).not.toContain('secret-token')
  })

  test('uses the daily fixtures date parameter instead of the invalid from/to combination', async () => {
    const { logger } = createTestLogger()
    const fetchImpl = jest.fn(async () => {
      return new Response(JSON.stringify({ response: [] }), {
        status: 200
      })
    })

    const client = createApiFootballClient({
      baseUrl: 'https://example.test',
      apiKey: 'secret-token',
      minIntervalMs: 7000,
      retryAfterFallbackMs: 65000,
      softLimitPercent: 80,
      logger,
      fetchImpl,
      nowMs: () => 0,
      sleep: async () => {}
    })

    await client.getFixturesByDate({
      date: '2026-07-29',
      timezone: 'America/Argentina/Buenos_Aires'
    })

    const requestedUrl = fetchImpl.mock.calls[0][0].toString()
    expect(requestedUrl).toContain('date=2026-07-29')
    expect(requestedUrl).not.toContain('from=')
    expect(requestedUrl).not.toContain('to=')
  })

  test('retries HTTP 429 with retry-after before failing', async () => {
    const { logger } = createTestLogger()
    let currentMs = 0
    const sleepCalls = []
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              subscription: {
                plan: 'Free'
              },
              requests: {
                current: 10,
                limit_day: 100
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'rate limited' }), {
          status: 429,
          headers: {
            'retry-after': '2'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: [] }), {
          status: 200
        })
      )

    const client = createApiFootballClient({
      baseUrl: 'https://example.test',
      apiKey: 'secret-token',
      minIntervalMs: 7000,
      retryAfterFallbackMs: 65000,
      softLimitPercent: 80,
      logger,
      fetchImpl,
      nowMs: () => currentMs,
      sleep: async (ms) => {
        sleepCalls.push(ms)
        currentMs += ms
      }
    })

    await client.getStatus()
    await client.getLeague({
      providerId: 140,
      season: 2026
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleepCalls).toContain(2000)
  })

  test('parses retry-after values from seconds and dates', () => {
    expect(parseRetryAfterMs('3', 0)).toBe(3000)
    expect(
      parseRetryAfterMs(
        'Tue, 28 Jul 2026 00:00:05 GMT',
        Date.parse('Tue, 28 Jul 2026 00:00:00 GMT')
      )
    ).toBe(5000)
  })
})
