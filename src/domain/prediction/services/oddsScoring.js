import { clamp, safeDivide } from '../../../shared/math/probability.js'
import { DATA_QUALITY_STATUS } from '../constants/modelDefaults.js'
import {
  DEFAULT_SCORING_CONFIG,
  MARKET_SELECTIONS,
  ODDS_SOURCE_TYPES,
  RECOMMENDATION_TYPES,
  RISK_LEVELS
} from '../constants/scoringDefaults.js'

function sortByCapturedAtDescending(left, right) {
  return Date.parse(right.capturedAt) - Date.parse(left.capturedAt)
}

function getSourceRank(sourceType) {
  return sourceType === ODDS_SOURCE_TYPES.MANUAL ? 2 : 1
}

function getRequiredSelections(market) {
  return MARKET_SELECTIONS[market] ?? []
}

function getRawImpliedProbability(decimalOdds) {
  return safeDivide(1, decimalOdds, 0)
}

function allSelectionsShareSnapshot(selections) {
  if (selections.length <= 1) {
    return true
  }

  const reference = selections[0]?.capturedAt ?? null

  return selections.every((selection) => selection.capturedAt === reference)
}

export function mapModelProbabilityByMarket(probabilities, market, selection) {
  switch (market) {
    case 'MATCH_RESULT':
      return (
        {
          HOME: probabilities.homeWin,
          DRAW: probabilities.draw,
          AWAY: probabilities.awayWin
        }[selection] ?? null
      )
    case 'OVER_UNDER_2_5':
      return (
        {
          OVER_2_5: probabilities.over25,
          UNDER_2_5: probabilities.under25
        }[selection] ?? null
      )
    case 'BOTH_TEAMS_TO_SCORE':
      return (
        {
          YES: probabilities.bttsYes,
          NO: probabilities.bttsNo
        }[selection] ?? null
      )
    case 'DOUBLE_CHANCE':
      return (
        {
          HOME_OR_DRAW: probabilities.doubleChance1X,
          DRAW_OR_AWAY: probabilities.doubleChanceX2,
          HOME_OR_AWAY: probabilities.doubleChance12
        }[selection] ?? null
      )
    default:
      return null
  }
}

function buildExclusiveOddsGroup(rows) {
  const sortedRows = [...rows].sort(sortByCapturedAtDescending)
  const latestBySelection = new Map()

  for (const row of sortedRows) {
    if (!latestBySelection.has(row.selection)) {
      latestBySelection.set(row.selection, row)
    }
  }

  const sampleRow = sortedRows[0]
  const requiredSelections = getRequiredSelections(sampleRow.market)
  const selections = requiredSelections
    .map((selection) => latestBySelection.get(selection))
    .filter(Boolean)
  const completeness = safeDivide(
    selections.length,
    requiredSelections.length,
    0
  )

  if (
    selections.length !== requiredSelections.length ||
    !allSelectionsShareSnapshot(selections)
  ) {
    return {
      market: sampleRow.market,
      bookmaker: sampleRow.bookmaker,
      sourceType: sampleRow.sourceType,
      capturedAt: null,
      completeness,
      selections: [],
      normalizedProbabilities: null,
      overround: null,
      normalizationMethod: null,
      derivedFromMarket: null
    }
  }

  const impliedProbabilities = selections.map((selection) =>
    getRawImpliedProbability(selection.decimalOdds)
  )
  const overround = impliedProbabilities.reduce(
    (total, value) => total + value,
    0
  )
  const normalizedProbabilities = selections.reduce(
    (accumulator, selection) => {
      accumulator[selection.selection] = safeDivide(
        safeDivide(1, selection.decimalOdds, 0),
        overround,
        0
      )
      return accumulator
    },
    {}
  )

  return {
    market: sampleRow.market,
    bookmaker: sampleRow.bookmaker,
    sourceType: sampleRow.sourceType,
    capturedAt: selections[0].capturedAt,
    completeness,
    selections,
    normalizedProbabilities,
    overround,
    normalizationMethod: 'DEVIG_EXCLUSIVE',
    derivedFromMarket: sampleRow.market
  }
}

