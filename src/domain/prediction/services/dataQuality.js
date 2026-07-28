import {
  DATA_QUALITY_FLAGS,
  DATA_QUALITY_STATUS,
  SUPPORTED_EVALUATION_STATUSES
} from '../constants/modelDefaults.js'

export function assessPredictionDataQuality({
  fixture,
  homeSampleSize,
  awaySampleSize,
  homeVenueSampleSize,
  awayVenueSampleSize,
  leagueMatchCount,
  config,
  temporalLeakageDetected = false
}) {
  const flags = []

  if (homeSampleSize < config.evaluation.minSamplesPerTeam) {
    flags.push(DATA_QUALITY_FLAGS.LOW_SAMPLE_HOME)
  }

  if (awaySampleSize < config.evaluation.minSamplesPerTeam) {
    flags.push(DATA_QUALITY_FLAGS.LOW_SAMPLE_AWAY)
  }

  if (homeVenueSampleSize === 0 || awayVenueSampleSize === 0) {
    flags.push(DATA_QUALITY_FLAGS.MISSING_HOME_AWAY_SPLIT)
  }

  if (leagueMatchCount === 0) {
    flags.push(DATA_QUALITY_FLAGS.MISSING_COMPETITION_AVERAGES)
  }

  const kickoffAt = new Date(fixture.kickoffAt)
  const stalenessMs = Date.now() - kickoffAt.getTime()
  const maxAgeMs = config.evaluation.staleWindowDays * 24 * 60 * 60 * 1000

  if (stalenessMs > maxAgeMs) {
    flags.push(DATA_QUALITY_FLAGS.STALE_INPUT)
  }

  if (temporalLeakageDetected) {
    flags.push(DATA_QUALITY_FLAGS.TEMPORAL_LEAKAGE_DETECTED)
  }

  if (
    fixture.status &&
    !SUPPORTED_EVALUATION_STATUSES.includes(fixture.status) &&
    fixture.homeGoals !== null &&
    fixture.awayGoals !== null
  ) {
    flags.push(DATA_QUALITY_FLAGS.UNSUPPORTED_STATUS)
  }

  if (
    flags.includes(DATA_QUALITY_FLAGS.TEMPORAL_LEAKAGE_DETECTED) ||
    flags.includes(DATA_QUALITY_FLAGS.UNSUPPORTED_STATUS)
  ) {
    return {
      status: DATA_QUALITY_STATUS.INVALID,
      flags
    }
  }

  if (
    flags.includes(DATA_QUALITY_FLAGS.LOW_SAMPLE_HOME) ||
    flags.includes(DATA_QUALITY_FLAGS.LOW_SAMPLE_AWAY)
  ) {
    return {
      status:
        homeSampleSize === 0 || awaySampleSize === 0
          ? DATA_QUALITY_STATUS.INSUFFICIENT
          : DATA_QUALITY_STATUS.LIMITED,
      flags
    }
  }

  if (
    flags.includes(DATA_QUALITY_FLAGS.MISSING_HOME_AWAY_SPLIT) ||
    flags.includes(DATA_QUALITY_FLAGS.MISSING_COMPETITION_AVERAGES)
  ) {
    return {
      status: DATA_QUALITY_STATUS.LIMITED,
      flags
    }
  }

  return {
    status: DATA_QUALITY_STATUS.SUFFICIENT,
    flags
  }
}
