import {
  clamp,
  normalizeProbabilityPair,
  normalizeProbabilityTriplet,
  sum
} from '../../../shared/math/probability.js'
import { PredictionModelError } from '../errors/PredictionModelError.js'

export function factorial(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new PredictionModelError('Factorial requires a non-negative integer')
  }

  if (value <= 1) {
    return 1
  }

  let result = 1

  for (let index = 2; index <= value; index += 1) {
    result *= index
  }

  return result
}

export function poissonProbability({ lambda, goals }) {
  if (lambda < 0) {
    throw new PredictionModelError('Poisson lambda must be non-negative')
  }

  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals)
}

export function buildGoalDistribution({ lambda, maxGoals }) {
  if (maxGoals < 1) {
    throw new PredictionModelError('maxGoals must be greater than zero')
  }

  const distribution = []

  for (let goals = 0; goals < maxGoals; goals += 1) {
    distribution.push(poissonProbability({ lambda, goals }))
  }

  const residual = Math.max(0, 1 - sum(distribution))
  distribution.push(residual)

  const normalizedSum = sum(distribution)

  return distribution.map((value) => value / normalizedSum)
}

export function buildScoreMatrix({
  homeExpectedGoals,
  awayExpectedGoals,
  maxGoals
}) {
  const homeDistribution = buildGoalDistribution({
    lambda: homeExpectedGoals,
    maxGoals
  })
  const awayDistribution = buildGoalDistribution({
    lambda: awayExpectedGoals,
    maxGoals
  })

  return homeDistribution.map((homeProbability, homeGoals) =>
    awayDistribution.map((awayProbability, awayGoals) => ({
      homeGoals,
      awayGoals,
      probability: homeProbability * awayProbability
    }))
  )
}

export function deriveMatchOutcomeProbabilities(scoreMatrix) {
  let homeWin = 0
  let draw = 0
  let awayWin = 0

  for (const row of scoreMatrix) {
    for (const cell of row) {
      if (cell.homeGoals > cell.awayGoals) {
        homeWin += cell.probability
      } else if (cell.homeGoals === cell.awayGoals) {
        draw += cell.probability
      } else {
        awayWin += cell.probability
      }
    }
  }

  ;[homeWin, draw, awayWin] = normalizeProbabilityTriplet(
    homeWin,
    draw,
    awayWin
  )

  return {
    homeWin,
    draw,
    awayWin
  }
}

export function deriveOverUnderProbabilities(scoreMatrix, threshold = 2.5) {
  let over = 0
  let under = 0

  for (const row of scoreMatrix) {
    for (const cell of row) {
      if (cell.homeGoals + cell.awayGoals > threshold) {
        over += cell.probability
      } else {
        under += cell.probability
      }
    }
  }

  ;[over, under] = normalizeProbabilityPair(over, under)

  return {
    over,
    under
  }
}

export function deriveBothTeamsToScoreProbabilities(scoreMatrix) {
  let yes = 0
  let no = 0

  for (const row of scoreMatrix) {
    for (const cell of row) {
      if (cell.homeGoals > 0 && cell.awayGoals > 0) {
        yes += cell.probability
      } else {
        no += cell.probability
      }
    }
  }

  ;[yes, no] = normalizeProbabilityPair(yes, no)

  return {
    yes,
    no
  }
}

export function deriveDoubleChanceProbabilities({ homeWin, draw, awayWin }) {
  return {
    chance1X: clamp(homeWin + draw, 0, 1),
    chanceX2: clamp(draw + awayWin, 0, 1),
    chance12: clamp(homeWin + awayWin, 0, 1)
  }
}
