import { createListTodayFixturesUseCase } from '../src/application/sports/listTodayFixtures.js'
import { createFixturePublicViewService } from '../src/application/sports/services/fixturePublicView.js'

describe('listTodayFixtures use case', () => {
  test('returns a sanitized fixture list with one prediction summary per fixture', async () => {
    const fixtureRepository = {
      listFixturesByWindow: async () => [
        {
          id: 51,
          providerId: 9001,
          kickoffAt: '2026-07-29T18:00:00.000Z',
          status: 'NS',
          competition: {
            id: 1,
            targetKey: 'premier-league',
            providerId: 39,
            name: 'Premier League',
            country: 'England',
            season: 2026
          },
          homeTeam: {
            id: 10,
            providerId: 100,
            name: 'Arsenal'
          },
          awayTeam: {
            id: 11,
            providerId: 101,
            name: 'Chelsea'
          }
        }
      ]
    }
    const predictionRepository = {
      listPredictionsByWindow: async () => [
        {
          id: 7,
          fixtureId: 51,
          market: 'MATCH_RESULT',
          selection: 'HOME',
          recommendation: 'CONSIDER',
          confidenceScore: 82
        },
        {
          id: 8,
          fixtureId: 51,
          market: 'OVER_UNDER_2_5',
          selection: 'OVER_2_5',
          recommendation: 'NO_RECOMMENDATION',
          confidenceScore: 64
        }
      ]
    }

    const listTodayFixtures = createListTodayFixturesUseCase({
      fixtureRepository,
      predictionRepository,
      fixturePublicViewService: createFixturePublicViewService({
        now: () => new Date('2026-07-29T12:00:00.000Z')
      }),
      now: () => new Date('2026-07-29T12:00:00.000Z'),
      lookaheadHours: 18,
      maxFixtures: 40
    })

    const fixtures = await listTodayFixtures()

    expect(fixtures).toEqual([
      {
        id: 51,
        competition: {
          id: 1,
          key: 'premier-league',
          name: 'Premier League',
          country: 'England',
          season: 2026
        },
        homeTeam: {
          id: 10,
          key: '10',
          name: 'Arsenal'
        },
        awayTeam: {
          id: 11,
          key: '11',
          name: 'Chelsea'
        },
        kickoffAt: '2026-07-29T18:00:00.000Z',
        status: 'NS',
        isHistorical: false,
        prediction: {
          id: 7,
          market: 'MATCH_RESULT',
          selection: 'HOME',
          recommendation: 'CONSIDER',
          confidenceScore: 82
        }
      }
    ])
  })

  test('applies competition and team filters using the public keys', async () => {
    const fixtureRepository = {
      listFixturesByWindow: async () => [
        {
          id: 51,
          providerId: 9001,
          kickoffAt: '2026-07-29T18:00:00.000Z',
          status: 'NS',
          competition: {
            id: 1,
            targetKey: 'premier-league',
            providerId: 39,
            name: 'Premier League',
            country: 'England',
            season: 2026
          },
          homeTeam: {
            id: 10,
            providerId: 100,
            name: 'Arsenal'
          },
          awayTeam: {
            id: 11,
            providerId: 101,
            name: 'Chelsea'
          }
        },
        {
          id: 52,
          providerId: 9002,
          kickoffAt: '2026-07-29T20:00:00.000Z',
          status: 'NS',
          competition: {
            id: 2,
            targetKey: 'laliga',
            providerId: 140,
            name: 'La Liga',
            country: 'Spain',
            season: 2026
          },
          homeTeam: {
            id: 20,
            providerId: 200,
            name: 'Valencia'
          },
          awayTeam: {
            id: 21,
            providerId: 201,
            name: 'Sevilla'
          }
        }
      ]
    }
    const predictionRepository = {
      listPredictionsByWindow: async () => []
    }

    const listTodayFixtures = createListTodayFixturesUseCase({
      fixtureRepository,
      predictionRepository,
      fixturePublicViewService: createFixturePublicViewService({
        now: () => new Date('2026-07-29T12:00:00.000Z')
      }),
      now: () => new Date('2026-07-29T12:00:00.000Z'),
      lookaheadHours: 18,
      maxFixtures: 40
    })

    await expect(
      listTodayFixtures({
        competition: 'premier-league',
        team: '11'
      })
    ).resolves.toHaveLength(1)
    await expect(
      listTodayFixtures({
        competition: 'laliga',
        team: '11'
      })
    ).resolves.toEqual([])
    await expect(
      listTodayFixtures({
        competition: 'unknown',
        team: '999'
      })
    ).resolves.toEqual([])
  })
})
