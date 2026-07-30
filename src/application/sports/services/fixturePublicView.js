const HISTORICAL_STATUSES = new Set([
  'FT',
  'AET',
  'PEN',
  'CANC',
  'ABD',
  'AWD',
  'WO'
])

function toPublicCompetition(competition) {
  return {
    id: competition.id,
    key: competition.targetKey,
    name: competition.name,
    country: competition.country,
    season: competition.season
  }
}

function toPublicTeam(team) {
  return {
    id: team.id,
    key: String(team.id),
    name: team.name
  }
}

function toPublicPredictionSummary(prediction) {
  if (!prediction) {
    return null
  }

  return {
    id: prediction.id,
    market: prediction.market,
    selection: prediction.selection,
    recommendation: prediction.recommendation,
    confidenceScore: prediction.confidenceScore
  }
}

function isHistoricalFixture(fixture, now) {
  if (HISTORICAL_STATUSES.has(fixture.status)) {
    return true
  }

  const kickoffTime = Date.parse(fixture.kickoffAt)

  if (Number.isNaN(kickoffTime)) {
    return false
  }

  return kickoffTime < now().getTime()
}

export function createFixturePublicViewService({
  now = () => new Date()
} = {}) {
  return {
    toPublicFixture(fixture, prediction) {
      return {
        id: fixture.id,
        competition: toPublicCompetition(fixture.competition),
        homeTeam: toPublicTeam(fixture.homeTeam),
        awayTeam: toPublicTeam(fixture.awayTeam),
        kickoffAt: fixture.kickoffAt,
        status: fixture.status,
        isHistorical: isHistoricalFixture(fixture, now),
        prediction: toPublicPredictionSummary(prediction)
      }
    }
  }
}
