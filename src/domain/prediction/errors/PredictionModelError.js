import { ValidationError } from '../../../shared/errors/AppError.js'

export class PredictionModelError extends ValidationError {
  constructor(message, details) {
    super(message, details)
    this.code = 'PREDICTION_MODEL_ERROR'
  }
}
