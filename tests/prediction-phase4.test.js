import { createGenerateScoredPredictionsUseCase } from '../src/application/prediction/generateScoredPredictions.js'
import { createRecordManualOddsUseCase } from '../src/application/prediction/recordManualOdds.js'

describe('phase 4 prediction use cases', () => {
  test('recordManualOdds persists and audits manual odds', async () => {
    const fixture = { id: 15 }
    const oddsWrites = []
    const auditWrites = []
    const useCase = createRecordManualOddsUseCase({
      fixtureRepository: {
        async findFixtureById(id) {
          return id === 15 ? fixture : null
        }
      },
      oddsRepository: {
        async findOdds() {
          return {
            id: 1,
            decimalOdds: 1.9
          }
        },
        async upsertOdds(payload) {
          oddsWrites.push(payload)
          return {
            id: 1,
            ...payload
          }
        }
      },
      manualOddsAuditRepository: {
        async createEntry(payload) {
          auditWrites.push(payload)
          return {
            id: 99,
            ...payload
          }
        }
      },
      now: () => new Date('2026-07-29T10:00:00.000Z')
    })

    const result = await useCase({
      fixtureId: 15,
      bookmaker: 'Betano',
      market: 'MATCH_RESULT',
      selection: 'HOME',
      decimalOdds: 2.05,
      enteredBy: 'operator'
    })

    expect(result.status).toBe('ok')
    expect(oddsWrites[0].sourceType).toBe('MANUAL')
    expect(auditWrites[0].previousValue).toBe(1.9)
    expect(auditWrites[0].newValue).toBe(2.05)
  })

  test('generateScoredPredictions scores complete odds markets and flags one top candidate', async () => {
    const persisted = []
    const useCase = createGenerateScoredPredictionsUseCase({
      generateHistoricalPrediction: async () => ({
        status: 'ok',
        modelVersion: {
          id: 1,
          version: 'historical-first-v1'
        },
        prediction: {
          fixtureId: 15,
          probabilities: {
            homeWin: 0.6,
            draw: 0.22,
            awayWin: 0.18,
            over25: 0.59,
            under25: 0.41,
            bttsYes: 0.52,
            bttsNo: 0.48,
            doubleChance1X: 0.82,
            doubleChanceX2: 0.4,
            doubleChance12: 0.78
          },
          inputs: {
            sampleSizeHome: 12,
            sampleSizeAway: 12
          },
          dataQuality: {
            status: 'SUFFICIENT',
            flags: []
          },
          components: {
            signals: {
              poisson: 0.5,
              elo: 0.44,
              form: 0.4
            }
          }
        }
      }),
      oddsRepository: {
        async listLatestOddsByFixtureId() {
          return [
            {
              fixtureId: 15,
              bookmaker: 'Betano',
              market: 'MATCH_RESULT',
              selection: 'HOME',
              decimalOdds: 2.15,
              sourceType: 'MANUAL',
              capturedAt: '2026-07-29T09:30:00.000Z'
            },
            {
              fixtureId: 15,
              bookmaker: 'Betano',
              market: 'MATCH_RESULT',
              selection: 'DRAW',
              decimalOdds: 3.4,
              sourceType: 'MANUAL',
              capturedAt: '2026-07-29T09:30:00.000Z'
            },
            {
              fixtureId: 15,
              bookmaker: 'Betano',
              market: 'MATCH_RESULT',
              selection: 'AWAY',
              decimalOdds: 4.0,
              sourceType: 'MANUAL',
              capturedAt: '2026-07-29T09:30:00.000Z'
            }
          ]
        }
      },
      predictionRepository: {
        async upsertPrediction(payload) {
          const row = {
            id: persisted.length + 1,
            ...payload
          }
          persisted.push(row)
          return row
        }
      },
      lookaheadHours: 24,
      now: () => new Date('2026-07-29T10:00:00.000Z')
    })

    const result = await useCase({ fixtureId: 15 })

    expect(result.status).toBe('ok')
    expect(result.predictions).toHaveLength(3)
    expect(
      result.predictions.some(
        (prediction) =>
          prediction.recommendation === 'CONSIDER' &&
          prediction.explanation?.status === 'EXPLANATION_PENDING'
      )
    ).toBe(true)
    expect(
      result.predictions.filter((prediction) => prediction.isDailyTop)
    ).toHaveLength(1)
    expect(
      result.predictions.some(
        (prediction) => prediction.recommendation === 'CONSIDER'
      )
    ).toBe(true)
  })
})
