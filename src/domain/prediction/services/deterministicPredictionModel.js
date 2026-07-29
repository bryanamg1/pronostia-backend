import { clamp, safeDivide } from '../../../shared/math/probability.js'
import {
  buildScoreMatrix,
  deriveBothTeamsToScoreProbabilities,
  deriveDoubleChanceProbabilities,
  deriveMatchOutcomeProbabilities,
  deriveOverUnderProbabilities
} from './poissonModel.js'

export function buildExpectedGoals({
  leagueAverages,
  homeStats,
  awayStats,
  config
}) {
  const homeLeagueAverage = leagueAverages.homeGoals || 1.4
  const awayLeagueAverage = leagueAverages.awayGoals || 1.1
  const homeAttackStrength = safeDivide(
    safeDivide(
      homeStats.homeGoalsFor,
      homeStats.homeMatches,
      homeLeagueAverage
    ),
    homeLeagueAverage,
    1
  )
  const awayDefenseStrength = safeDivide(
    safeDivide(
      awayStats.awayGoalsAgainst,
      awayStats.awayMatches,
      homeLeagueAverage
    ),
    homeLeagueAverage,
    1
  )
  const awayAttackStrength = safeDivide(
    safeDivide(
      awayStats.awayGoalsFor,
      awayStats.awayMatches,
      awayLeagueAverage
    ),
    awayLeagueAverage,
    1
  )
  const homeDefenseStrength = safeDivide(
    safeDivide(
      homeStats.homeGoalsAgainst,
      homeStats.homeMatches,
      awayLeagueAverage
    ),
    awayLeagueAverage,
    1
  )

  return {
    home: clamp(
      homeLeagueAverage * homeAttackStrength * awayDefenseStrength,
      config.prediction.minExpectedGoals,
      config.prediction.maxExpectedGoals
    ),
    away: clamp(
      awayLeagueAverage * awayAttackStrength * homeDefenseStrength,
      config.prediction.minExpectedGoals,
      config.prediction.maxExpectedGoals
    )
  }
}

export function combinePredictionSignals({
  expectedGoals,
  homeExpectedScore,
  homeForm,
  awayForm,
  config
}) {
  const totalGoals = expectedGoals.home + expectedGoals.away
  const poissonSignal = clamp(
    safeDivide(expectedGoals.home - expectedGoals.away, totalGoals, 0),
    -1,
    1
  )
  const eloSignal = clamp((homeExpectedScore - 0.5) * 2, -1, 1)
  const formSignal = clamp(
    homeForm.compositeScore - awayForm.compositeScore,
    -1,
    1
  )

  const combinedEdge =
    config.blend.weights.poisson * poissonSignal +
    config.blend.weights.elo * eloSignal +
    config.blend.weights.form * formSignal

  const baseHomeShare = safeDivide(expectedGoals.home, totalGoals, 0.5)
  const adjustedHomeShare = clamp(
    baseHomeShare +
      combinedEdge * config.blend.edgeShareScale +
      config.blend.homeAdvantageShareBoost,
    0.2,
    0.8
  )

  const home = clamp(
    totalGoals * adjustedHomeShare,
    config.prediction.minExpectedGoals,
    config.prediction.maxExpectedGoals
  )
  const away = clamp(
    totalGoals * (1 - adjustedHomeShare),
    config.prediction.minExpectedGoals,
    config.prediction.maxExpectedGoals
  )

  return {
    home,
    away,
    combinedEdge,
    signals: {
      poisson: poissonSignal,
      elo: eloSignal,
      form: formSignal
    }
  }
}

export function buildPredictionMarkets({
  homeExpectedGoals,
  awayExpectedGoals,
  config
}) {
  const scoreMatrix = buildScoreMatrix({
    homeExpectedGoals,
    awayExpectedGoals,
    maxGoals: config.prediction.maxGoals
  })
  const outcomes = deriveMatchOutcomeProbabilities(scoreMatrix)
  const overUnder = deriveOverUnderProbabilities(scoreMatrix)
  const btts = deriveBothTeamsToScoreProbabilities(scoreMatrix)
  const doubleChance = deriveDoubleChanceProbabilities(outcomes)

  return {
    scoreMatrix,
    probabilities: {
      homeWin: outcomes.homeWin,
      draw: outcomes.draw,
      awayWin: outcomes.awayWin,
      over25: overUnder.over,
      under25: overUnder.under,
      bttsYes: btts.yes,
      bttsNo: btts.no,
      doubleChance1X: doubleChance.chance1X,
      doubleChanceX2: doubleChance.chanceX2,
      doubleChance12: doubleChance.chance12
    }
  }
}
