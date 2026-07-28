export function createListTodayFixturesUseCase({
  fixtureRepository,
  now = () => new Date(),
  lookaheadHours,
  maxFixtures
}) {
  return async function listTodayFixtures() {
    const startsAt = now()
    const endsAt = new Date(
      startsAt.getTime() + lookaheadHours * 60 * 60 * 1000
    )

    return fixtureRepository.listFixturesByWindow({
      from: startsAt,
      to: endsAt,
      limit: maxFixtures
    })
  }
}
