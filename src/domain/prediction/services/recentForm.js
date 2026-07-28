import { clamp, safeDivide } from '../../../shared/math/probability.js'

function toTeamPerspective(fixture, teamId) {
  const isHomeTeam = fixture.homeTeam.id === teamId

  return {
    isHomeTeam,
    goalsFor: isHomeTeam ? fixture.homeGoals : fixture.awayGoals,
    goalsAgainst: isHomeTeam ? fixture.awayGoals : fixture.homeGoals,
    opponentTeamId: isHomeTeam ? fixture.awayTeam.id : fixture.homeTeam.id
  }
}

function getPoints(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) {
    return 3
  }

  if (goalsFor === goalsAgainst) {
    return 1
  }

  return 0
}

export function buildWeightedRecentForm({
  fixtures,
  teamId,
  config,
  ratingResolver = () => config.elo.initialRating
}) {
  const recentFixtures = fixtures.slice(-config.form.windowSize).reverse()
  const weights = config.form.weights.slice(0, recentFixtures.length)
  const weightTotal = weights.reduce(
    (accumulator, value) => accumulator + value,
    0
  )

  let weightedPoints = 0
  let weightedGoalsFor = 0
  let weightedGoalsAgainst = 0
  let weightedHome = 0
  let weightedAway = 0
  let weightedOpponentElo = 0
  let homeSamples = 0
  let awaySamples = 0

  recentFixtures.forEach((fixture, index) => {
    const weight = weights[index]
    const perspective = toTeamPerspective(fixture, teamId)
    const opponentRating = ratingResolver(perspective.opponentTeamId)
    const eloModifier =
      safeDivide(opponentRating - config.elo.initialRating, 400, 0) *
      config.form.opponentEloWeight

    weightedPoints +=
      (getPoints(perspective.goalsFor, perspective.goalsAgainst) +
        eloModifier) *
      weight
    weightedGoalsFor += perspective.goalsFor * weight
    weightedGoalsAgainst += perspective.goalsAgainst * weight
    weightedOpponentElo += opponentRating * weight

    if (perspective.isHomeTeam) {
      weightedHome +=
        getPoints(perspective.goalsFor, perspective.goalsAgainst) * weight
      homeSamples += 1
    } else {
      weightedAway +=
        getPoints(perspective.goalsFor, perspective.goalsAgainst) * weight
      awaySamples += 1
    }
  })

  const normalizedPoints = safeDivide(weightedPoints, weightTotal * 3, 0)
  const normalizedGoalDiff = clamp(
    safeDivide(weightedGoalsFor - weightedGoalsAgainst, weightTotal * 3, 0),
    -1,
    1
  )
  const normalizedOpponentElo = clamp(
    safeDivide(
      weightedOpponentElo - config.elo.initialRating * weightTotal,
      weightTotal * 400,
      0
    ),
    -1,
    1
  )

  return {
    sampleSize: recentFixtures.length,
    weightedPoints,
    weightedGoalsFor,
    weightedGoalsAgainst,
    homeForm: safeDivide(weightedHome, Math.max(homeSamples, 1) * 3, 0),
    awayForm: safeDivide(weightedAway, Math.max(awaySamples, 1) * 3, 0),
    dataQualityFlags:
      recentFixtures.length < config.form.minSampleSize
        ? ['LOW_RECENT_FORM_SAMPLE']
        : [],
    compositeScore: clamp(
      normalizedPoints * 0.6 +
        normalizedGoalDiff * 0.3 +
        normalizedOpponentElo * 0.1,
      -1,
      1
    )
  }
}
