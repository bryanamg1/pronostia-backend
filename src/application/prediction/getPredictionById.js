import { NotFoundError } from '../../shared/errors/AppError.js'

export function createGetPredictionByIdUseCase({ predictionRepository }) {
  return async function getPredictionById(id) {
    const prediction = await predictionRepository.findPredictionById(id)

    if (!prediction) {
      throw new NotFoundError('Prediction not found')
    }

    return prediction
  }
}
