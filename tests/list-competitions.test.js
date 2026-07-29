import { createListCompetitionsUseCase } from '../src/application/sports/listCompetitions.js'

describe('listCompetitions use case', () => {
  test('returns one public competition per target key and prefers the latest season', async () => {
    const listCompetitions = createListCompetitionsUseCase({
      competitionRepository: {
        async listEnabledCompetitions() {
          return [
            {
              id: 10,
              targetKey: 'premier-league',
              providerId: 39,
              name: 'Premier League',
              country: 'England',
              season: 2025,
              enabled: true
            },
            {
              id: 11,
              targetKey: 'premier-league',
              providerId: 39,
              name: 'Premier League',
              country: 'England',
              season: 2026,
              enabled: true
            },
            {
              id: 12,
              targetKey: 'laliga',
              providerId: 140,
              name: 'La Liga',
              country: 'Spain',
              season: 2026,
              enabled: true
            }
          ]
        }
      }
    })

    await expect(listCompetitions()).resolves.toEqual([
      {
        id: 11,
        targetKey: 'premier-league',
        providerId: 39,
        name: 'Premier League',
        country: 'England',
        season: 2026,
        enabled: true
      },
      {
        id: 12,
        targetKey: 'laliga',
        providerId: 140,
        name: 'La Liga',
        country: 'Spain',
        season: 2026,
        enabled: true
      }
    ])
  })
})
