import { PredictionModelError } from '../errors/PredictionModelError.js'
import { DEFAULT_PREDICTION_MODEL_CONFIG } from '../constants/modelDefaults.js'
import { approximatelyEqual } from '../../../shared/math/probability.js'

function mergeConfig(baseConfig, overrideConfig) {
  if (!overrideConfig || typeof overrideConfig !== 'object') {
    return baseConfig
  }

  const merged = { ...baseConfig }

  for (const [key, value] of Object.entries(overrideConfig)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseConfig[key] &&
      typeof baseConfig[key] === 'object' &&
      !Array.isArray(baseConfig[key])
    ) {
      merged[key] = mergeConfig(baseConfig[key], value)
      continue
    }

    merged[key] = value
  }

  return merged
}

export function createPredictionModelConfig(overrides = {}) {
  const config = mergeConfig(DEFAULT_PREDICTION_MODEL_CONFIG, overrides)
  const weightEntries = Object.values(config.blend.weights)
  const weightSum = weightEntries.reduce(
    (accumulator, value) => accumulator + value,
    0
  )

  if (!approximatelyEqual(weightSum, 1, config.tolerance.probability * 10)) {
    throw new PredictionModelError('Prediction blend weights must sum to 1', {
      weights: config.blend.weights,
      weightSum
    })
  }

  if (config.form.weights.length !== config.form.windowSize) {
    throw new PredictionModelError(
      'Recent-form weights length must match the configured window size',
      {
        windowSize: config.form.windowSize,
        weightsLength: config.form.weights.length
      }
    )
  }

  if (config.prediction.maxGoals < 1) {
    throw new PredictionModelError(
      'Prediction maxGoals must be greater than zero'
    )
  }

  return config
}
