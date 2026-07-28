import mysql from 'mysql2/promise'

import { InfrastructureError } from '../../../shared/errors/AppError.js'

export function createMySqlPoolManager({
  config,
  logger,
  createPool = mysql.createPool
}) {
  let pool = null
  let closingPromise = null

  function hasConfig() {
    return config.configured
  }

  function getPool() {
    if (!hasConfig()) {
      throw new InfrastructureError('Database is not configured')
    }

    if (!pool) {
      pool = createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.name,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        connectTimeout: 5000
      })
    }

    return pool
  }

  async function ping() {
    if (!hasConfig()) {
      return {
        ready: true,
        checks: {
          database: {
            status: 'not_configured'
          }
        }
      }
    }

    try {
      const activePool = getPool()
      await activePool.query('SELECT 1 AS ok')

      return {
        ready: true,
        checks: {
          database: {
            status: 'ok'
          }
        }
      }
    } catch (error) {
      logger.error('Database readiness failed', {
        error: error.message
      })

      return {
        ready: false,
        checks: {
          database: {
            status: 'error'
          }
        }
      }
    }
  }

  async function close() {
    if (!pool) {
      return false
    }

    if (!closingPromise) {
      closingPromise = pool.end().finally(() => {
        pool = null
        closingPromise = null
      })
    }

    await closingPromise
    return true
  }

  return {
    hasConfig,
    getPool,
    ping,
    close
  }
}