function buildDoubleChanceOddsGroup(rows) {
  const sortedRows = [...rows].sort(sortByCapturedAtDescending)
  const latestBySelection = new Map()

  for (const row of sortedRows) {
    if (!latestBySelection.has(row.selection)) {
      latestBySelection.set(row.selection, row)
    }
  }

  const sampleRow = sortedRows[0]
  const requiredSelections = getRequiredSelections(sampleRow.market)
  const selections = requiredSelections
    .map((selection) => latestBySelection.get(selection))
    .filter(Boolean)
  const completeness = safeDivide(
    selections.length,
    requiredSelections.length,
    0
  )

  if (
    selections.length !== requiredSelections.length ||
    !allSelectionsShareSnapshot(selections)
  ) {
    return {
      market: sampleRow.market,
      bookmaker: sampleRow.bookmaker,
      sourceType: sampleRow.sourceType,
      capturedAt: null,
      completeness,
      selections: [],
      normalizedProbabilities: null,
      overround: null,
      normalizationMethod: null,
      derivedFromMarket: null
    }
  }

  const rawImpliedProbabilities = selections.reduce(
    (accumulator, selection) => {
      accumulator[selection.selection] = getRawImpliedProbability(
        selection.decimalOdds
      )
      return accumulator
    },
    {}
  )

  return {
    market: sampleRow.market,
    bookmaker: sampleRow.bookmaker,
    sourceType: sampleRow.sourceType,
    capturedAt: selections[0].capturedAt,
    completeness,
    selections,
    rawImpliedProbabilities,
    normalizedProbabilities: null,
    overround: null,
    normalizationMethod: 'RAW_IMPLIED',
    derivedFromMarket: sampleRow.market
  }
}

function buildOddsGroup(rows) {
  const market = rows[0]?.market ?? null

  if (market === 'DOUBLE_CHANCE') {
    return buildDoubleChanceOddsGroup(rows)
  }

  return buildExclusiveOddsGroup(rows)
}

function deriveDoubleChanceProbabilitiesFromMatchResult(
  matchResultProbabilities = {}
) {
  const home = matchResultProbabilities.HOME ?? null
  const draw = matchResultProbabilities.DRAW ?? null
  const away = matchResultProbabilities.AWAY ?? null

  if ([home, draw, away].some((value) => !Number.isFinite(value))) {
    return null
  }

  return {
    HOME_OR_DRAW: home + draw,
    DRAW_OR_AWAY: draw + away,
    HOME_OR_AWAY: home + away
  }
}

function finalizeDoubleChanceGroup(group, groupedMarkets) {
  if (group.market !== 'DOUBLE_CHANCE' || group.completeness < 1) {
    return group
  }

  const matchResultGroup = groupedMarkets.find(
    (candidate) =>
      candidate.market === 'MATCH_RESULT' &&
      candidate.bookmaker === group.bookmaker &&
      candidate.sourceType === group.sourceType &&
      candidate.completeness === 1 &&
      candidate.normalizedProbabilities &&
      candidate.capturedAt === group.capturedAt
  )

  if (!matchResultGroup) {
    return {
      ...group,
      normalizedProbabilities: group.rawImpliedProbabilities,
      overround: null,
      normalizationMethod: 'RAW_IMPLIED',
      derivedFromMarket: 'DOUBLE_CHANCE'
    }
  }

  const normalizedProbabilities =
    deriveDoubleChanceProbabilitiesFromMatchResult(
      matchResultGroup.normalizedProbabilities
    )

  if (!normalizedProbabilities) {
    return {
      ...group,
      normalizedProbabilities: group.rawImpliedProbabilities,
      overround: null,
      normalizationMethod: 'RAW_IMPLIED',
      derivedFromMarket: 'DOUBLE_CHANCE'
    }
  }

  return {
    ...group,
    normalizedProbabilities,
    overround: matchResultGroup.overround,
    normalizationMethod: 'DERIVED_FROM_MATCH_RESULT',
    derivedFromMarket: 'MATCH_RESULT'
  }
}

