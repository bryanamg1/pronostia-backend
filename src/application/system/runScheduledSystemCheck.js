import { createSystemRun } from '../../domain/system/SystemRun.js'

export function createRunScheduledSystemCheckUseCase({
  logger,
  systemRunRepository,
  generateRunId,
  now = () => new Date()
}) {
  return async function runScheduledSystemCheck() {
    const run = createSystemRun({
      runId: generateRunId(),
      runType: 'SYSTEM_FOUNDATION_CHECK',
      status: 'PREPARED',
      startedAt: now().toISOString()
    })

    if (systemRunRepository?.savePreparedRun) {
      await systemRunRepository.savePreparedRun(run)
    }

    logger.info('Scheduler foundation job executed', {
      runId: run.runId,
      runType: run.runType
    })

    return run
  }
}
