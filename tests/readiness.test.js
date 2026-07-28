import { createGetReadinessStatusUseCase } from '../src/application/system/getReadinessStatus.js'

describe('readiness use case', () => {
  test('returns ok when the database check is available', async () => {
    const useCase = createGetReadinessStatusUseCase({
      environment: 'test',
      readinessProbe: {
        async check() {
          return {
            ready: true,
            checks: {
              database: {
                status: 'ok'
              }
            }
          }
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    await expect(useCase()).resolves.toEqual({
      status: 'ok',
      service: 'pronostia-backend',
      timestamp: '2026-07-28T00:00:00.000Z',
      environment: 'test',
      checks: {
        database: {
          status: 'ok'
        }
      }
    })
  })

  test('returns ok when the database is not configured', async () => {
    const useCase = createGetReadinessStatusUseCase({
      environment: 'test',
      readinessProbe: {
        async check() {
          return {
            ready: true,
            checks: {
              database: {
                status: 'not_configured'
              }
            }
          }
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    const result = await useCase()
    expect(result.status).toBe('ok')
    expect(result.checks.database.status).toBe('not_configured')
  })

  test('returns error when the database check is down', async () => {
    const useCase = createGetReadinessStatusUseCase({
      environment: 'test',
      readinessProbe: {
        async check() {
          return {
            ready: false,
            checks: {
              database: {
                status: 'error'
              }
            }
          }
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    const result = await useCase()
    expect(result.status).toBe('error')
    expect(result.checks.database.status).toBe('error')
  })
})