export function selectPreferredMarketOdds(oddsRows) {
  const groups = new Map()

  for (const row of oddsRows) {
    const requiredSelections = getRequiredSelections(row.market)
    if (requiredSelections.length === 0 || row.decimalOdds <= 1) {
      continue
    }

    const key = `${row.market}:${row.bookmaker}:${row.sourceType}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key).push(row)
  }

  const groupedMarkets = [...groups.values()].map(buildOddsGroup)
  const resolvedMarkets = groupedMarkets.map((group) =>
    finalizeDoubleChanceGroup(group, groupedMarkets)
  )
  const winners = new Map()

  for (const group of resolvedMarkets) {
    if (group.completeness < 1 || !group.normalizedProbabilities) {
      continue
    }

    const current = winners.get(group.market)

    if (!current) {
      winners.set(group.market, group)
      continue
    }

    const contenderScore = [
      getSourceRank(group.sourceType),
      Date.parse(group.capturedAt),
      group.bookmaker
    ]
    const currentScore = [
      getSourceRank(current.sourceType),
      Date.parse(current.capturedAt),
      current.bookmaker
    ]

    if (
      contenderScore[0] > currentScore[0] ||
      (contenderScore[0] === currentScore[0] &&
        contenderScore[1] > currentScore[1]) ||
      (contenderScore[0] === currentScore[0] &&
        contenderScore[1] === currentScore[1] &&
        contenderScore[2] < currentScore[2])
    ) {
      winners.set(group.market, group)
    }
  }

  return [...winners.values()]
}

function computeDataCompletenessPercent({
  dataQualityStatus,
  marketCompleteness
}) {
  const baseCompleteness =
    dataQualityStatus === DATA_QUALITY_STATUS.SUFFICIENT
      ? 100
      : dataQualityStatus === DATA_QUALITY_STATUS.LIMITED
        ? 75
        : dataQualityStatus === DATA_QUALITY_STATUS.INSUFFICIENT
          ? 40
          : 0

  return Math.round(baseCompleteness * marketCompleteness)
}

function computeSampleComponent({ sampleSizeHome, sampleSizeAway, weight }) {
  const minimumSample = Math.min(sampleSizeHome, sampleSizeAway)

  if (minimumSample >= 10) {
    return weight
  }

  if (minimumSample >= 6) {
    return Math.round(weight * 0.8)
  }

  if (minimumSample >= 3) {
    return Math.round(weight * 0.6)
  }

  return Math.round(weight * 0.2)
}

function computeCoherenceScore(signals) {
  const values = [signals.poisson, signals.elo, signals.form]
  const maxSignal = Math.max(...values)
  const minSignal = Math.min(...values)
  return clamp(1 - safeDivide(maxSignal - minSignal, 2, 1), 0, 1)
}

function computeFreshnessScore({
  capturedAt,
  now,
  staleWarningHours,
  staleMaxHours,
  weight
}) {
  const ageHours = safeDivide(
    Math.max(0, now.getTime() - Date.parse(capturedAt)),
    1000 * 60 * 60,
    staleMaxHours
  )

  if (ageHours <= staleWarningHours / 2) {
    return {
      score: weight,
      ageHours
    }
  }

  if (ageHours <= staleWarningHours) {
    return {
      score: Math.round(weight * 0.8),
      ageHours
    }
  }

  if (ageHours <= staleMaxHours) {
    return {
      score: Math.round(weight * 0.4),
      ageHours
    }
  }

  return {
    score: 0,
    ageHours
  }
}

export function scorePredictionSelection({
  prediction,
  market,
  selection,
  marketProbability,
  decimalOdds,
  bookmaker,
  sourceType,
  capturedAt,
  overround,
  normalizationMethod,
  derivedFromMarket,
  marketCompleteness = 1,
  now = new Date(),
  config = DEFAULT_SCORING_CONFIG
}) {
  const modelProbability = mapModelProbabilityByMarket(
    prediction.probabilities,
    market,
    selection
  )

  if (modelProbability === null || modelProbability === undefined) {
    return null
  }

  const edgePp = (modelProbability - marketProbability) * 100
  const rawImpliedProbability = getRawImpliedProbability(decimalOdds)
  const dataCompletenessPercent = computeDataCompletenessPercent({
    dataQualityStatus: prediction.dataQuality.status,
    marketCompleteness
  })
  const coherence = computeCoherenceScore(prediction.components.signals)
  const confidenceWeights = config.confidence
  const dataCompletenessScore = Math.round(
    confidenceWeights.dataCompletenessWeight * (dataCompletenessPercent / 100)
  )
  const sampleScore = computeSampleComponent({
    sampleSizeHome: prediction.inputs.sampleSizeHome,
    sampleSizeAway: prediction.inputs.sampleSizeAway,
    weight: confidenceWeights.sampleWeight
  })
  const coherenceScore = Math.round(
    confidenceWeights.coherenceWeight * coherence
  )
  const edgeScore = Math.round(
    confidenceWeights.edgeWeight *
      clamp(safeDivide(edgePp, config.maxNormalizedEdgePp, 0), 0, 1)
  )
  const freshness = computeFreshnessScore({
    capturedAt,
    now,
    staleWarningHours: config.staleOddsWarningHours,
    staleMaxHours: config.staleOddsMaxHours,
    weight: confidenceWeights.freshnessWeight
  })
  const confidenceScore = clamp(
    dataCompletenessScore +
      sampleScore +
      coherenceScore +
      edgeScore +
      freshness.score,
    0,
    100
  )

  const riskLevel =
    prediction.dataQuality.status === DATA_QUALITY_STATUS.INVALID ||
    prediction.dataQuality.status === DATA_QUALITY_STATUS.INSUFFICIENT ||
    dataCompletenessPercent < config.minDataCompletenessPercent ||
    freshness.ageHours > config.staleOddsMaxHours ||
    coherence < 0.35 ||
    edgePp > config.maxNormalizedEdgePp * 1.5
      ? RISK_LEVELS.HIGH
      : freshness.ageHours > config.staleOddsWarningHours || coherence < 0.55
        ? RISK_LEVELS.MEDIUM
        : RISK_LEVELS.LOW

  const recommendation =
    confidenceScore >= 70 &&
    edgePp >= config.edgeThresholdPp &&
    riskLevel !== RISK_LEVELS.HIGH &&
    dataCompletenessPercent >= config.minDataCompletenessPercent &&
    freshness.ageHours <= config.staleOddsWarningHours
      ? RECOMMENDATION_TYPES.CONSIDER
      : RECOMMENDATION_TYPES.NO_RECOMMENDATION

  const rankingScore =
    confidenceScore * 0.55 +
    clamp(safeDivide(edgePp, config.maxNormalizedEdgePp, 0), 0, 1) *
      100 *
      0.25 +
    dataCompletenessPercent * 0.2

  return {
    market,
    selection,
    bookmaker,
    sourceType,
    decimalOdds,
    capturedAt,
    modelProbability,
    marketProbability,
    edgePp,
    confidenceScore,
    riskLevel,
    recommendation,
    rankingScore,
    source: {
      bookmaker,
      sourceType,
      decimalOdds,
      capturedAt,
      overround,
      rawImpliedProbability,
      fairMarketProbability: marketProbability,
      normalizationMethod: normalizationMethod ?? 'UNKNOWN',
      derivedFromMarket: derivedFromMarket ?? market,
      oddsAgeHours: freshness.ageHours,
      dataCoverage: dataCompletenessPercent / 100,
      marketCompleteness,
      normalizedProbabilities: {
        [selection]: marketProbability
      }
    }
  }
}
