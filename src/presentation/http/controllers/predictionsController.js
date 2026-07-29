import { ValidationError } from '../../../shared/errors/AppError.js'

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`)
  }

  return parsed
}

export function createPredictionsController({
  listTodayPredictions,
  listTopPredictions,
  getPredictionById,
  recordManualOdds,
  explainPrediction,
  explainTodayPredictions
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
    },

    async createPredictionExplanation(request, response) {
      const predictionId = parsePositiveInteger(
        request.params.id,
        'predictionId'
      )
      const force = request.body?.force

      if (force !== undefined && typeof force !== 'boolean') {
        throw new ValidationError('force must be a boolean when provided')
      }

      const result = await explainPrediction({
        predictionId,
        force: force === true
      })

      response.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId: request.requestId
        }
      })
    },

    async createTodayExplanations(request, response) {
      const limit = request.body?.limit

      if (
        limit !== undefined &&
        (!Number.isInteger(limit) || limit <= 0 || limit > 40)
      ) {
        throw new ValidationError('limit must be an integer between 1 and 40')
      }

      const result = await explainTodayPredictions({
        limit: limit ?? 40
      })

      response.status(200).json({
        success: true,
        data: result,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
