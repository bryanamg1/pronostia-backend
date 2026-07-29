export function createExplainTodayPredictionsUseCase({
  listTodayPredictions,
  explainPrediction,
  maxBatchSize = 40
}) {
  return async function explainTodayPredictions({ limit = maxBatchSize } = {}) {
    const explainablePredictions = (await listTodayPredictions())
      .filter((prediction) => prediction.recommendation === 'CONSIDER')
      .filter(
        (prediction) =>
          !prediction.explanation ||
          prediction.explanation.status === 'EXPLANATION_PENDING'
      )
      .sort((left, right) => {
        const leftScore = left.confidenceScore + left.edgePp
        const rightScore = right.confidenceScore + right.edgePp
        return rightScore - leftScore
      })
      .slice(0, limit)

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
      readyCount: results.filter((result) => result.status === 'ready').length,
      fallbackCount: results.filter((result) => result.status === 'fallback')
        .length,
      results
    }
  }
}
