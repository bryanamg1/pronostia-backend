export const SUPPORTED_ODDS_MARKETS = {
  MATCH_RESULT: 'MATCH_RESULT',
  OVER_UNDER_2_5: 'OVER_UNDER_2_5',
  BOTH_TEAMS_TO_SCORE: 'BOTH_TEAMS_TO_SCORE',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE'
}

export const MARKET_SELECTIONS = {
  [SUPPORTED_ODDS_MARKETS.MATCH_RESULT]: ['HOME', 'DRAW', 'AWAY'],
  [SUPPORTED_ODDS_MARKETS.OVER_UNDER_2_5]: ['OVER_2_5', 'UNDER_2_5'],
  [SUPPORTED_ODDS_MARKETS.BOTH_TEAMS_TO_SCORE]: ['YES', 'NO'],
  [SUPPORTED_ODDS_MARKETS.DOUBLE_CHANCE]: [
    'HOME_OR_DRAW',
    'DRAW_OR_AWAY',
    'HOME_OR_AWAY'
  ]
}

export const ODDS_SOURCE_TYPES = {
  API: 'API',
  MANUAL: 'MANUAL'
}

export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
}

export const RECOMMENDATION_TYPES = {
  CONSIDER: 'CONSIDER',
  NO_RECOMMENDATION: 'NO_RECOMMENDATION'
}

export const DEFAULT_SCORING_CONFIG = {
  edgeThresholdPp: 5,
  maxNormalizedEdgePp: 15,
  minDataCompletenessPercent: 80,
  staleOddsWarningHours: 24,
  staleOddsMaxHours: 48,
  confidence: {
    dataCompletenessWeight: 30,
    sampleWeight: 20,
    coherenceWeight: 25,
    edgeWeight: 15,
    freshnessWeight: 10
  }
}
