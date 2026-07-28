import { createMySqlPoolManager } from '../src/infrastructure/database/mysql/createMySqlPoolManager.js'
import { runMigrationCommand } from '../src/infrastructure/database/migrations/cli.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('database foundation', () => {
  test('application infrastructure can exist without a real MySQL connection', async () => {
    const { logger } = createTestLogger()
    const poolManager = createMySqlPoolManager({
      config: {
        configured: false
      },
      logger
    })

    const readiness = await poolManager.ping()
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.database.status).toBe('not_configured')
  })

  test('pool manager closes safely', async () => {
    const { logger } = createTestLogger()
    const poolManager = createMySqlPoolManager({
      config: {
        configured: false
      },
      logger
    })

    await expect(poolManager.close()).resolves.toBe(false)
    await expect(poolManager.close()).resolves.toBe(false)
  })

  test('migration status can be validated without a configured production database', async () => {
    const { logger } = createTestLogger()
    const writes = []
    const result = await runMigrationCommand({
      command: 'status',
      poolManager: {
        hasConfig: () => false
      },
      logger,
      stdout: {
        write(value) {
          writes.push(value)
        }
      }
    })

    expect(result.databaseConfigured).toBe(false)
    expect(result.pending).toContain('20260728_001_create_system_runs')
    expect(writes).not.toHaveLength(0)
  })
})
