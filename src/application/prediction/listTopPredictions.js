export function createListTopPredictionsUseCase({ listTodayPredictions }) {
  return async function listTopPredictions() {
    const predictions = await listTodayPredictions()
    const bestByFixture = new Map()

    for (const prediction of predictions) {
      const current = bestByFixture.get(prediction.fixtureId)
      const currentScore =
        (current?.confidenceScore ?? 0) + (current?.edgePp ?? 0)
      const nextScore = prediction.confidenceScore + prediction.edgePp

      if (!current || nextScore > currentScore) {
        bestByFixture.set(prediction.fixtureId, prediction)
      }
    }

    return [...bestByFixture.values()]
      .sort((left, right) => {
        const leftScore = left.confidenceScore + left.edgePp
        const rightScore = right.confidenceScore + right.edgePp
        return rightScore - leftScore
      })
      .slice(0, 5)
  }
}
