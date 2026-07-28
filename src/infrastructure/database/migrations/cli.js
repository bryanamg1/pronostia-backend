import { loadEnv } from '../../../config/env.js'
import { createLogger } from '../../logging/createLogger.js'
import { createMySqlPoolManager } from '../mysql/createMySqlPoolManager.js'
import { migrations } from './migrations.js'

export function sanitizeMigrationErrorMessage(message = '') {
  return message
    .replace(/password:\s*[^)\r\n]+/gi, 'password: [REDACTED]')
    .replace(/\/\/([^:@\s]+):([^@\/\s]+)@/g, '//[REDACTED]:[REDACTED]@')
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
}

export async function runMigrationCommand({
  command,
  poolManager,
  logger,
  stdout = process.stdout
}) {
  if (!poolManager.hasConfig()) {
    const result = {
      command,
      databaseConfigured: false,
      applied: [],
      pending: migrations.map((migration) => migration.id)
    }

    stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result
  }

  const pool = poolManager.getPool()
  await ensureMigrationsTable(pool)

  const [rows] = await pool.query(
    'SELECT id FROM schema_migrations ORDER BY id ASC'
  )
  const appliedIds = new Set(rows.map((row) => row.id))
  const pendingMigrations = migrations.filter(
    (migration) => !appliedIds.has(migration.id)
  )

  if (command === 'status') {
    const result = {
      command,
      databaseConfigured: true,
      applied: migrations
        .filter((migration) => appliedIds.has(migration.id))
        .map((migration) => migration.id),
      pending: pendingMigrations.map((migration) => migration.id)
    }

    stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result
  }

  if (command !== 'up') {
    throw new Error(`Unsupported migration command: ${command}`)
  }

  for (const migration of pendingMigrations) {
    logger.info('Applying migration', {
      migrationId: migration.id
    })

    await pool.query(migration.up)
    await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [
      migration.id
    ])
  }

  const result = {
    command,
    databaseConfigured: true,
    appliedNow: pendingMigrations.map((migration) => migration.id)
  }

  stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function main() {
  const command = process.argv[2] ?? 'status'
  const env = loadEnv({
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      FRONTEND_URL: 'http://localhost:5173',
      LOG_LEVEL: 'info',
      TIMEZONE: 'America/Argentina/Buenos_Aires',
      SCHEDULER_ENABLED: 'false',
      SCHEDULER_CRON: '0 6 * * *',
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX_REQUESTS: '100',
      ...process.env
    }
  })
  const loggerHandle = createLogger(env)
  const poolManager = createMySqlPoolManager({
    config: env.database,
    logger: loggerHandle.logger
  })

  try {
    await runMigrationCommand({
      command,
      poolManager,
      logger: loggerHandle.logger
    })
  } finally {
    await poolManager.close()
    await loggerHandle.close()
  }
}

if (process.argv[1]?.endsWith('cli.js')) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify(
        {
          code: 'MIGRATION_COMMAND_FAILED',
          message: sanitizeMigrationErrorMessage(error.message)
        },
        null,
        2
      )}\n`
    )
    process.exitCode = 1
  })
}
