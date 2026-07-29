import {
  calculateExpectedScore,
  regressRating,
  updateEloRatings
} from '../src/domain/prediction/services/eloModel.js'

describe('elo model', () => {
  const config = {
    initialRating: 1500,
    kFactor: 24,
    homeAdvantage: 50,
    seasonRegressionFactor: 0.25
  }

  test('equal ratings produce a home edge when home advantage exists', () => {
    const expectedScore = calculateExpectedScore({
      teamRating: 1500,
      opponentRating: 1500,
      advantage: config.homeAdvantage
    })

    expect(expectedScore).toBeGreaterThan(0.5)
  })

  test('unexpected away win moves ratings symmetrically', () => {
    const result = updateEloRatings({
      homeRating: 1600,
      awayRating: 1450,
      homeGoals: 0,
      awayGoals: 1,
      config
    })

    expect(result.homeRating).toBeLessThan(1600)
    expect(result.awayRating).toBeGreaterThan(1450)
    expect(result.homeExpectedScore + result.awayExpectedScore).toBeCloseTo(
      1,
      6
    )
  })

  test('draw updates ratings deterministically', () => {
    const firstRun = updateEloRatings({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 1,
      awayGoals: 1,
      config
    })
    const secondRun = updateEloRatings({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 1,
      awayGoals: 1,
      config
    })

    expect(firstRun).toEqual(secondRun)
  })

  test('season regression moves ratings toward the baseline', () => {
    expect(
      regressRating({
        rating: 1700,
        baselineRating: config.initialRating,
        regressionFactor: config.seasonRegressionFactor
      })
    ).toBe(1650)
  })
})
