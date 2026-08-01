import { createChronologicalPredictionEngine } from './chronologicalPredictionEngine.js'
import {
  buildPublicExplanationContent,
  hasMinimumExplanationData
} from '../../../domain/prediction/services/predictionExplanation.js'
import {
  EXPLANATION_SOURCES,
  EXPLANATION_STATUSES
} from '../../../domain/prediction/constants/explanationDefaults.js'

function toPublicMarket(prediction) {
  const source = prediction.sources ?? {}

  return {
    bookmaker: source.bookmaker ?? null,
    sourceType: source.sourceType ?? null,
    capturedAt: source.capturedAt ?? null,
    decimalOdds:
      typeof source.decimalOdds === 'number' ? source.decimalOdds : null,
    normalizationMethod: source.normalizationMethod ?? null,
    derivedFromMarket: source.derivedFromMarket ?? null
  }
}

function toPublicExplanation({ explanation, prediction, analysis }) {
  const minimumDataAvailable = hasMinimumExplanationData({
    prediction,
    modelPrediction: analysis
  })

  if (!explanation && !minimumDataAvailable) {
    return {
      status: EXPLANATION_STATUSES.UNAVAILABLE,
      source: null,
      generatedAt: null,
      ...buildPublicExplanationContent({
        prediction,
        modelPrediction: analysis,
        explanation: null
      })
    }
  }

  const nextExplanation =
    explanation ??
    (minimumDataAvailable
      ? {
          status: EXPLANATION_STATUSES.FALLBACK,
          source: EXPLANATION_SOURCES.DETERMINISTIC_FALLBACK,
          generatedAt: prediction.updatedAt,
          content: null
        }
      : null)

  if (!nextExplanation) {
    return null
  }

  const content = buildPublicExplanationContent({
    prediction,
    modelPrediction: analysis,
    explanation: nextExplanation
  })

  return {
    status: nextExplanation.status ?? null,
    source: nextExplanation.source ?? null,
    generatedAt: nextExplanation.generatedAt ?? null,
    ...content
  }
}

function toPublicAnalysis(analysis) {
  if (!analysis) {
    return null
  }

  return {
    historicalCutoff: analysis.inputs?.historicalCutoff ?? null,
    expectedGoals: {
      home: analysis.expectedGoals.home,
      away: analysis.expectedGoals.away
    },
    probabilities: analysis.probabilities,
    dataQuality: {
      status: analysis.dataQuality?.status ?? null,
      flags: Array.isArray(analysis.dataQuality?.flags)
        ? analysis.dataQuality.flags
        : []
    }
  }
}

function toPublicPrediction(prediction, analysis) {
  const publicExplanation = toPublicExplanation({
    explanation: prediction.explanation,
    prediction,
    analysis
  })

  return {
    id: prediction.id,
    fixture: prediction.fixture
      ? {
          id: prediction.fixture.id,
          kickoffAt: prediction.fixture.kickoffAt,
          status: prediction.fixture.status,
          competition: {
            id: prediction.fixture.competition.id,
            targetKey: prediction.fixture.competition.targetKey,
            name: prediction.fixture.competition.name,
            country: prediction.fixture.competition.country,
            season: prediction.fixture.competition.season
          },
          homeTeam: {
            id: prediction.fixture.homeTeam.id,
            name: prediction.fixture.homeTeam.name
          },
          awayTeam: {
            id: prediction.fixture.awayTeam.id,
            name: prediction.fixture.awayTeam.name
          }
        }
      : null,
    model: {
      version: prediction.modelVersion
    },
    selection: {
      market: prediction.market,
      value: prediction.selection,
      modelProbability: prediction.modelProbability,
      marketProbability: prediction.marketProbability,
      edgePp: prediction.edgePp,
      confidenceScore: prediction.confidenceScore,
      riskLevel: prediction.riskLevel,
      recommendation: prediction.recommendation
    },
    market: toPublicMarket(prediction),
    analysis: toPublicAnalysis(analysis),
    explanation: publicExplanation,
    explanationSource: publicExplanation?.source ?? null,
    explanationStatus: publicExplanation?.status ?? null,
    historicalCutoff: analysis?.inputs?.historicalCutoff ?? null,
    isDailyTop: prediction.isDailyTop,
    createdAt: prediction.createdAt,
    updatedAt: prediction.updatedAt
  }
}

export function createPredictionPublicViewService({
  fixtureRepository,
  modelConfig,
  now = () => new Date()
}) {
  const engine = createChronologicalPredictionEngine({
    config: modelConfig,
    now
  })
  const fixturesByCompetitionCache = new Map()
  const analysisByFixtureCache = new Map()

  async function getCompetitionFixtures(competitionId) {
    if (!fixturesByCompetitionCache.has(competitionId)) {
      fixturesByCompetitionCache.set(
        competitionId,
        fixtureRepository.listFixturesByCompetition({
          competitionId
        })
      )
    }

    return fixturesByCompetitionCache.get(competitionId)
  }

  async function getAnalysisForPrediction(prediction) {
    if (analysisByFixtureCache.has(prediction.fixtureId)) {
      return analysisByFixtureCache.get(prediction.fixtureId)
    }

    const competitionId = prediction.fixture?.competition?.id

    if (!competitionId) {
      analysisByFixtureCache.set(prediction.fixtureId, null)
      return null
    }

    const fixtures = await getCompetitionFixtures(competitionId)
    const analysis = engine.predictFixture({
      fixtures,
      fixtureId: prediction.fixtureId
    })

    analysisByFixtureCache.set(prediction.fixtureId, analysis)
    return analysis
  }

  return {
    async toPublicPrediction(prediction) {
      const analysis = await getAnalysisForPrediction(prediction)
      return toPublicPrediction(prediction, analysis)
    },

    async toPublicPredictions(predictions) {
      return Promise.all(
        predictions.map((prediction) => this.toPublicPrediction(prediction))
      )
    }
  }
}
