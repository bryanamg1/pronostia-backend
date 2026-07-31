import { createListCompetitionsUseCase } from '../src/application/sports/listCompetitions.js'

describe('listCompetitions use case', () => {
  test('returns one public competition per target key and prefers the latest season while exposing the full authorized catalog', async () => {
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

    const competitions = await listCompetitions()

    expect(competitions).toHaveLength(18)
    expect(competitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 12,
          key: 'laliga',
          targetKey: 'laliga',
          name: 'LaLiga',
          country: 'Spain',
          region: null,
          type: 'DOMESTIC_LEAGUE',
          availabilityStatus: 'PARTIAL',
          season: 2026,
          isEnabled: true,
          displayOrder: 0
        }),
        expect.objectContaining({
          id: 11,
          key: 'premier-league',
          targetKey: 'premier-league',
          name: 'Premier League',
          country: 'England',
          region: null,
          type: 'DOMESTIC_LEAGUE',
          availabilityStatus: 'PARTIAL',
          season: 2026,
          isEnabled: true,
          displayOrder: 1
        }),
        expect.objectContaining({
          id: null,
          key: 'copa-del-rey',
          targetKey: 'copa-del-rey',
          name: 'Copa del Rey',
          country: 'Spain',
          region: null,
          type: 'DOMESTIC_CUP',
          availabilityStatus: 'PARTIAL',
          season: 2025,
          isEnabled: true,
          displayOrder: 7
        })
      ])
    )
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

    const competitions = await listCompetitions()

    expect(competitions.slice(0, 3)).toEqual([
      expect.objectContaining({
        targetKey: 'laliga',
        displayOrder: 0
      }),
      expect.objectContaining({
        targetKey: 'premier-league',
        displayOrder: 1
      }),
      expect.objectContaining({
        targetKey: 'ligue-1',
        displayOrder: 2
      })
    ])
  })

  test('supports public filters by type, country, region, and availability status', async () => {
    const listCompetitions = createListCompetitionsUseCase({
      competitionRepository: {
        async listEnabledCompetitions() {
          return []
        }
      }
    })

    await expect(
      listCompetitions({
        type: 'DOMESTIC_CUP',
        country: 'Spain',
        availabilityStatus: 'PARTIAL'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        targetKey: 'copa-del-rey'
      })
    ])

    await expect(
      listCompetitions({
        type: 'CONTINENTAL_CUP',
        region: 'Europe'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        targetKey: 'uefa-champions-league'
      }),
      expect.objectContaining({
        targetKey: 'uefa-europa-league'
      })
    ])
  })

  test('rejects unsupported public filters', async () => {
    const listCompetitions = createListCompetitionsUseCase({
      competitionRepository: {
        async listEnabledCompetitions() {
          return []
        }
      }
    })

    await expect(
      listCompetitions({
        type: 'LEAGUE'
      })
    ).rejects.toThrow('type is not supported')
  })
})
