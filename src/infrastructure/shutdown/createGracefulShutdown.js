export function createGracefulShutdown({
  server,
  scheduler,
  poolManager,
  logger
}) {
  let shuttingDown = false
  let shutdownPromise = null

  return async function shutdown(signal = 'manual') {
    if (shutdownPromise) {
      return shutdownPromise
    }

    shuttingDown = true
    logger.info('Graceful shutdown started', { signal })

    shutdownPromise = (async () => {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })
      }

      if (scheduler) {
        await scheduler.stop()
      }

      if (poolManager) {
        await poolManager.close()
      }

      logger.info('Graceful shutdown completed', { signal })
      return true
    })()

    try {
      return await shutdownPromise
    } finally {
      shuttingDown = false
    }
  }
}
