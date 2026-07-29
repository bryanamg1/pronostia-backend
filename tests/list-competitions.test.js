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
            },
            {
              id: 13,
              targetKey: 'unknown-league',
              providerId: 999,
              name: 'Unknown League',
              country: 'Nowhere',
              season: 2026,
              enabled: true
            }
          ]
        }
      }
    })

    await expect(listCompetitions()).resolves.toEqual([
      {
        id: 12,
        targetKey: 'laliga',
        providerId: 140,
        name: 'La Liga',
        country: 'Spain',
        season: 2026,
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
      }
    ])
  })

  test('keeps the official public order after consolidating seasons', async () => {
    const listCompetitions = createListCompetitionsUseCase({
      competitionRepository: {
        async listEnabledCompetitions() {
          return [
            {
              id: 61,
              targetKey: 'ligue-1',
              providerId: 61,
              name: 'Ligue 1',
              country: 'France',
              season: 2026,
              enabled: true
            },
            {
              id: 39,
              targetKey: 'premier-league',
              providerId: 39,
              name: 'Premier League',
              country: 'England',
              season: 2026,
              enabled: true
            },
            {
              id: 140,
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
      expect.objectContaining({
        targetKey: 'laliga'
      }),
      expect.objectContaining({
        targetKey: 'premier-league'
      }),
      expect.objectContaining({
        targetKey: 'ligue-1'
      })
    ])
  })
})
