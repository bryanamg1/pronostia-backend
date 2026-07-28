function toNullableNumber(value) {
  return value === undefined || value === null ? null : Number(value)
}

export function normalizeProviderFixture({ payload, competitionId }) {
  const fixture = payload?.fixture || {}
  const goals = payload?.goals || {}
  const homeTeam = payload?.teams?.home || {}
  const awayTeam = payload?.teams?.away || {}

  return {
    providerId: Number(fixture.id),
    competitionId,
    kickoffAt: fixture.date,
    status: fixture.status?.short || fixture.status?.long || 'TBD',
    homeGoals: toNullableNumber(goals.home),
    awayGoals: toNullableNumber(goals.away),
    rawSourceUpdatedAt: fixture.update || fixture.date,
    homeTeam: {
      providerId: Number(homeTeam.id),
      name: homeTeam.name || 'Unknown home team',
      logoUrl: homeTeam.logo || null
    },
    awayTeam: {
      providerId: Number(awayTeam.id),
      name: awayTeam.name || 'Unknown away team',
      logoUrl: awayTeam.logo || null
    }
  }
}
