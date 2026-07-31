import { jest } from '@jest/globals'

import { createMySqlDistributedLockManager } from '../src/infrastructure/database/mysql/createMySqlDistributedLockManager.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('distributed lock manager', () => {
  test('acquires and releases a named lock over a dedicated connection', async () => {
    const release = jest.fn()
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[{ released: 1 }]]),
      release
    }
    const manager = createMySqlDistributedLockManager({
      poolManager: {
        hasConfig: () => true,
        getPool: () => ({
          getConnection: async () => connection
        })
      },
      logger: createTestLogger().logger
    })

    const handle = await manager.tryAcquire({
      key: 'prediction:17:explain'
    })

    expect(handle).toEqual(
      expect.objectContaining({
        key: 'prediction:17:explain',
        connection
      })
    )

    const released = await manager.release(handle)

    expect(released).toBe(true)
    expect(connection.query).toHaveBeenNthCalledWith(
      1,
      'SELECT GET_LOCK(?, ?) AS acquired',
      [expect.stringMatching(/^pronostia:/), 0]
    )
    expect(connection.query).toHaveBeenNthCalledWith(
      2,
      'SELECT RELEASE_LOCK(?) AS released',
      [expect.stringMatching(/^pronostia:/)]
    )
    expect(release).toHaveBeenCalledTimes(1)
  })

  test('returns null when the lock is already held elsewhere', async () => {
    const release = jest.fn()
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[{ acquired: 0 }]]),
      release
    }
    const manager = createMySqlDistributedLockManager({
      poolManager: {
        hasConfig: () => true,
        getPool: () => ({
          getConnection: async () => connection
        })
      },
      logger: createTestLogger().logger
    })

    const handle = await manager.tryAcquire({
      key: 'scheduler:sports-ingestion'
    })

    expect(handle).toBeNull()
    expect(release).toHaveBeenCalledTimes(1)
  })

  test('returns null when no database is configured', async () => {
    const manager = createMySqlDistributedLockManager({
      poolManager: {
        hasConfig: () => false
      },
      logger: createTestLogger().logger
    })

    await expect(
      manager.tryAcquire({
        key: 'scheduler:sports-ingestion'
      })
    ).resolves.toBeNull()
  })
})
