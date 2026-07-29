import {
  buildGoalDistribution,
  buildScoreMatrix,
  deriveBothTeamsToScoreProbabilities,
  deriveDoubleChanceProbabilities,
  deriveMatchOutcomeProbabilities,
  deriveOverUnderProbabilities,
  factorial,
  poissonProbability
} from '../src/domain/prediction/services/poissonModel.js'

describe('poisson model', () => {
  test('factorial and poisson probability are stable for simple cases', () => {
    expect(factorial(5)).toBe(120)
    expect(poissonProbability({ lambda: 1.2, goals: 0 })).toBeCloseTo(
      Math.exp(-1.2),
      10
    )
  })

  test('goal distributions normalize residual mass', () => {
    const distribution = buildGoalDistribution({
      lambda: 1.45,
      maxGoals: 6
    })
    const total = distribution.reduce(
      (accumulator, value) => accumulator + value,
      0
    )

    expect(total).toBeCloseTo(1, 8)
  })

  test('score matrices derive valid market probabilities', () => {
    const scoreMatrix = buildScoreMatrix({
      homeExpectedGoals: 1.6,
      awayExpectedGoals: 1.1,
      maxGoals: 7
    })
    const outcomes = deriveMatchOutcomeProbabilities(scoreMatrix)
    const overUnder = deriveOverUnderProbabilities(scoreMatrix)
    const btts = deriveBothTeamsToScoreProbabilities(scoreMatrix)
    const doubleChance = deriveDoubleChanceProbabilities(outcomes)

    expect(outcomes.homeWin + outcomes.draw + outcomes.awayWin).toBeCloseTo(
      1,
      6
    )
    expect(overUnder.over + overUnder.under).toBeCloseTo(1, 6)
    expect(btts.yes + btts.no).toBeCloseTo(1, 6)
    expect(doubleChance.chance1X).toBeCloseTo(
      outcomes.homeWin + outcomes.draw,
      6
    )
  })
})
