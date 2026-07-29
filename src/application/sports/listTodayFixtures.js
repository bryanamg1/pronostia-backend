export function createListTodayFixturesUseCase({
  fixtureRepository,
  predictionRepository,
  fixturePublicViewService,
  now = () => new Date(),
  lookaheadHours,
  maxFixtures
}) {
  function normalizeFilters(filters = {}) {
    return {
      competition:
        typeof filters.competition === 'string'
          ? filters.competition.trim()
          : '',
      team: typeof filters.team === 'string' ? filters.team.trim() : ''
    }
  }

  function buildPredictionMap(predictions) {
    const predictionsByFixtureId = new Map()

    for (const prediction of predictions) {
      if (!predictionsByFixtureId.has(prediction.fixtureId)) {
        predictionsByFixtureId.set(prediction.fixtureId, prediction)
      }
    }

    return predictionsByFixtureId
  }

  function matchesFilters(fixture, filters) {
    if (
      filters.competition &&
      fixture.competition?.targetKey !== filters.competition
    ) {
      return false
    }

    if (!filters.team) {
      return true
    }

    return (
      String(fixture.homeTeam?.id) === filters.team ||
      String(fixture.awayTeam?.id) === filters.team
    )
  }

  return async function listTodayFixtures(filters = {}) {
    const startsAt = now()
    const endsAt = new Date(
      startsAt.getTime() + lookaheadHours * 60 * 60 * 1000
    )
    const normalizedFilters = normalizeFilters(filters)

    const [fixtures, predictions] = await Promise.all([
      fixtureRepository.listFixturesByWindow({
        from: startsAt,
        to: endsAt,
        limit: maxFixtures
      }),
      predictionRepository.listPredictionsByWindow({
        from: startsAt.toISOString().slice(0, 19).replace('T', ' '),
        to: endsAt.toISOString().slice(0, 19).replace('T', ' '),
        limit: maxFixtures * 6
      })
    ])
    const predictionsByFixtureId = buildPredictionMap(predictions)

    return fixtures
      .filter((fixture) => matchesFilters(fixture, normalizedFilters))
      .map((fixture) =>
        fixturePublicViewService.toPublicFixture(
          fixture,
          predictionsByFixtureId.get(fixture.id)
        )
      )
  }
}
