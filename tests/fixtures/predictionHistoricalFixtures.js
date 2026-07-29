export function createPredictionHistoricalFixtures() {
  const competition = {
    id: 39,
    targetKey: 'premier-league',
    providerId: 39,
    name: 'Premier League',
    country: 'England',
    season: 2024
  }

  const teams = {
    alpha: { id: 101, providerId: 101, name: 'Alpha FC', logoUrl: null },
    beta: { id: 102, providerId: 102, name: 'Beta FC', logoUrl: null },
    gamma: { id: 103, providerId: 103, name: 'Gamma FC', logoUrl: null },
    delta: { id: 104, providerId: 104, name: 'Delta FC', logoUrl: null }
  }

  return [
    ['2024-08-01T12:00:00.000Z', 1, teams.alpha, teams.beta, 2, 0],
    ['2024-08-02T12:00:00.000Z', 2, teams.gamma, teams.delta, 1, 1],
    ['2024-08-08T12:00:00.000Z', 3, teams.beta, teams.gamma, 0, 2],
    ['2024-08-09T12:00:00.000Z', 4, teams.delta, teams.alpha, 0, 1],
    ['2024-08-15T12:00:00.000Z', 5, teams.alpha, teams.gamma, 3, 1],
    ['2024-08-16T12:00:00.000Z', 6, teams.beta, teams.delta, 2, 2],
    ['2024-08-22T12:00:00.000Z', 7, teams.gamma, teams.alpha, 0, 1],
    ['2024-08-23T12:00:00.000Z', 8, teams.delta, teams.beta, 1, 0],
    ['2024-08-29T12:00:00.000Z', 9, teams.alpha, teams.delta, 2, 1],
    ['2024-08-30T12:00:00.000Z', 10, teams.gamma, teams.beta, 1, 0]
  ].map(([kickoffAt, id, homeTeam, awayTeam, homeGoals, awayGoals]) => ({
    id,
    providerId: 9000 + id,
    kickoffAt,
    status: 'FT',
    homeGoals,
    awayGoals,
    rawSourceUpdatedAt: kickoffAt,
    competition,
    homeTeam,
    awayTeam
  }))
}
