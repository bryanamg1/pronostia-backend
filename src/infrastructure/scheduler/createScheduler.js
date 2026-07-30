import cron from 'node-cron'

import { toErrorLogPayload } from '../../shared/utils/sanitize.js'

export function createScheduler({
  enabled,
  cronExpression,
  timezone,
  jobRunner,
  logger,
  schedule = cron.schedule,
  distributedLockManager = null,
  distributedLockKey = null
}) {
  let task = null
  let started = false
  let running = false

  async function runScheduledJob() {
    if (running) {
      logger.warn(
        'Scheduler skipped because a local run is already in progress'
      )
      return false
    }

    running = true
    let distributedLockHandle = null

    try {
      if (distributedLockManager && distributedLockKey) {
        distributedLockHandle = await distributedLockManager.tryAcquire({
          key: distributedLockKey
        })

        if (!distributedLockHandle) {
          logger.warn(
            'Scheduler skipped because another worker already holds the lock',
            {
              metadata: {
                lockKey: distributedLockKey
              }
            }
          )
          return false
        }
      }

      await jobRunner()
      return true
    } catch (error) {
      logger.error('Scheduler job failed', {
        error: toErrorLogPayload(error),
        lockKey: distributedLockKey
      })
      throw error
    } finally {
      if (distributedLockHandle) {
        await distributedLockManager.release(distributedLockHandle)
      }

      running = false
    }
  }

  function start() {
    if (!enabled || started) {
      return false
    }

    task = schedule(
      cronExpression,
      () => {
        void runScheduledJob()
      },
      {
        timezone
      }
    )

    started = true
    logger.info('Scheduler registered', {
      cronExpression,
      timezone
    })
    return true
  }

  async function stop() {
    if (!task) {
      return false
    }

    task.stop()
    task.destroy()
    task = null
    started = false
    logger.info('Scheduler stopped')
    return true
  }

  return {
    start,
    stop,
    isStarted() {
      return started
    },
    runScheduledJob
  }
}
