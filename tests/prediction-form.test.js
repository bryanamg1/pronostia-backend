import { DEFAULT_PREDICTION_MODEL_CONFIG } from '../src/domain/prediction/constants/modelDefaults.js'
import { buildWeightedRecentForm } from '../src/domain/prediction/services/recentForm.js'
import { createPredictionHistoricalFixtures } from './fixtures/predictionHistoricalFixtures.js'

describe('weighted recent form', () => {
  test('returns weighted points, venue form, and sample flags', () => {
    const fixtures = createPredictionHistoricalFixtures()
    const form = buildWeightedRecentForm({
      fixtures: fixtures.slice(0, 4),
      teamId: 101,
      config: DEFAULT_PREDICTION_MODEL_CONFIG,
      ratingResolver: () => 1500
    })

    expect(form.sampleSize).toBe(4)
    expect(form.weightedPoints).toBeGreaterThan(0)
    expect(form.homeForm).toBeGreaterThanOrEqual(0)
    expect(form.awayForm).toBeGreaterThanOrEqual(0)
    expect(form.dataQualityFlags).toEqual([])
  })

  test('small recent windows are flagged', () => {
    const fixtures = createPredictionHistoricalFixtures()
    const form = buildWeightedRecentForm({
      fixtures: fixtures.slice(0, 1),
      teamId: 101,
      config: DEFAULT_PREDICTION_MODEL_CONFIG,
      ratingResolver: () => 1500
    })

    expect(form.dataQualityFlags).toContain('LOW_RECENT_FORM_SAMPLE')
  })
})
