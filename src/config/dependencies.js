import { randomUUID } from 'node:crypto'

import { createGetHealthStatusUseCase } from '../application/system/getHealthStatus.js'
import { createGetReadinessStatusUseCase } from '../application/system/getReadinessStatus.js'
import { createRunScheduledSystemCheckUseCase } from '../application/system/runScheduledSystemCheck.js'
import { createGetFixtureByIdUseCase } from '../application/sports/getFixtureById.js'
import { createListCompetitionsUseCase } from '../application/sports/listCompetitions.js'
import { createListTodayFixturesUseCase } from '../application/sports/listTodayFixtures.js'
import { createRunScheduledSportsSyncUseCase } from '../application/sports/runScheduledSportsSync.js'
import { createSyncSportsDataUseCase } from '../application/sports/syncSportsData.js'
import { MySqlReadinessProbe } from './database.js'
import { createCompetitionRepository } from '../infrastructure/database/repositories/CompetitionRepository.js'
import { createFixtureRepository } from '../infrastructure/database/repositories/FixtureRepository.js'
import { createSystemRunRepository } from '../infrastructure/database/repositories/SystemRunRepository.js'
import { createSportsSyncStateRepository } from '../infrastructure/database/repositories/SportsSyncStateRepository.js'
import { createTeamRepository } from '../infrastructure/database/repositories/TeamRepository.js'
import { createMySqlPoolManager } from '../infrastructure/database/mysql/createMySqlPoolManager.js'
import { createLogger } from '../infrastructure/logging/createLogger.js'
import { createScheduler } from '../infrastructure/scheduler/createScheduler.js'
import { createApiFootballClient } from '../infrastructure/sports/apiFootball/createApiFootballClient.js'

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
  const competitionRepository = createCompetitionRepository({ poolManager })
  const teamRepository = createTeamRepository({ poolManager })
  const fixtureRepository = createFixtureRepository({ poolManager })
  const sportsSyncStateRepository = createSportsSyncStateRepository({
    poolManager
  })
  const sportsApiClient = env.sports.configured
    ? createApiFootballClient({
        baseUrl: env.sports.baseUrl,
        apiKey: env.sports.apiKey,
        minIntervalMs: env.sports.minIntervalMs,
        retryAfterFallbackMs: env.sports.retryAfterFallbackMs,
        softLimitPercent: env.sports.softLimitPercent,
        logger: loggerHandle.logger
      })
    : null

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
  const syncSportsData = createSyncSportsDataUseCase({
    logger: loggerHandle.logger,
    sportsApiClient,
    competitionRepository,
    teamRepository,
    fixtureRepository,
    sportsSyncStateRepository,
    databaseConfigured: env.database.configured,
    timezone: env.timezone,
    defaultSeason: env.sports.defaultSeason,
    lookaheadHours: env.sports.sync.lookaheadHours,
    maxFixtures: env.sports.sync.maxFixtures,
    historyMaxPagesPerRun: env.sports.sync.historyMaxPagesPerRun
  })
  const runScheduledSportsSync = createRunScheduledSportsSyncUseCase({
    logger: loggerHandle.logger,
    systemRunRepository,
    syncSportsData,
    generateRunId: randomUUID
  })
  const listCompetitions = createListCompetitionsUseCase({
    competitionRepository
  })
  const listTodayFixtures = createListTodayFixturesUseCase({
    fixtureRepository,
    lookaheadHours: env.sports.sync.lookaheadHours,
    maxFixtures: env.sports.sync.maxFixtures
  })
  const getFixtureById = createGetFixtureByIdUseCase({
    fixtureRepository
  })

  const scheduler = createScheduler({
    enabled: env.scheduler.enabled,
    cronExpression: env.scheduler.cron,
    timezone: env.timezone,
    jobRunner: runScheduledSportsSync,
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
      runScheduledSystemCheck,
      syncSportsData,
      runScheduledSportsSync,
      listCompetitions,
      listTodayFixtures,
      getFixtureById
    }
  }
}
