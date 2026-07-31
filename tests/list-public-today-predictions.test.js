import { ValidationError } from '../src/shared/errors/AppError.js'
import { createListPublicTodayPredictionsUseCase } from '../src/application/prediction/listPublicTodayPredictions.js'

describe('listPublicTodayPredictions use case', () => {
  test('rejects unsupported competition keys', async () => {
    const listTodayPredictions = createListPublicTodayPredictionsUseCase({
      listStoredTodayPredictions: async () => [],
      predictionPublicViewService: {
        async toPublicPredictions(predictions) {
          return predictions
        }
      }
    })

    await expect(
      listTodayPredictions({
        filters: {
          competition: 'serie-a'
        }
      })
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
