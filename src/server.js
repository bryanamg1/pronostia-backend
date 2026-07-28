import { pathToFileURL } from 'node:url'

import { createRuntime } from './config/index.js'
import { createGracefulShutdown } from './infrastructure/shutdown/createGracefulShutdown.js'
import { createApp } from './presentation/app.js'

export async function startServer(options = {}) {
  const runtime = createRuntime(options)
  const app = createApp({
    env: runtime.env,
    logger: runtime.logger,
    getHealthStatus: runtime.useCases.getHealthStatus,
    getReadinessStatus: runtime.useCases.getReadinessStatus
  })

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(runtime.env.port, () =>
      resolve(listeningServer)
    )
  })

  runtime.scheduler.start()

  const shutdown = createGracefulShutdown({
    server,
    scheduler: runtime.scheduler,
    poolManager: runtime.poolManager,
    logger: runtime.logger
  })

  process.once('SIGINT', () => {
    shutdown('SIGINT').catch(() => {
      process.exitCode = 1
    })
  })
  process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => {
      process.exitCode = 1
    })
  })

  runtime.logger.info('Server started', {
    port: runtime.env.port
  })

  return {
    app,
    server,
    shutdown,
    runtime
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startServer().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
