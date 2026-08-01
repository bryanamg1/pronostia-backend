import { randomUUID } from 'node:crypto'

import { createGetHealthStatusUseCase } from '../application/system/getHealthStatus.js'
import { createGetReadinessStatusUseCase } from '../application/system/getReadinessStatus.js'
import { createGetLatestSystemRunUseCase } from '../application/system/getLatestSystemRun.js'
import { createGenerateScoredPredictionsUseCase } from '../application/prediction/generateScoredPredictions.js'
import { createGetPublicPredictionByIdUseCase } from '../application/prediction/getPublicPredictionById.js'
import { createExplainPredictionUseCase } from '../application/prediction/explainPrediction.js'
import { createExplainTodayPredictionsUseCase } from '../application/prediction/explainTodayPredictions.js'
import { createListPublicTodayPredictionsUseCase } from '../application/prediction/listPublicTodayPredictions.js'
import { createListPublicTopPredictionsUseCase } from '../application/prediction/listPublicTopPredictions.js'
import { createListTodayPredictionsUseCase } from '../application/prediction/listTodayPredictions.js'
import { createListTopPredictionsUseCase } from '../application/prediction/listTopPredictions.js'
import { createRecordManualOddsUseCase } from '../application/prediction/recordManualOdds.js'
import { createPredictionPublicViewService } from '../application/prediction/services/predictionPublicView.js'
import { createEvaluateHistoricalModelUseCase } from '../application/prediction/useCases/evaluateHistoricalModel.js'
import { createGenerateHistoricalPredictionUseCase } from '../application/prediction/useCases/generateHistoricalPrediction.js'
import { createImportHistoricalSeasonUseCase } from '../application/sports/importHistoricalSeason.js'
import { createRunScheduledSystemCheckUseCase } from '../application/system/runScheduledSystemCheck.js'
import { createGetFixtureByIdUseCase } from '../application/sports/getFixtureById.js'
import { createListCompetitionsUseCase } from '../application/sports/listCompetitions.js'
import { createListTodayFixturesUseCase } from '../application/sports/listTodayFixtures.js'
import { createRunCurrentPredictionPilotUseCase } from '../application/sports/runCurrentPredictionPilot.js'
import { createRunScheduledSportsSyncUseCase } from '../application/sports/runScheduledSportsSync.js'
import { createFixturePublicViewService } from '../application/sports/services/fixturePublicView.js'
import { createSyncSportsDataUseCase } from '../application/sports/syncSportsData.js'
import { DEFAULT_PREDICTION_MODEL_CONFIG } from '../domain/prediction/constants/modelDefaults.js'
import { MySqlReadinessProbe } from './database.js'
import { createCompetitionRepository } from '../infrastructure/database/repositories/CompetitionRepository.js'
import { createAnalysisRunRepository } from '../infrastructure/database/repositories/AnalysisRunRepository.js'
import { createFixtureRepository } from '../infrastructure/database/repositories/FixtureRepository.js'
import { createHistoricalPredictionRepository } from '../infrastructure/database/repositories/HistoricalPredictionRepository.js'
import { createManualOddsAuditRepository } from '../infrastructure/database/repositories/ManualOddsAuditRepository.js'
import { createModelEvaluationRepository } from '../infrastructure/database/repositories/ModelEvaluationRepository.js'
import { createModelVersionRepository } from '../infrastructure/database/repositories/ModelVersionRepository.js'
import { createOpenAiUsageRepository } from '../infrastructure/database/repositories/OpenAiUsageRepository.js'
import { createOddsRepository } from '../infrastructure/database/repositories/OddsRepository.js'
import { createPredictionRepository } from '../infrastructure/database/repositories/PredictionRepository.js'
import { createSystemRunRepository } from '../infrastructure/database/repositories/SystemRunRepository.js'
import { createSportsSyncStateRepository } from '../infrastructure/database/repositories/SportsSyncStateRepository.js'
import { createTeamRepository } from '../infrastructure/database/repositories/TeamRepository.js'
import { createMySqlPoolManager } from '../infrastructure/database/mysql/createMySqlPoolManager.js'
import { createMySqlDistributedLockManager } from '../infrastructure/database/mysql/createMySqlDistributedLockManager.js'
import { createLogger } from '../infrastructure/logging/createLogger.js'
import { createOpenAiResponsesClient } from '../infrastructure/openai/createOpenAiResponsesClient.js'
import { createScheduler } from '../infrastructure/scheduler/createScheduler.js'
import { createApiFootballClient } from '../infrastructure/sports/apiFootball/createApiFootballClient.js'

