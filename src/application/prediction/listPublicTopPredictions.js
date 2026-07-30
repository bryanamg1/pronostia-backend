export function createListPublicTopPredictionsUseCase({
  listStoredTopPredictions,
  predictionPublicViewService
}) {
  return async function listTopPredictions() {
    const predictions = await listStoredTopPredictions()
    return predictionPublicViewService.toPublicPredictions(predictions)
  }
}
