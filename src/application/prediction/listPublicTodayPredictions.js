import { assertAuthorizedCompetitionKey } from '../../domain/sports/competitionCatalog.js'

function matchesFilters(prediction, filters) {
  if (
    filters.competition &&
    prediction.fixture?.competition?.targetKey !== filters.competition
  ) {
    return false
  }

  if (filters.market && prediction.selection.market !== filters.market) {
    return false
  }

  if (
    filters.recommendation &&
    prediction.selection.recommendation !== filters.recommendation
  ) {
    return false
  }

  if (
    filters.dataQuality &&
    prediction.analysis?.dataQuality?.status !== filters.dataQuality
  ) {
    return false
  }

  if (
    filters.explanationSource &&
    prediction.explanation?.source !== filters.explanationSource
  ) {
    return false
  }

  return true
}

export function createListPublicTodayPredictionsUseCase({
  listStoredTodayPredictions,
  predictionPublicViewService
}) {
  return async function listTodayPredictions({ filters = {} } = {}) {
    if (filters.competition) {
      assertAuthorizedCompetitionKey(filters.competition)
    }

    const predictions = await listStoredTodayPredictions()
    const publicPredictions =
      await predictionPublicViewService.toPublicPredictions(predictions)

    return publicPredictions.filter((prediction) =>
      matchesFilters(prediction, filters)
    )
  }
}
