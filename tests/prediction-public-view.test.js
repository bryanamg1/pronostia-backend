import { createPredictionPublicViewService } from '../src/application/prediction/services/predictionPublicView.js'
import { DEFAULT_PREDICTION_MODEL_CONFIG } from '../src/domain/prediction/constants/modelDefaults.js'
import { createPredictionHistoricalFixtures } from './fixtures/predictionHistoricalFixtures.js'

describe('prediction public view service', () => {
  test('sanitizes explanation internals and enriches the public DTO with analysis data', async () => {
    const fixtures = createPredictionHistoricalFixtures()
    const targetFixture = fixtures.at(-1)
    const service = createPredictionPublicViewService({
      fixtureRepository: {
        async listFixturesByCompetition() {
          return fixtures
        }
      },
      modelConfig: DEFAULT_PREDICTION_MODEL_CONFIG
    })

    const publicPrediction = await service.toPublicPrediction({
      id: 17,
      fixtureId: targetFixture.id,
      market: 'MATCH_RESULT',
      selection: 'HOME',
      modelProbability: 0.55,
      marketProbability: 0.49,
      edgePp: 6,
      confidenceScore: 76,
      riskLevel: 'LOW',
      recommendation: 'CONSIDER',
      modelVersion: 'historical-first-v1',
      explanation: {
        status: 'EXPLANATION_READY',
        source: 'OPENAI',
        generatedAt: '2026-07-29T15:00:00.000Z',
        model: 'gpt-5-mini-2025-08-07',
        budget: {
          state: 'AVAILABLE'
        },
        content: {
          summary: 'Resumen',
          supportingFactors: ['Factor 1'],
          counterFactors: ['Factor 2'],
          warnings: ['Uso responsable'],
          responsibleUseNotice: 'Uso responsable'
        },
        metadata: {
          requestId: 'resp_sensitive',
          usage: {
            inputTokens: 10
          }
        }
      },
      isDailyTop: true,
      createdAt: '2026-07-29T15:00:00.000Z',
      updatedAt: '2026-07-29T15:30:00.000Z',
      fixture: targetFixture
    })

    expect(publicPrediction.selection.market).toBe('MATCH_RESULT')
    expect(publicPrediction.analysis.expectedGoals.home).toBeGreaterThan(0)
    expect(publicPrediction.analysis.probabilities.homeWin).toBeGreaterThan(0)
    expect(publicPrediction.analysis.dataQuality.status).toBeTruthy()
    expect(publicPrediction.analysis.historicalCutoff).toBeTruthy()
    expect(publicPrediction.historicalCutoff).toBeTruthy()
    expect(publicPrediction.explanation.summary).toBe('Resumen')
    expect(publicPrediction.explanationSource).toBe('OPENAI')
    expect(publicPrediction.explanation.metadata).toBeUndefined()
    expect(publicPrediction.explanation.budget).toBeUndefined()
    expect(publicPrediction.explanation.model).toBeUndefined()
    expect(publicPrediction.sources).toBeUndefined()
  })
})
