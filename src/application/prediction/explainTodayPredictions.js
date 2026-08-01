export function createExplainTodayPredictionsUseCase({
  listTodayPredictions,
  explainPrediction,
  maxBatchSize = 5
}) {
  return async function explainTodayPredictions({ limit = maxBatchSize } = {}) {
    const requestedLimit = Math.min(limit, maxBatchSize)
    const explainablePredictions = (await listTodayPredictions())
      .filter(
        (prediction) =>
          !prediction.explanation ||
          ['EXPLANATION_PENDING', 'EXPLANATION_FALLBACK'].includes(
            prediction.explanation.status
          )
      )
      .sort((left, right) => {
        const byDailyTop = Number(right.isDailyTop) - Number(left.isDailyTop)

        if (byDailyTop !== 0) {
          return byDailyTop
        }

        const byRecommendation =
          Number(right.recommendation === 'CONSIDER') -
          Number(left.recommendation === 'CONSIDER')

        if (byRecommendation !== 0) {
          return byRecommendation
        }

        const byConfidence = right.confidenceScore - left.confidenceScore

        if (byConfidence !== 0) {
          return byConfidence
        }

        const byEdge = Math.abs(right.edgePp ?? 0) - Math.abs(left.edgePp ?? 0)

        if (byEdge !== 0) {
          return byEdge
        }

        return left.id - right.id
      })
      .slice(0, requestedLimit)

    const results = []

    for (let index = 0; index < explainablePredictions.length; index += 1) {
      const prediction = explainablePredictions[index]
      results.push(
        await explainPrediction({
          predictionId: prediction.id,
          strategy: 'auto',
          rank: index + 1
        })
      )
    }

    return {
      status: 'ok',
      explainablePredictions: explainablePredictions.length,
      processedCount: results.length,
      readyCount: results.filter((result) => result.status === 'ready').length,
      fallbackCount: results.filter((result) => result.status === 'fallback')
        .length,
      unavailableCount: results.filter(
        (result) => result.status === 'unavailable'
      ).length,
      alreadyProcessingCount: results.filter(
        (result) => result.status === 'already_processing'
      ).length,
      alreadyExplainedCount: results.filter(
        (result) => result.status === 'already_explained'
      ).length,
      results
    }
  }
}
