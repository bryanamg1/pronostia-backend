import { ValidationError } from '../../shared/errors/AppError.js'

export function createSystemRun({
  runId,
  runType,
  status,
  startedAt,
  finishedAt = null
}) {
  if (!runId || !runType || !status || !startedAt) {
    throw new ValidationError('Invalid system run payload')
  }

  return {
    runId,
    runType,
    status,
    startedAt,
    finishedAt
  }
}
