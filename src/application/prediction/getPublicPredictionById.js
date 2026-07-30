import { NotFoundError } from '../../shared/errors/AppError.js'

export function createGetPublicPredictionByIdUseCase({
  predictionRepository,
  predictionPublicViewService
}) {
  return async function getPredictionById(id) {
    const prediction = await predictionRepository.findPredictionById(id)

    if (!prediction) {
      throw new NotFoundError('Prediction not found')
    }

    return predictionPublicViewService.toPublicPrediction(prediction)
  }
}
