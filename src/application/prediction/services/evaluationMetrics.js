import { safeDivide } from '../../../shared/math/probability.js'

function getActual1X2Outcome(fixture) {
  if (fixture.homeGoals > fixture.awayGoals) {
    return 'homeWin'
  }

  if (fixture.homeGoals === fixture.awayGoals) {
    return 'draw'
  }

  return 'awayWin'
}

function getActualBinaryOutcome(condition) {
  return condition ? 1 : 0
}

function getPredicted1X2Outcome(probabilities) {
  const entries = Object.entries({
    homeWin: probabilities.homeWin,
    draw: probabilities.draw,
    awayWin: probabilities.awayWin
  })

  entries.sort((left, right) => right[1] - left[1])
  return entries[0][0]
}

function calculateMulticlassBrier(probabilities, actualKey) {
  return (
    (probabilities.homeWin - (actualKey === 'homeWin' ? 1 : 0)) ** 2 +
    (probabilities.draw - (actualKey === 'draw' ? 1 : 0)) ** 2 +
    (probabilities.awayWin - (actualKey === 'awayWin' ? 1 : 0)) ** 2
  )
}

function calculateBinaryBrier(probability, actual) {
  return (probability - actual) ** 2
}

function bucketizeProbability(probability) {
  if (probability < 0.2) {
    return '0.00-0.19'
  }

  if (probability < 0.4) {
    return '0.20-0.39'
  }

  if (probability < 0.6) {
    return '0.40-0.59'
  }

  if (probability < 0.8) {
    return '0.60-0.79'
  }

  return '0.80-1.00'
}

function calculateLogLoss(probability) {
  const boundedProbability = Math.min(Math.max(probability, 1e-15), 1 - 1e-15)
  return -Math.log(boundedProbability)
}

export function evaluatePredictionAgainstFixture({ prediction, fixture }) {
  const actual1X2 = getActual1X2Outcome(fixture)
  const actualOver25 = getActualBinaryOutcome(
    fixture.homeGoals + fixture.awayGoals > 2.5
  )
  const actualBtts = getActualBinaryOutcome(
    fixture.homeGoals > 0 && fixture.awayGoals > 0
  )
  const predicted1X2 = getPredicted1X2Outcome(prediction.probabilities)

  return {
    fixtureId: fixture.id,
    actual1X2,
    predicted1X2,
    accuracy1X2: predicted1X2 === actual1X2 ? 1 : 0,
    logLoss1X2: calculateLogLoss(prediction.probabilities[actual1X2]),
    brier1X2: calculateMulticlassBrier(prediction.probabilities, actual1X2),
    actualOver25,
    accuracyOver25:
      Number(prediction.probabilities.over25 >= 0.5) === actualOver25 ? 1 : 0,
    brierOver25: calculateBinaryBrier(
      prediction.probabilities.over25,
      actualOver25
    ),
    actualBtts,
    accuracyBtts:
      Number(prediction.probabilities.bttsYes >= 0.5) === actualBtts ? 1 : 0,
    brierBtts: calculateBinaryBrier(
      prediction.probabilities.bttsYes,
      actualBtts
    )
  }
}

export function summarizeEvaluationResults({ evaluations, excludedFixtures }) {
  const totals = evaluations.reduce(
    (accumulator, evaluation) => {
      accumulator.accuracy1X2 += evaluation.accuracy1X2
      accumulator.logLoss1X2 += evaluation.logLoss1X2
      accumulator.brier1X2 += evaluation.brier1X2
      accumulator.accuracyOver25 += evaluation.accuracyOver25
      accumulator.brierOver25 += evaluation.brierOver25
      accumulator.accuracyBtts += evaluation.accuracyBtts
      accumulator.brierBtts += evaluation.brierBtts
      accumulator.homeWinProbabilitySum += evaluation.prediction.homeWin
      accumulator.drawProbabilitySum += evaluation.prediction.draw
      accumulator.awayWinProbabilitySum += evaluation.prediction.awayWin
      const topProbability = Math.max(
        evaluation.prediction.homeWin,
        evaluation.prediction.draw,
        evaluation.prediction.awayWin
      )
      const topBucket = bucketizeProbability(topProbability)
      const overBucket = bucketizeProbability(evaluation.prediction.over25)
      const bttsBucket = bucketizeProbability(evaluation.prediction.bttsYes)

      accumulator.probabilityBuckets.oneXTwo[topBucket] =
        (accumulator.probabilityBuckets.oneXTwo[topBucket] || 0) + 1
      accumulator.probabilityBuckets.over25[overBucket] =
        (accumulator.probabilityBuckets.over25[overBucket] || 0) + 1
      accumulator.probabilityBuckets.bttsYes[bttsBucket] =
        (accumulator.probabilityBuckets.bttsYes[bttsBucket] || 0) + 1

      const dataQualityStatus = evaluation.dataQualityStatus || 'UNKNOWN'
      accumulator.dataQuality[dataQualityStatus] =
        (accumulator.dataQuality[dataQualityStatus] || 0) + 1
      return accumulator
    },
    {
      accuracy1X2: 0,
      logLoss1X2: 0,
      brier1X2: 0,
      accuracyOver25: 0,
      brierOver25: 0,
      accuracyBtts: 0,
      brierBtts: 0,
      homeWinProbabilitySum: 0,
      drawProbabilitySum: 0,
      awayWinProbabilitySum: 0,
      probabilityBuckets: {
        oneXTwo: {},
        over25: {},
        bttsYes: {}
      },
      dataQuality: {}
    }
  )

  const fixturesEvaluated = evaluations.length
  const totalFixtures = fixturesEvaluated + excludedFixtures.length

  return {
    fixturesEvaluated,
    fixturesExcluded: excludedFixtures.length,
    coverage: safeDivide(fixturesEvaluated, totalFixtures, 0),
    accuracy1X2: safeDivide(totals.accuracy1X2, fixturesEvaluated, 0),
    logLoss1X2: safeDivide(totals.logLoss1X2, fixturesEvaluated, 0),
    brier1X2: safeDivide(totals.brier1X2, fixturesEvaluated, 0),
    accuracyOver25: safeDivide(totals.accuracyOver25, fixturesEvaluated, 0),
    brierOver25: safeDivide(totals.brierOver25, fixturesEvaluated, 0),
    accuracyBtts: safeDivide(totals.accuracyBtts, fixturesEvaluated, 0),
    brierBtts: safeDivide(totals.brierBtts, fixturesEvaluated, 0),
    probabilityDistribution: {
      averageHomeWin: safeDivide(
        totals.homeWinProbabilitySum,
        fixturesEvaluated,
        0
      ),
      averageDraw: safeDivide(totals.drawProbabilitySum, fixturesEvaluated, 0),
      averageAwayWin: safeDivide(
        totals.awayWinProbabilitySum,
        fixturesEvaluated,
        0
      )
    },
    probabilityBuckets: totals.probabilityBuckets,
    dataQualityDistribution: totals.dataQuality,
    excludedReasons: excludedFixtures.reduce((accumulator, fixture) => {
      accumulator[fixture.reason] = (accumulator[fixture.reason] || 0) + 1
      return accumulator
    }, {})
  }
}
