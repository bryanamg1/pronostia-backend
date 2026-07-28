import { normalizeProviderFixture } from '../src/domain/sports/normalizeProviderFixture.js'
import { apiFootballHistoricalFixture1208021 } from './fixtures/apiFootballHistoricalFixture1208021.js'

describe('historical sports sample', () => {
  test('sanitized historical sample remains clearly marked and normalizable', () => {
    expect(apiFootballHistoricalFixture1208021.mode).toBe('HISTORICAL_REPLAY')
    expect(apiFootballHistoricalFixture1208021.provider).toBe('api-football')
    expect(apiFootballHistoricalFixture1208021.sanitized).toBe(true)

    const normalized = normalizeProviderFixture({
      payload: apiFootballHistoricalFixture1208021.fixture,
      competitionId: 39
    })

    expect(normalized.providerId).toBe(1208021)
    expect(normalized.competitionId).toBe(39)
    expect(normalized.status).toBe('FT')
    expect(normalized.homeGoals).toBe(1)
    expect(normalized.awayGoals).toBe(0)
    expect(normalized.homeTeam.name).toBe('Manchester United')
    expect(normalized.awayTeam.name).toBe('Fulham')
    expect(JSON.stringify(apiFootballHistoricalFixture1208021)).not.toContain(
      'x-apisports-key'
    )
  })
})
