import {
  DATA_QUALITY_STATUS,
  SUPPORTED_EVALUATION_STATUSES
} from '../../../domain/prediction/constants/modelDefaults.js'
import { assessPredictionDataQuality } from '../../../domain/prediction/services/dataQuality.js'
import {
  buildExpectedGoals,
  buildPredictionMarkets,
  combinePredictionSignals
} from '../../../domain/prediction/services/deterministicPredictionModel.js'
import {
  calculateExpectedScore,
  regressRating,
  updateEloRatings
} from '../../../domain/prediction/services/eloModel.js'
import { buildWeightedRecentForm } from '../../../domain/prediction/services/recentForm.js'
import { createPredictionModelConfig } from '../../../domain/prediction/services/modelConfig.js'
import { safeDivide } from '../../../shared/math/probability.js'

function sortFixturesChronologically(fixtures) {
  return [...fixtures].sort((left, right) => {
    const leftTime = new Date(left.kickoffAt).getTime()
    const rightTime = new Date(right.kickoffAt).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return left.id - right.id
  })
}

function getTeamState(state, teamId) {
  if (!state.teams.has(teamId)) {
    state.teams.set(teamId, {
      matches: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      homeMatches: 0,
      awayMatches: 0,
      homeGoalsFor: 0,
      homeGoalsAgainst: 0,
      awayGoalsFor: 0,
      awayGoalsAgainst: 0,
      fixtures: []
    })
  }

  return state.teams.get(teamId)
}

function getLeagueState(state, fixture) {
  const key = `${fixture.competition.id}:${fixture.competition.season}`

  if (!state.leagues.has(key)) {
    state.leagues.set(key, {
      matches: 0,
      homeGoals: 0,
      awayGoals: 0
    })
  }

  return state.leagues.get(key)
}

function getRating(state, teamId, fixture) {
  const ratingKey = `${fixture.competition.id}:${teamId}`
  const seasonKey = `${fixture.competition.id}:${teamId}:season`

  if (!state.ratings.has(ratingKey)) {
    state.ratings.set(ratingKey, state.config.elo.initialRating)
    state.ratingSeasons.set(seasonKey, fixture.competition.season)
  }

  const previousSeason = state.ratingSeasons.get(seasonKey)

  if (previousSeason !== fixture.competition.season) {
    const regressedRating = regressRating({
      rating: state.ratings.get(ratingKey),
      baselineRating: state.config.elo.initialRating,
      regressionFactor: state.config.elo.seasonRegressionFactor
    })

    state.ratings.set(ratingKey, regressedRating)
    state.ratingSeasons.set(seasonKey, fixture.competition.season)
  }

  return state.ratings.get(ratingKey)
}

function setRating(state, teamId, fixture, rating) {
  const ratingKey = `${fixture.competition.id}:${teamId}`
  const seasonKey = `${fixture.competition.id}:${teamId}:season`

  state.ratings.set(ratingKey, rating)
  state.ratingSeasons.set(seasonKey, fixture.competition.season)
}

function isCompletedFixture(fixture) {
  return (
    SUPPORTED_EVALUATION_STATUSES.includes(fixture.status) &&
    fixture.homeGoals !== null &&
    fixture.awayGoals !== null
  )
}

function toHistoricalFixtureSummary(fixture) {
  return {
    id: fixture.id,
    kickoffAt: fixture.kickoffAt,
    status: fixture.status,
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam
  }
}

function updateStateWithFixture(state, fixture) {
  if (!isCompletedFixture(fixture)) {
    return
  }

  const homeTeamState = getTeamState(state, fixture.homeTeam.id)
  const awayTeamState = getTeamState(state, fixture.awayTeam.id)
  const leagueState = getLeagueState(state, fixture)
  const homeRating = getRating(state, fixture.homeTeam.id, fixture)
  const awayRating = getRating(state, fixture.awayTeam.id, fixture)
  const updatedRatings = updateEloRatings({
    homeRating,
    awayRating,
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
    config: state.config.elo
  })

  setRating(state, fixture.homeTeam.id, fixture, updatedRatings.homeRating)
  setRating(state, fixture.awayTeam.id, fixture, updatedRatings.awayRating)

  homeTeamState.matches += 1
  homeTeamState.goalsFor += fixture.homeGoals
  homeTeamState.goalsAgainst += fixture.awayGoals
  homeTeamState.homeMatches += 1
  homeTeamState.homeGoalsFor += fixture.homeGoals
  homeTeamState.homeGoalsAgainst += fixture.awayGoals
  homeTeamState.fixtures.push(toHistoricalFixtureSummary(fixture))

  awayTeamState.matches += 1
  awayTeamState.goalsFor += fixture.awayGoals
  awayTeamState.goalsAgainst += fixture.homeGoals
  awayTeamState.awayMatches += 1
  awayTeamState.awayGoalsFor += fixture.awayGoals
  awayTeamState.awayGoalsAgainst += fixture.homeGoals
  awayTeamState.fixtures.push(toHistoricalFixtureSummary(fixture))

  leagueState.matches += 1
  leagueState.homeGoals += fixture.homeGoals
  leagueState.awayGoals += fixture.awayGoals
}

