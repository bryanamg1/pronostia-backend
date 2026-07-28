import { DATA_QUALITY_STATUS } from '../../../domain/prediction/constants/modelDefaults.js'
import { createChronologicalPredictionEngine } from '../services/chronologicalPredictionEngine.js'
import {
  evaluatePredictionAgainstFixture,
  summarizeEvaluationResults
} from '../services/evaluationMetrics.js'

export function createEvaluateHistoricalModelUseCase({
  competitionRepository,
  fixtureRepository,
  modelVersionRepository,
  historicalPredictionRepository,
  modelEvaluationRepository,
  modelConfig,
  now = () => new Date()
}) {
  const engine = createChronologicalPredictionEngine({
    config: modelConfig,
    now
  })

  return async function evaluateHistoricalModel({ competitionKey, season }) {
    const competition =
      await competitionRepository.findCompetitionByTargetKeyAndSeason({
        targetKey: competitionKey,
        season
      })

    if (!competition) {
      return {
        status: 'not_found',
        competitionKey,
        season
      }
    }

    const fixtures = await fixtureRepository.listCompletedFixturesByCompetition(
      {
        competitionId: competition.id
      }
    )

    if (fixtures.length < engine.config.evaluation.minFixturesForEvaluation) {
      return {
        status: 'insufficient_persisted_history',
        competitionKey,
        season,
        persistedFixtures: fixtures.length,
        minimumRequiredFixtures:
          engine.config.evaluation.minFixturesForEvaluation
      }
    }

    const modelVersion = await modelVersionRepository.upsertModelVersion({
      version: engine.config.modelVersion,
      modelType: engine.config.modelType,
      parameters: engine.config,
      status: 'ACTIVE'
    })
    const result = engine.evaluateFixtures(fixtures)
    const evaluations = []

    for (const entry of result.predictions) {
      await historicalPredictionRepository.upsertHistoricalPrediction({
        modelVersionId: modelVersion.id,
        fixtureId: entry.prediction.fixtureId,
        cutoffAt: entry.prediction.inputs.historicalCutoff,
        expectedHomeGoals: entry.prediction.expectedGoals.home,
        expectedAwayGoals: entry.prediction.expectedGoals.away,
        probabilities: entry.prediction.probabilities,
        dataQuality: entry.prediction.dataQuality
      })

      if (entry.prediction.dataQuality.status !== DATA_QUALITY_STATUS.INVALID) {
        evaluations.push({
          ...evaluatePredictionAgainstFixture({
            prediction: entry.prediction,
            fixture: entry.fixture
          }),
          prediction: entry.prediction.probabilities
        })
      }
    }

    const metrics = summarizeEvaluationResults({
      evaluations,
      excludedFixtures: result.excludedFixtures
    })
    const persistedEvaluation =
      await modelEvaluationRepository.upsertModelEvaluation({
        modelVersionId: modelVersion.id,
        competitionId: competition.id,
        season,
        fixturesEvaluated: metrics.fixturesEvaluated,
        fixturesExcluded: metrics.fixturesExcluded,
        metrics: {
          ...metrics,
          cutoffRule: engine.config.prediction.sameKickoffRule
        },
        evaluatedAt: now().toISOString()
      })

    return {
      status: 'ok',
      competition,
      modelVersion,
      metrics,
      excludedFixtures: result.excludedFixtures,
      persistedEvaluation
    }
  }
}
