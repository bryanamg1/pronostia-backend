import {
  extractApiFootballOddsRows,
  selectPreferredApiFootballBookmaker
} from '../src/application/prediction/services/apiFootballOdds.js'
import { assessPilotDatabaseSafety } from '../src/application/sports/runCurrentPredictionPilot.js'

describe('api-football odds mapping', () => {
  test('selects the preferred bookmaker with the most complete supported markets', () => {
    const selected = selectPreferredApiFootballBookmaker([
      {
        bookmaker: 'Betano',
        rows: [
          {
            market: 'MATCH_RESULT',
            selection: 'HOME'
          },
          {
            market: 'MATCH_RESULT',
            selection: 'DRAW'
          },
          {
            market: 'MATCH_RESULT',
            selection: 'AWAY'
          }
        ]
      },
      {
        bookmaker: 'Bet365',
        rows: [
          {
            market: 'MATCH_RESULT',
            selection: 'HOME'
          },
          {
            market: 'MATCH_RESULT',
            selection: 'DRAW'
          },
          {
            market: 'MATCH_RESULT',
            selection: 'AWAY'
          },
          {
            market: 'OVER_UNDER_2_5',
            selection: 'OVER_2_5'
          },
          {
            market: 'OVER_UNDER_2_5',
            selection: 'UNDER_2_5'
          }
        ]
      }
    ])

    expect(selected.bookmaker).toBe('Bet365')
    expect(selected.completedMarkets).toBe(2)
  })

  test('extracts supported rows from a provider fixture odds payload', () => {
    const result = extractApiFootballOddsRows({
      fixtureId: 763,
      oddsResponseItem: {
        update: '2026-08-01T10:00:00.000Z',
        bookmakers: [
          {
            name: 'Bet365',
            bets: [
              {
                name: 'Match Winner',
                values: [
                  { value: 'Home', odd: '2.10' },
                  { value: 'Draw', odd: '3.30' },
                  { value: 'Away', odd: '3.80' }
                ]
              },
              {
                name: 'Goals Over/Under',
                values: [
                  { value: 'Over 2.5', odd: '1.95' },
                  { value: 'Under 2.5', odd: '1.87' }
                ]
              }
            ]
          }
        ]
      }
    })

    expect(result.selectedBookmaker).toBe('Bet365')
    expect(result.completedMarkets).toBe(2)
    expect(result.rows).toHaveLength(5)
    expect(result.rows.every((row) => row.sourceType === 'API')).toBe(true)
  })

  test('pilot database safety allows local development targets and blocks production-like names', () => {
    expect(
      assessPilotDatabaseSafety({
        nodeEnv: 'development',
        host: 'localhost',
        name: 'pronostia'
      }).status
    ).toBe('LOCAL_DEV_SAFE')
    expect(
      assessPilotDatabaseSafety({
        nodeEnv: 'production',
        host: 'db.example.com',
        name: 'pronostia-prod'
      }).status
    ).toBe('PILOT_DATABASE_NOT_SAFE')
  })
})