function buildFixturePrediction(state, fixture, now) {
  const homeTeamState = getTeamState(state, fixture.homeTeam.id)
  const awayTeamState = getTeamState(state, fixture.awayTeam.id)
  const leagueState = getLeagueState(state, fixture)
  const homeRating = getRating(state, fixture.homeTeam.id, fixture)
  const awayRating = getRating(state, fixture.awayTeam.id, fixture)
  const homeForm = buildWeightedRecentForm({
    fixtures: homeTeamState.fixtures,
    teamId: fixture.homeTeam.id,
    config: state.config,
    ratingResolver: (teamId) => getRating(state, teamId, fixture)
  })
  const awayForm = buildWeightedRecentForm({
    fixtures: awayTeamState.fixtures,
    teamId: fixture.awayTeam.id,
    config: state.config,
    ratingResolver: (teamId) => getRating(state, teamId, fixture)
  })
  const dataQuality = assessPredictionDataQuality({
    fixture,
    homeSampleSize: homeTeamState.matches,
    awaySampleSize: awayTeamState.matches,
    homeVenueSampleSize: homeTeamState.homeMatches,
    awayVenueSampleSize: awayTeamState.awayMatches,
    leagueMatchCount: leagueState.matches,
    config: state.config
  })
  const leagueAverages = {
    homeGoals: safeDivide(leagueState.homeGoals, leagueState.matches, 1.4),
    awayGoals: safeDivide(leagueState.awayGoals, leagueState.matches, 1.1)
  }
  const baseExpectedGoals = buildExpectedGoals({
    leagueAverages,
    homeStats: homeTeamState,
    awayStats: awayTeamState,
    config: state.config
  })
  const combinedExpectedGoals = combinePredictionSignals({
    expectedGoals: baseExpectedGoals,
    homeExpectedScore: calculateExpectedScore({
      teamRating: homeRating,
      opponentRating: awayRating,
      advantage: state.config.elo.homeAdvantage
    }),
    homeForm,
    awayForm,
    config: state.config
  })
  const markets = buildPredictionMarkets({
    homeExpectedGoals: combinedExpectedGoals.home,
    awayExpectedGoals: combinedExpectedGoals.away,
    config: state.config
  })

  return {
    modelVersion: state.config.modelVersion,
    fixtureId: fixture.id,
    generatedAt: now.toISOString(),
    inputs: {
      historicalCutoff: fixture.kickoffAt,
      sampleSizeHome: homeTeamState.matches,
      sampleSizeAway: awayTeamState.matches
    },
    expectedGoals: {
      home: combinedExpectedGoals.home,
      away: combinedExpectedGoals.away
    },
    probabilities: markets.probabilities,
    dataQuality,
    components: {
      ratings: {
        home: homeRating,
        away: awayRating
      },
      baseExpectedGoals,
      recentForm: {
        home: homeForm,
        away: awayForm
      },
      signals: combinedExpectedGoals.signals
    }
  }
}

export function createChronologicalPredictionEngine({
  config: configOverrides,
  now = () => new Date()
} = {}) {
  const config = createPredictionModelConfig(configOverrides)

  function createState() {
    return {
      config,
      ratings: new Map(),
      ratingSeasons: new Map(),
      teams: new Map(),
      leagues: new Map()
    }
  }

  function evaluateFixtures(fixtures) {
    const orderedFixtures = sortFixturesChronologically(fixtures)
    const state = createState()
    const predictions = []
    const excludedFixtures = []

    for (const fixture of orderedFixtures) {
      const prediction = buildFixturePrediction(state, fixture, now())
      const minimumSamplesReached =
        prediction.inputs.sampleSizeHome >=
          config.evaluation.minSamplesPerTeam &&
        prediction.inputs.sampleSizeAway >= config.evaluation.minSamplesPerTeam

      if (!isCompletedFixture(fixture)) {
        excludedFixtures.push({
          fixtureId: fixture.id,
          reason: 'UNSUPPORTED_OR_INCOMPLETE_STATUS'
        })
      } else if (
        prediction.dataQuality.status === DATA_QUALITY_STATUS.INVALID
      ) {
        excludedFixtures.push({
          fixtureId: fixture.id,
          reason: 'INVALID_DATA_QUALITY'
        })
      } else if (!minimumSamplesReached) {
        excludedFixtures.push({
          fixtureId: fixture.id,
          reason: 'INSUFFICIENT_PRIOR_SAMPLE'
        })
      } else {
        predictions.push({
          fixture,
          prediction
        })
      }

      updateStateWithFixture(state, fixture)
    }

    return {
      predictions,
      excludedFixtures
    }
  }

  function predictFixture({ fixtures, fixtureId }) {
    const orderedFixtures = sortFixturesChronologically(fixtures)
    const state = createState()

    for (const fixture of orderedFixtures) {
      if (fixture.id === fixtureId) {
        return buildFixturePrediction(state, fixture, now())
      }

      updateStateWithFixture(state, fixture)
    }

    return null
  }

  return {
    config,
    evaluateFixtures,
    predictFixture
  }
}
