export function createListTodayFixturesUseCase({
  fixtureRepository,
  predictionRepository,
  fixturePublicViewService,
  now = () => new Date(),
  lookaheadHours,
  maxFixtures
}) {
  function buildPredictionMap(predictions) {
    const predictionsByFixtureId = new Map()

    for (const prediction of predictions) {
      if (!predictionsByFixtureId.has(prediction.fixtureId)) {
        predictionsByFixtureId.set(prediction.fixtureId, prediction)
      }
    }

    return predictionsByFixtureId
  }

  return async function listTodayFixtures() {
    const startsAt = now()
    const endsAt = new Date(
      startsAt.getTime() + lookaheadHours * 60 * 60 * 1000
    )

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

    return fixtures.map((fixture) =>
      fixturePublicViewService.toPublicFixture(
        fixture,
        predictionsByFixtureId.get(fixture.id)
      )
    )
  }
}
