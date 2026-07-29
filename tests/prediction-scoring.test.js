import {
  scorePredictionSelection,
  selectPreferredMarketOdds
} from '../src/domain/prediction/services/oddsScoring.js'

describe('prediction scoring', () => {
  const basePrediction = {
    probabilities: {
      homeWin: 0.58,
      draw: 0.24,
      awayWin: 0.18,
      over25: 0.61,
      under25: 0.39,
      bttsYes: 0.54,
      bttsNo: 0.46,
      doubleChance1X: 0.82,
      doubleChanceX2: 0.42,
      doubleChance12: 0.76
    },
    inputs: {
      sampleSizeHome: 10,
      sampleSizeAway: 11
    },
    dataQuality: {
      status: 'SUFFICIENT',
      flags: []
    },
    components: {
      signals: {
        poisson: 0.42,
        elo: 0.37,
        form: 0.33
      }
    }
  }

  test('selects a complete manual market over an api market and normalizes overround', () => {
    const groups = selectPreferredMarketOdds([
      {
        fixtureId: 1,
        bookmaker: 'ApiBook',
        market: 'MATCH_RESULT',
        selection: 'HOME',
        decimalOdds: 1.8,
        sourceType: 'API',
        capturedAt: '2026-07-29T09:00:00.000Z'
      },
      {
        fixtureId: 1,
        bookmaker: 'ApiBook',
        market: 'MATCH_RESULT',
        selection: 'DRAW',
        decimalOdds: 3.6,
        sourceType: 'API',
        capturedAt: '2026-07-29T09:00:00.000Z'
      },
      {
        fixtureId: 1,
        bookmaker: 'ApiBook',
        market: 'MATCH_RESULT',
        selection: 'AWAY',
        decimalOdds: 4.8,
        sourceType: 'API',
        capturedAt: '2026-07-29T09:00:00.000Z'
      },
      {
        fixtureId: 1,
        bookmaker: 'ManualBook',
        market: 'MATCH_RESULT',
        selection: 'HOME',
        decimalOdds: 1.85,
        sourceType: 'MANUAL',
        capturedAt: '2026-07-29T10:00:00.000Z'
      },
      {
        fixtureId: 1,
        bookmaker: 'ManualBook',
        market: 'MATCH_RESULT',
        selection: 'DRAW',
        decimalOdds: 3.5,
        sourceType: 'MANUAL',
        capturedAt: '2026-07-29T10:00:00.000Z'
      },
      {
        fixtureId: 1,
        bookmaker: 'ManualBook',
        market: 'MATCH_RESULT',
        selection: 'AWAY',
        decimalOdds: 4.4,
        sourceType: 'MANUAL',
        capturedAt: '2026-07-29T10:00:00.000Z'
      }
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].bookmaker).toBe('ManualBook')
    expect(groups[0].sourceType).toBe('MANUAL')
    expect(groups[0].completeness).toBe(1)
    expect(
      Object.values(groups[0].normalizedProbabilities).reduce(
        (total, value) => total + value,
        0
      )
    ).toBeCloseTo(1, 8)
  })

  test('returns a recommendation only when edge, freshness and quality are acceptable', () => {
    const favorable = scorePredictionSelection({
      prediction: basePrediction,
      market: 'MATCH_RESULT',
      selection: 'HOME',
      marketProbability: 0.5,
      decimalOdds: 1.9,
      bookmaker: 'ManualBook',
      sourceType: 'MANUAL',
      capturedAt: '2026-07-29T09:00:00.000Z',
      overround: 1.05,
      now: new Date('2026-07-29T10:00:00.000Z')
    })

    expect(favorable.recommendation).toBe('CONSIDER')
    expect(favorable.riskLevel).toBe('LOW')
    expect(favorable.confidenceScore).toBeGreaterThanOrEqual(70)
    expect(favorable.edgePp).toBeGreaterThanOrEqual(5)

    const stale = scorePredictionSelection({
      prediction: basePrediction,
      market: 'MATCH_RESULT',
      selection: 'HOME',
      marketProbability: 0.56,
      decimalOdds: 1.9,
      bookmaker: 'ManualBook',
      sourceType: 'MANUAL',
      capturedAt: '2026-07-26T00:00:00.000Z',
      overround: 1.05,
      now: new Date('2026-07-29T10:00:00.000Z')
    })

    expect(stale.recommendation).toBe('NO_RECOMMENDATION')
    expect(stale.riskLevel).toBe('HIGH')
  })
})
