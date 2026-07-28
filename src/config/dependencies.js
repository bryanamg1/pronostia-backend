import { randomUUID } from 'node:crypto'

import { createGetHealthStatusUseCase } from '../application/system/getHealthStatus.js'
import { createGetReadinessStatusUseCase } from '../application/system/getReadinessStatus.js'
import { createRunScheduledSystemCheckUseCase } from '../application/system/runScheduledSystemCheck.js'
import { MySqlReadinessProbe } from './database.js'
import { createSystemRunRepository } from '../infrastructure/database/repositories/SystemRunRepository.js'
import { createMySqlPoolManager } from '../infrastructure/database/mysql/createMySqlPoolManager.js'
import { createLogger } from '../infrastructure/logging/createLogger.js'
import { createScheduler } from '../infrastructure/scheduler/createScheduler.js'

export function createDependencies({ env, loggerOverride } = {}) {
  const loggerHandle = createLogger(env, {
    logger: loggerOverride
  })
  const poolManager = createMySqlPoolManager({
    config: env.database,
    logger: loggerHandle.logger
  })
  const readinessProbe = new MySqlReadinessProbe(poolManager)
  const systemRunRepository = createSystemRunRepository({ poolManager })

  const getHealthStatus = createGetHealthStatusUseCase({
    environment: env.nodeEnv
  })
  const getReadinessStatus = createGetReadinessStatusUseCase({
    environment: env.nodeEnv,
    readinessProbe
  })
  const runScheduledSystemCheck = createRunScheduledSystemCheckUseCase({
    logger: loggerHandle.logger,
    systemRunRepository,
    generateRunId: randomUUID
  })

  const scheduler = createScheduler({
    enabled: env.scheduler.enabled,
    cronExpression: env.scheduler.cron,
    timezone: env.timezone,
    jobRunner: runScheduledSystemCheck,
    logger: loggerHandle.logger
  })

  return {
    logger: loggerHandle.logger,
    loggerHandle,
    poolManager,
    scheduler,
    useCases: {
      getHealthStatus,
      getReadinessStatus,
      runScheduledSystemCheck
    }
  }
}
