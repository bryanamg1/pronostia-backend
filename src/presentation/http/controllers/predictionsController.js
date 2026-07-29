export function createPredictionsController({
  listTodayPredictions,
  listTopPredictions,
  getPredictionById,
  recordManualOdds
}) {
  return {
    async getTodayPredictions(request, response) {
      const predictions = await listTodayPredictions()

      response.status(200).json({
        success: true,
        data: predictions,
        meta: {
          requestId: request.requestId
        }
      })
    },

    async getTopPredictions(request, response) {
      const predictions = await listTopPredictions()

      response.status(200).json({
        success: true,
        data: predictions,
        meta: {
          requestId: request.requestId
        }
      })
    },

    async getPredictionById(request, response) {
      const prediction = await getPredictionById(request.params.id)

      response.status(200).json({
        success: true,
        data: prediction,
        meta: {
          requestId: request.requestId
        }
      })
    },

    async createManualOdds(request, response) {
      const result = await recordManualOdds(request.body)

      response.status(201).json({
        success: true,
        data: result,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
