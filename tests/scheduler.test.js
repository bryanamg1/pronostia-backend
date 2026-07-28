import { createScheduler } from '../src/infrastructure/scheduler/createScheduler.js'
import { createRunScheduledSystemCheckUseCase } from '../src/application/system/runScheduledSystemCheck.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('scheduler', () => {
  test('disabled scheduler does not register jobs', () => {
    const { logger } = createTestLogger()
    const scheduled = []
    const scheduler = createScheduler({
      enabled: false,
      cronExpression: '0 6 * * *',
      timezone: 'America/Argentina/Buenos_Aires',
      jobRunner: async () => {},
      logger,
      schedule: (...args) => {
        scheduled.push(args)
        return {
          stop() {},
          destroy() {}
        }
      }
    })

    expect(scheduler.start()).toBe(false)
    expect(scheduled).toHaveLength(0)
  })

  test('enabled scheduler registers exactly one job', () => {
    const { logger } = createTestLogger()
    const scheduled = []
    const scheduler = createScheduler({
      enabled: true,
      cronExpression: '0 6 * * *',
      timezone: 'America/Argentina/Buenos_Aires',
      jobRunner: async () => {},
      logger,
      schedule: (...args) => {
        scheduled.push(args)
        return {
          stop() {},
          destroy() {}
        }
      }
    })

    expect(scheduler.start()).toBe(true)
    expect(scheduler.start()).toBe(false)
    expect(scheduled).toHaveLength(1)
  })

  test('scheduler foundation job avoids sports APIs and only logs readiness', async () => {
    const { logger, entries } = createTestLogger()
    const useCase = createRunScheduledSystemCheckUseCase({
      logger,
      systemRunRepository: {
        savePreparedRun: async () => null
      },
      generateRunId: () => 'run-1'
    })

    const result = await useCase()

    expect(result.runId).toBe('run-1')
    expect(
      entries.some((entry) =>
        entry.message.includes('Scheduler foundation job executed')
      )
    ).toBe(true)
  })
})
