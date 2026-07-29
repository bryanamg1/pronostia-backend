import { createChronologicalPredictionEngine } from '../services/chronologicalPredictionEngine.js'

export function createGenerateHistoricalPredictionUseCase({
  fixtureRepository,
  historicalPredictionRepository,
  modelVersionRepository,
  modelConfig,
  now = () => new Date()
}) {
  const engine = createChronologicalPredictionEngine({
    config: modelConfig,
    now
  })

  return async function generateHistoricalPrediction({ fixtureId }) {
    const fixture = await fixtureRepository.findFixtureById(fixtureId)

    if (!fixture) {
      return {
        status: 'not_found',
        fixtureId
      }
    }

    const fixtures = await fixtureRepository.listFixturesByCompetition({
      competitionId: fixture.competition.id
    })
    const prediction = engine.predictFixture({
      fixtures,
      fixtureId
    })

    if (!prediction) {
      return {
        status: 'not_found',
        fixtureId
      }
    }

    const modelVersion = await modelVersionRepository.upsertModelVersion({
      version: engine.config.modelVersion,
      modelType: engine.config.modelType,
      parameters: engine.config,
      status: 'ACTIVE'
    })

    const persistedPrediction =
      prediction.inputs.sampleSizeHome >=
        engine.config.evaluation.minSamplesPerTeam &&
      prediction.inputs.sampleSizeAway >=
        engine.config.evaluation.minSamplesPerTeam
        ? await historicalPredictionRepository.upsertHistoricalPrediction({
            modelVersionId: modelVersion.id,
            fixtureId: prediction.fixtureId,
            cutoffAt: prediction.inputs.historicalCutoff,
            expectedHomeGoals: prediction.expectedGoals.home,
            expectedAwayGoals: prediction.expectedGoals.away,
            probabilities: prediction.probabilities,
            dataQuality: prediction.dataQuality
          })
        : null

    return {
      status: 'ok',
      modelVersion,
      prediction,
      persistedPrediction
    }
  }
}
