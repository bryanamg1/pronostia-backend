import { createGracefulShutdown } from '../src/infrastructure/shutdown/createGracefulShutdown.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('graceful shutdown', () => {
  test('shutdown avoids duplicated executions', async () => {
    const { logger } = createTestLogger()
    let serverCloseCalls = 0
    let schedulerStopCalls = 0
    let poolCloseCalls = 0

    const shutdown = createGracefulShutdown({
      server: {
        close(callback) {
          serverCloseCalls += 1
          callback()
        }
      },
      scheduler: {
        async stop() {
          schedulerStopCalls += 1
        }
      },
      poolManager: {
        async close() {
          poolCloseCalls += 1
        }
      },
      logger
    })

    await Promise.all([shutdown('SIGINT'), shutdown('SIGTERM')])

    expect(serverCloseCalls).toBe(1)
    expect(schedulerStopCalls).toBe(1)
    expect(poolCloseCalls).toBe(1)
  })
})
