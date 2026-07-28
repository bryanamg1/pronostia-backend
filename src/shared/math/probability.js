const EPSILON = 1e-9

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function safeDivide(value, divisor, fallback = 0) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) {
    return fallback
  }

  return value / divisor
}

export function normalizeProbabilityPair(first, second) {
  const total = first + second

  if (!Number.isFinite(total) || total <= 0) {
    return [0.5, 0.5]
  }

  return [first / total, second / total]
}

export function normalizeProbabilityTriplet(first, second, third) {
  const total = first + second + third

  if (!Number.isFinite(total) || total <= 0) {
    return [1 / 3, 1 / 3, 1 / 3]
  }

  return [first / total, second / total, third / total]
}

export function approximatelyEqual(left, right, tolerance = 1e-6) {
  return Math.abs(left - right) <= tolerance
}

export function sum(values) {
  return values.reduce((accumulator, value) => accumulator + value, 0)
}

export function roundTo(value, digits = 6) {
  const factor = 10 ** digits
  return Math.round((value + EPSILON) * factor) / factor
}
