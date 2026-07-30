import { createChronologicalPredictionEngine } from './chronologicalPredictionEngine.js'

function toPublicExplanation(explanation) {
  if (!explanation) {
    return null
  }

  const content = explanation.content ?? {}

  return {
    status: explanation.status ?? null,
    source: explanation.source ?? null,
    generatedAt: explanation.generatedAt ?? null,
    summary: content.summary ?? null,
    supportingFactors: Array.isArray(content.supportingFactors)
      ? content.supportingFactors
      : [],
    counterFactors: Array.isArray(content.counterFactors)
      ? content.counterFactors
      : [],
    warnings: Array.isArray(content.warnings) ? content.warnings : [],
    responsibleUseNotice: content.responsibleUseNotice ?? null
  }
}

function toPublicAnalysis(analysis) {
  if (!analysis) {
    return null
  }

  return {
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
    analysis: toPublicAnalysis(analysis),
    explanation: toPublicExplanation(prediction.explanation),
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
