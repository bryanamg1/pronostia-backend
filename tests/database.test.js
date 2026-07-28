import { createMySqlPoolManager } from '../src/infrastructure/database/mysql/createMySqlPoolManager.js'
import {
  runMigrationCommand,
  sanitizeMigrationErrorMessage
} from '../src/infrastructure/database/migrations/cli.js'
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

  test('pool creation remains lazy until a database action requests it', () => {
    const { logger } = createTestLogger()
    let createPoolCalls = 0

    createMySqlPoolManager({
      config: {
        configured: true,
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        name: 'pronostia'
      },
      logger,
      createPool() {
        createPoolCalls += 1
        return {
          async query() {
            return [[], []]
          },
          async end() {}
        }
      }
    })

    expect(createPoolCalls).toBe(0)
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

  test('database ping reports a down database without exposing credentials', async () => {
    const { logger, entries } = createTestLogger()
    let createPoolCalls = 0
    const poolManager = createMySqlPoolManager({
      config: {
        configured: true,
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        name: 'pronostia'
      },
      logger,
      createPool() {
        createPoolCalls += 1

        return {
          async query() {
            throw new Error(
              'connect ECONNREFUSED localhost:3306 password=secret'
            )
          },
          async end() {}
        }
      }
    })

    const readiness = await poolManager.ping()

    expect(createPoolCalls).toBe(1)
    expect(readiness.ready).toBe(false)
    expect(readiness.checks.database.status).toBe('error')
    expect(JSON.stringify(entries)).not.toContain('secret')
  })

  test('migration runner reports already applied migrations and remains idempotent', async () => {
    const { logger } = createTestLogger()
    const writes = []
    const appliedIds = new Set()
    const executedStatements = []

    const fakePool = {
      async query(sql, params = []) {
        executedStatements.push(sql)

        if (sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return [[], []]
        }

        if (sql.includes('SELECT id FROM schema_migrations')) {
          return [[...appliedIds].map((id) => ({ id })), []]
        }

        if (sql.includes('INSERT INTO schema_migrations')) {
          appliedIds.add(params[0])
          return [[], []]
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS system_runs')) {
          return [[], []]
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS competitions')) {
          return [[], []]
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS teams')) {
          return [[], []]
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS fixtures')) {
          return [[], []]
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS sports_sync_state')) {
          return [[], []]
        }

        throw new Error(`Unexpected SQL: ${sql}`)
      }
    }

    const poolManager = {
      hasConfig: () => true,
      getPool: () => fakePool
    }

    const firstRun = await runMigrationCommand({
      command: 'up',
      poolManager,
      logger,
      stdout: {
        write(value) {
          writes.push(value)
        }
      }
    })

    const secondRun = await runMigrationCommand({
      command: 'up',
      poolManager,
      logger,
      stdout: {
        write(value) {
          writes.push(value)
        }
      }
    })

    const status = await runMigrationCommand({
      command: 'status',
      poolManager,
      logger,
      stdout: {
        write(value) {
          writes.push(value)
        }
      }
    })

    expect(firstRun.appliedNow).toContain('20260728_001_create_system_runs')
    expect(secondRun.appliedNow).toEqual([])
    expect(status.applied).toContain('20260728_001_create_system_runs')
    expect(status.pending).toEqual([])
    expect(
      executedStatements.filter((statement) =>
        statement.includes('CREATE TABLE IF NOT EXISTS system_runs')
      )
    ).toHaveLength(1)
    expect(
      executedStatements.filter((statement) =>
        statement.includes('CREATE TABLE IF NOT EXISTS competitions')
      )
    ).toHaveLength(1)
    expect(
      executedStatements.filter((statement) =>
        statement.includes('CREATE TABLE IF NOT EXISTS fixtures')
      )
    ).toHaveLength(1)
    expect(writes.length).toBeGreaterThan(0)
  })

  test('migration errors are sanitized before being reported', () => {
    const sanitized = sanitizeMigrationErrorMessage(
      'Access denied using password: secret and mysql://root:secret@localhost:3306/pronostia'
    )

    expect(sanitized).not.toContain('secret')
    expect(sanitized).toContain('[REDACTED]')
  })
})
