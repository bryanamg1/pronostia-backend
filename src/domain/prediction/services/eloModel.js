import { PredictionModelError } from '../errors/PredictionModelError.js'
import { clamp } from '../../../shared/math/probability.js'

export function calculateExpectedScore({
  teamRating,
  opponentRating,
  advantage = 0
}) {
  const exponent = (opponentRating - (teamRating + advantage)) / 400
  return 1 / (1 + 10 ** exponent)
}

function toMatchScore(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) {
    return 1
  }

  if (goalsFor === goalsAgainst) {
    return 0.5
  }

  return 0
}

export function regressRating({ rating, baselineRating, regressionFactor }) {
  return rating - (rating - baselineRating) * regressionFactor
}

export function updateEloRatings({
  homeRating,
  awayRating,
  homeGoals,
  awayGoals,
  config
}) {
  if (homeGoals === null || awayGoals === null) {
    throw new PredictionModelError(
      'Elo updates require final goals for both teams'
    )
  }

  const homeExpectedScore = calculateExpectedScore({
    teamRating: homeRating,
    opponentRating: awayRating,
    advantage: config.homeAdvantage
  })
  const awayExpectedScore = 1 - homeExpectedScore
  const homeActualScore = toMatchScore(homeGoals, awayGoals)
  const awayActualScore = 1 - homeActualScore

  return {
    homeExpectedScore,
    awayExpectedScore,
    homeRating: clamp(
      homeRating + config.kFactor * (homeActualScore - homeExpectedScore),
      0,
      Number.MAX_SAFE_INTEGER
    ),
    awayRating: clamp(
      awayRating + config.kFactor * (awayActualScore - awayExpectedScore),
      0,
      Number.MAX_SAFE_INTEGER
    )
  }
}
