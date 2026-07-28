import { createSystemRun } from '../../domain/system/SystemRun.js'
import { toErrorLogPayload } from '../../shared/utils/sanitize.js'

function mapSyncResultToRunStatus(result) {
  if (
    result.status === 'completed' &&
    result.result === 'no_fixtures_available'
  ) {
    return 'NO_FIXTURES'
  }

  if (result.status === 'completed') {
    return 'COMPLETED'
  }

  if (result.status === 'skipped') {
    return 'SKIPPED'
  }

  return 'PARTIAL'
}

export function createRunScheduledSportsSyncUseCase({
  logger,
  systemRunRepository,
  syncSportsData,
  generateRunId,
  now = () => new Date()
}) {
  return async function runScheduledSportsSync() {
    const startedAt = now().toISOString()
    const run = createSystemRun({
      runId: generateRunId(),
      runType: 'SPORTS_INGESTION',
      status: 'PREPARED',
      startedAt
    })

    if (systemRunRepository?.savePreparedRun) {
      await systemRunRepository.savePreparedRun(run)
    }

    try {
      const result = await syncSportsData({
        trigger: 'scheduler'
      })

      if (systemRunRepository?.markRunFinished) {
        await systemRunRepository.markRunFinished({
          runId: run.runId,
          status: mapSyncResultToRunStatus(result),
          finishedAt: now().toISOString(),
          errorCode: result.stopReason || result.reason || null,
          errorMessage: result.stopReason || result.reason || null
        })
      }

      logger.info('Scheduled sports sync executed', {
        runId: run.runId,
        status: result.status,
        fixturesSelected: result.fixturesSelected
      })

      return {
        run,
        result
      }
    } catch (error) {
      if (systemRunRepository?.markRunFinished) {
        await systemRunRepository.markRunFinished({
          runId: run.runId,
          status: 'FAILED',
          finishedAt: now().toISOString(),
          errorCode: error.code || 'SPORTS_SYNC_FAILED',
          errorMessage: error.message
        })
      }

      logger.error('Scheduled sports sync failed', {
        runId: run.runId,
        error: toErrorLogPayload(error)
      })
      throw error
    }
  }
}
