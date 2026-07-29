function toMySqlDateTime(value) {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

export function createListTodayPredictionsUseCase({
  predictionRepository,
  lookaheadHours,
  now = () => new Date()
}) {
  return async function listTodayPredictions() {
    const from = now()
    const to = new Date(from.getTime() + lookaheadHours * 60 * 60 * 1000)

    return predictionRepository.listPredictionsByWindow({
      from: toMySqlDateTime(from),
      to: toMySqlDateTime(to)
    })
  }
}
