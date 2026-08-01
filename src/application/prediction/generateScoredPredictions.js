import { NotFoundError } from '../../shared/errors/AppError.js'
import {
  scorePredictionSelection,
  selectPreferredMarketOdds
} from '../../domain/prediction/services/oddsScoring.js'
import { RECOMMENDATION_TYPES } from '../../domain/prediction/constants/scoringDefaults.js'
import { createPendingExplanation } from '../../domain/prediction/services/predictionExplanation.js'

function toWindowBounds(now, lookaheadHours) {
  const from = new Date(now)
  const to = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000)

  return {
    from: from.toISOString(),
    to: to.toISOString()
  }
}

export function createGenerateScoredPredictionsUseCase({
  generateHistoricalPrediction,
  oddsRepository,
  predictionRepository,
  lookaheadHours,
  now = () => new Date()
}) {
  return async function generateScoredPredictions({ fixtureId, runId = null }) {
    const modelResult = await generateHistoricalPrediction({ fixtureId })

    if (modelResult.status === 'not_found') {
      throw new NotFoundError('Fixture not found')
    }

    const oddsRows = await oddsRepository.listLatestOddsByFixtureId(fixtureId)

    if (oddsRows.length === 0) {
      return {
        status: 'odds_not_found',
        fixtureId,
        modelVersion: modelResult.modelVersion,
        prediction: modelResult.prediction
      }
    }

    const selectedMarkets = selectPreferredMarketOdds(oddsRows)

    if (selectedMarkets.length === 0) {
      return {
        status: 'odds_incomplete',
        fixtureId,
        modelVersion: modelResult.modelVersion,
        prediction: modelResult.prediction
      }
    }

    const scoredSelections = []

    for (const marketGroup of selectedMarkets) {
      for (const marketSelection of marketGroup.selections) {
        const scoredSelection = scorePredictionSelection({
          prediction: modelResult.prediction,
          market: marketGroup.market,
          selection: marketSelection.selection,
          marketProbability:
            marketGroup.normalizedProbabilities[marketSelection.selection],
          decimalOdds: marketSelection.decimalOdds,
          bookmaker: marketGroup.bookmaker,
          sourceType: marketGroup.sourceType,
          capturedAt: marketGroup.capturedAt,
          overround: marketGroup.overround,
          normalizationMethod: marketGroup.normalizationMethod,
          derivedFromMarket: marketGroup.derivedFromMarket,
          marketCompleteness: marketGroup.completeness,
          now: now()
        })

        if (scoredSelection) {
          scoredSelections.push(scoredSelection)
        }
      }
    }

    const topCandidate = [...scoredSelections]
      .filter(
        (candidate) =>
          candidate.recommendation === RECOMMENDATION_TYPES.CONSIDER
      )
      .sort((left, right) => right.rankingScore - left.rankingScore)[0]

    const persistedPredictions = []

    for (const candidate of scoredSelections) {
      const persistedPrediction = await predictionRepository.upsertPrediction({
        runId,
        fixtureId,
        market: candidate.market,
        selection: candidate.selection,
        modelProbability: candidate.modelProbability,
        marketProbability: candidate.marketProbability,
        edgePp: candidate.edgePp,
        confidenceScore: candidate.confidenceScore,
        riskLevel: candidate.riskLevel,
        recommendation: candidate.recommendation,
        modelVersion: modelResult.modelVersion.version,
        explanation:
          candidate.recommendation === RECOMMENDATION_TYPES.CONSIDER
            ? createPendingExplanation()
            : null,
        sources: candidate.source,
        isDailyTop:
          topCandidate &&
          topCandidate.market === candidate.market &&
          topCandidate.selection === candidate.selection
      })

      persistedPredictions.push({
        ...persistedPrediction,
        rankingScore: candidate.rankingScore
      })
    }

    return {
      status: 'ok',
      fixtureId,
      window: toWindowBounds(now(), lookaheadHours),
      modelVersion: modelResult.modelVersion,
      underlyingPrediction: modelResult.prediction,
      predictions: persistedPredictions
    }
  }
}
