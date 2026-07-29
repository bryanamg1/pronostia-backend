export const SUPPORTED_EVALUATION_STATUSES = ['FT', 'AET', 'PEN']

export const DATA_QUALITY_STATUS = {
  SUFFICIENT: 'SUFFICIENT',
  LIMITED: 'LIMITED',
  INSUFFICIENT: 'INSUFFICIENT',
  INVALID: 'INVALID'
}

export const DATA_QUALITY_FLAGS = {
  LOW_SAMPLE_HOME: 'LOW_SAMPLE_HOME',
  LOW_SAMPLE_AWAY: 'LOW_SAMPLE_AWAY',
  MISSING_HOME_AWAY_SPLIT: 'MISSING_HOME_AWAY_SPLIT',
  MISSING_COMPETITION_AVERAGES: 'MISSING_COMPETITION_AVERAGES',
  STALE_INPUT: 'STALE_INPUT',
  TEMPORAL_LEAKAGE_DETECTED: 'TEMPORAL_LEAKAGE_DETECTED',
  UNSUPPORTED_STATUS: 'UNSUPPORTED_STATUS'
}

export const MODEL_TYPES = {
  DETERMINISTIC_HISTORICAL: 'DETERMINISTIC_HISTORICAL'
}

export const INITIAL_HEURISTIC_WEIGHTS = {
  poisson: 0.6,
  elo: 0.25,
  form: 0.15
}

export const DEFAULT_PREDICTION_MODEL_CONFIG = {
  modelVersion: 'historical-first-v1',
  modelType: MODEL_TYPES.DETERMINISTIC_HISTORICAL,
  prediction: {
    maxGoals: 8,
    minExpectedGoals: 0.2,
    maxExpectedGoals: 4.5,
    equalKickoffOrdering: 'kickoff_at ASC, fixture_id ASC',
    sameKickoffRule: 'Fixtures with identical kickoff use ascending fixture id.'
  },
  elo: {
    initialRating: 1500,
    kFactor: 24,
    homeAdvantage: 55,
    seasonRegressionFactor: 0.25
  },
  form: {
    windowSize: 5,
    weights: [1, 0.85, 0.7, 0.55, 0.4],
    minSampleSize: 3,
    venueWeight: 0.15,
    opponentEloWeight: 0.1
  },
  blend: {
    weights: INITIAL_HEURISTIC_WEIGHTS,
    edgeShareScale: 0.18,
    homeAdvantageShareBoost: 0.03
  },
  evaluation: {
    minFixturesForEvaluation: 20,
    minSamplesPerTeam: 3,
    staleWindowDays: 400
  },
  tolerance: {
    probability: 1e-6
  }
}