function assertDependencyContract(name, dependency, methods) {
  const missingMethods = methods.filter(
    (methodName) => typeof dependency?.[methodName] !== 'function'
  )

  if (missingMethods.length > 0) {
    throw new Error(
      `Invalid dependency composition: ${name} must implement ${missingMethods.join(', ')}`
    )
  }

  return dependency
}

export function createDependencies({ env, loggerOverride } = {}) {
  const loggerHandle = createLogger(env, {
    logger: loggerOverride
  })
  const poolManager = createMySqlPoolManager({
    config: env.database,
    logger: loggerHandle.logger
  })
  const readinessProbe = new MySqlReadinessProbe(poolManager)
  const distributedLockManager = createMySqlDistributedLockManager({
    poolManager,
    logger: loggerHandle.logger
  })
  const systemRunRepository = createSystemRunRepository({ poolManager })
  const analysisRunRepository = createAnalysisRunRepository({ poolManager })
  const competitionRepository = createCompetitionRepository({ poolManager })
  const teamRepository = createTeamRepository({ poolManager })
  const fixtureRepository = createFixtureRepository({ poolManager })
  const sportsSyncStateRepository = createSportsSyncStateRepository({
    poolManager
  })
  const modelVersionRepository = createModelVersionRepository({ poolManager })
  const historicalPredictionRepository = createHistoricalPredictionRepository({
    poolManager
  })
  const oddsRepository = createOddsRepository({ poolManager })
  const manualOddsAuditRepository = createManualOddsAuditRepository({
    poolManager
  })
  const predictionRepository = createPredictionRepository({ poolManager })
  const openAiUsageRepository = createOpenAiUsageRepository({ poolManager })
  const modelEvaluationRepository = createModelEvaluationRepository({
    poolManager
  })
  const sportsApiClient = env.sports.configured
    ? createApiFootballClient({
        baseUrl: env.sports.baseUrl,
        apiKey: env.sports.apiKey,
        minIntervalMs: env.sports.minIntervalMs,
        retryAfterFallbackMs: env.sports.retryAfterFallbackMs,
        softLimitPercent: env.sports.softLimitPercent,
        timeoutMs: env.sports.timeoutMs,
        maxRetries: env.sports.maxRetries,
        logger: loggerHandle.logger
      })
    : null
  const openAiClient = env.openai.configured
    ? createOpenAiResponsesClient({
        baseUrl: env.openai.baseUrl,
        apiKey: env.openai.apiKey,
        model: env.openai.model,
        timeoutMs: env.openai.timeoutMs,
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
  const getLatestSystemRun = createGetLatestSystemRunUseCase({
    systemRunRepository,
    analysisRunRepository
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
    competitionRepository,
    fixtureRepository,
    predictionRepository,
    lookaheadHours: env.sports.sync.lookaheadHours,
    maxFixtures: env.sports.sync.maxFixtures
  })
  const fixturePublicViewService = assertDependencyContract(
    'fixturePublicViewService',
    createFixturePublicViewService(),
    ['toPublicFixture']
  )
  const importHistoricalSeason = createImportHistoricalSeasonUseCase({
    logger: loggerHandle.logger,
    env,
    competitionRepository,
    teamRepository,
    fixtureRepository,
    sportsSyncStateRepository
  })
  const listTodayFixtures = createListTodayFixturesUseCase({
    fixtureRepository,
    predictionRepository,
    fixturePublicViewService,
    lookaheadHours: env.sports.sync.lookaheadHours,
    maxFixtures: env.sports.sync.maxFixtures
  })
  const getFixtureById = createGetFixtureByIdUseCase({
    fixtureRepository,
    predictionRepository,
    fixturePublicViewService
  })
  const predictionModelConfig = DEFAULT_PREDICTION_MODEL_CONFIG
  const generateHistoricalPrediction =
    createGenerateHistoricalPredictionUseCase({
      fixtureRepository,
      historicalPredictionRepository,
      modelVersionRepository,
      modelConfig: predictionModelConfig
    })
  const evaluateHistoricalModel = createEvaluateHistoricalModelUseCase({
    competitionRepository,
    fixtureRepository,
    modelVersionRepository,
    historicalPredictionRepository,
    modelEvaluationRepository,
    modelConfig: predictionModelConfig
  })
  const recordManualOdds = createRecordManualOddsUseCase({
    fixtureRepository,
    oddsRepository,
    manualOddsAuditRepository
  })
  const generateScoredPredictions = createGenerateScoredPredictionsUseCase({
    generateHistoricalPrediction,
    oddsRepository,
    predictionRepository,
    lookaheadHours: env.sports.sync.lookaheadHours
  })
  const composedRunCurrentPredictionPilot =
    createRunCurrentPredictionPilotUseCase({
      logger: loggerHandle.logger,
      sportsApiClient,
      competitionRepository,
      teamRepository,
      fixtureRepository,
      sportsSyncStateRepository,
      oddsRepository,
      predictionRepository,
      systemRunRepository,
      analysisRunRepository,
      generateScoredPredictions,
      distributedLockManager,
      databaseConfigured: env.database.configured,
      databaseConfig: env.database,
      nodeEnv: env.nodeEnv,
      timezone: env.timezone,
      maxFixtures: env.sports.sync.maxFixtures,
      historyMaxPagesPerRun: env.sports.sync.historyMaxPagesPerRun
    })
  const listStoredTodayPredictions = createListTodayPredictionsUseCase({
    predictionRepository,
    lookaheadHours: env.sports.sync.lookaheadHours
  })
  const listStoredTopPredictions = createListTopPredictionsUseCase({
    listTodayPredictions: listStoredTodayPredictions
  })
  const predictionPublicViewService = createPredictionPublicViewService({
    fixtureRepository,
    modelConfig: predictionModelConfig
  })
  const listTodayPredictions = createListPublicTodayPredictionsUseCase({
    listStoredTodayPredictions,
    predictionPublicViewService
  })
  const listTopPredictions = createListPublicTopPredictionsUseCase({
    listStoredTopPredictions,
    predictionPublicViewService
  })
  const getPredictionById = createGetPublicPredictionByIdUseCase({
    predictionRepository,
    predictionPublicViewService
  })
  const explainPrediction = createExplainPredictionUseCase({
    predictionRepository,
    generateHistoricalPrediction,
    openAiUsageRepository,
    openAiClient,
    openAiConfig: env.openai,
    distributedLockManager,
    logger: loggerHandle.logger
  })
  const explainTodayPredictions = createExplainTodayPredictionsUseCase({
    listTodayPredictions: listStoredTodayPredictions,
    explainPrediction,
    maxBatchSize: env.sports.sync.maxFixtures
  })

  const scheduler = createScheduler({
    enabled: env.scheduler.enabled,
    cronExpression: env.scheduler.cron,
    timezone: env.timezone,
    jobRunner: runScheduledSportsSync,
    distributedLockManager,
    distributedLockKey: 'scheduler:sports-ingestion',
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
      getLatestSystemRun,
      runScheduledSystemCheck,
      syncSportsData,
      runCurrentPredictionPilot: composedRunCurrentPredictionPilot,
      runScheduledSportsSync,
      importHistoricalSeason,
      listCompetitions,
      listTodayFixtures,
      getFixtureById,
      generateHistoricalPrediction,
      evaluateHistoricalModel,
      recordManualOdds,
      generateScoredPredictions,
      listTodayPredictions,
      listTopPredictions,
      getPredictionById,
      explainPrediction,
      explainTodayPredictions
    }
  }
}
