import cron from 'node-cron'

export function createScheduler({
  enabled,
  cronExpression,
  timezone,
  jobRunner,
  logger,
  schedule = cron.schedule
}) {
  let task = null
  let started = false

  function start() {
    if (!enabled || started) {
      return false
    }

    task = schedule(
      cronExpression,
      async () => {
        await jobRunner()
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
    }
  }
}
