import { createHash } from 'node:crypto'

import { toErrorLogPayload } from '../../../shared/utils/sanitize.js'

const LOCK_NAME_PREFIX = 'pronostia:'
const LOCK_NAME_HASH_LENGTH = 48

function buildLockName(key) {
  const hash = createHash('sha256').update(String(key)).digest('hex')
  return `${LOCK_NAME_PREFIX}${hash.slice(0, LOCK_NAME_HASH_LENGTH)}`
}

export function createMySqlDistributedLockManager({ poolManager, logger }) {
  return {
    async tryAcquire({ key, timeoutSeconds = 0 }) {
      if (!poolManager?.hasConfig?.()) {
        return null
      }

      const pool = poolManager.getPool()
      const connection = await pool.getConnection()
      const lockName = buildLockName(key)

      try {
        const [rows] = await connection.query(
          'SELECT GET_LOCK(?, ?) AS acquired',
          [lockName, timeoutSeconds]
        )
        const acquired = Number(rows?.[0]?.acquired ?? 0) === 1

        if (!acquired) {
          connection.release()
          return null
        }

        return {
          key,
          lockName,
          connection
        }
      } catch (error) {
        connection.release()
        logger?.warn?.('Distributed lock acquisition failed', {
          metadata: {
            lockKey: key,
            error: toErrorLogPayload(error)
          }
        })
        throw error
      }
    },

    async release(handle) {
      if (!handle?.connection || !handle?.lockName) {
        return false
      }

      try {
        const [rows] = await handle.connection.query(
          'SELECT RELEASE_LOCK(?) AS released',
          [handle.lockName]
        )

        return Number(rows?.[0]?.released ?? 0) === 1
      } catch (error) {
        logger?.warn?.('Distributed lock release failed', {
          metadata: {
            lockKey: handle.key,
            error: toErrorLogPayload(error)
          }
        })
        return false
      } finally {
        handle.connection.release()
      }
    },

    buildLockName
  }
}
