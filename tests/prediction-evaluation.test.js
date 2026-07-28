import { createChronologicalPredictionEngine } from '../src/application/prediction/services/chronologicalPredictionEngine.js'
import { createEvaluateHistoricalModelUseCase } from '../src/application/prediction/useCases/evaluateHistoricalModel.js'
import { createGenerateHistoricalPredictionUseCase } from '../src/application/prediction/useCases/generateHistoricalPrediction.js'
import { createPredictionHistoricalFixtures } from './fixtures/predictionHistoricalFixtures.js'

describe('historical prediction engine and use cases', () => {
  function createLargeHistoricalFixtureSet(totalFixtures = 140) {
    const competition = {
      id: 39,
      targetKey: 'premier-league',
      providerId: 39,
      name: 'Premier League',
      country: 'England',
      season: 2024
    }
    const teams = Array.from({ length: 20 }, (_, index) => ({
      id: 1000 + index,
      providerId: 1000 + index,
      name: `Team ${index + 1}`,
      logoUrl: null
    }))

    return Array.from({ length: totalFixtures }, (_, index) => {
      const homeTeam = teams[index % teams.length]
      const awayTeam = teams[(index + 7) % teams.length]

      return {
        id: index + 1,
        providerId: 2000 + index,
        kickoffAt: new Date(
          Date.UTC(2024, 7, 1 + index, 12, 0, 0)
        ).toISOString(),
        status: 'FT',
        homeGoals: (index + 2) % 4,
        awayGoals: index % 3,
        rawSourceUpdatedAt: new Date(
          Date.UTC(2024, 7, 1 + index, 14, 0, 0)
        ).toISOString(),
        competition,
        homeTeam,
        awayTeam
      }
    })
  }

  test('sorts fixtures chronologically and prevents future leakage', () => {
    const fixtures = createPredictionHistoricalFixtures()
    const engine = createChronologicalPredictionEngine({
      config: {
        evaluation: {
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })
    const prediction = engine.predictFixture({
      fixtures: [fixtures[3], fixtures[0], fixtures[1], fixtures[2]],
      fixtureId: 4
    })

    expect(prediction.inputs.sampleSizeHome).toBe(1)
    expect(prediction.inputs.sampleSizeAway).toBe(1)
  })

  test('uses fixture id as deterministic tie-breaker for equal kickoff times', () => {
    const fixtures = createPredictionHistoricalFixtures()
    const sameKickoffFixtures = [
      {
        ...fixtures[0],
        id: 11,
        kickoffAt: '2024-09-01T12:00:00.000Z'
      },
      {
        ...fixtures[1],
        id: 12,
        kickoffAt: '2024-09-01T12:00:00.000Z'
      },
      {
        ...fixtures[2],
        id: 13,
        kickoffAt: '2024-09-08T12:00:00.000Z'
      }
    ]
    const engine = createChronologicalPredictionEngine({
      config: {
        evaluation: {
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })
    const prediction = engine.predictFixture({
      fixtures: sameKickoffFixtures,
      fixtureId: 12
    })

    expect(prediction.inputs.sampleSizeHome).toBe(0)
    expect(prediction.inputs.sampleSizeAway).toBe(0)
  })

  test('evaluates chronological backtesting and persists model artifacts', async () => {
    const fixtures = createPredictionHistoricalFixtures()
    const persistedPredictions = new Map()
    const evaluationUseCase = createEvaluateHistoricalModelUseCase({
      competitionRepository: {
        async findCompetitionByTargetKeyAndSeason() {
          return fixtures[0].competition
        }
      },
      fixtureRepository: {
        async listCompletedFixturesByCompetition() {
          return fixtures
        }
      },
      modelVersionRepository: {
        async upsertModelVersion(payload) {
          return {
            id: 1,
            ...payload
          }
        }
      },
      historicalPredictionRepository: {
        async upsertHistoricalPrediction(payload) {
          const key = `${payload.modelVersionId}:${payload.fixtureId}:${payload.cutoffAt}`
          persistedPredictions.set(key, payload)
          return {
            id: persistedPredictions.size,
            ...payload
          }
        }
      },
      modelEvaluationRepository: {
        async upsertModelEvaluation(payload) {
          return {
            id: 1,
            ...payload
          }
        }
      },
      modelConfig: {
        evaluation: {
          minFixturesForEvaluation: 4,
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    const result = await evaluationUseCase({
      competitionKey: 'premier-league',
      season: 2024
    })

    expect(result.status).toBe('ok')
    expect(result.metrics.fixturesEvaluated).toBeGreaterThan(0)
    expect(result.metrics.accuracy1X2).toBeGreaterThanOrEqual(0)
    expect(result.metrics.coverage).toBeGreaterThan(0)
    expect(persistedPredictions.size).toBe(result.metrics.fixturesEvaluated)
  })

  test('supports evaluations with more than 100 fixtures after warm-up', async () => {
    const fixtures = createLargeHistoricalFixtureSet(140)
    const evaluationUseCase = createEvaluateHistoricalModelUseCase({
      competitionRepository: {
        async findCompetitionByTargetKeyAndSeason() {
          return fixtures[0].competition
        }
      },
      fixtureRepository: {
        async listCompletedFixturesByCompetition() {
          return fixtures
        }
      },
      modelVersionRepository: {
        async upsertModelVersion(payload) {
          return {
            id: 1,
            ...payload
          }
        }
      },
      historicalPredictionRepository: {
        async upsertHistoricalPrediction(payload) {
          return payload
        }
      },
      modelEvaluationRepository: {
        async upsertModelEvaluation(payload) {
          return payload
        }
      },
      modelConfig: {
        evaluation: {
          minFixturesForEvaluation: 20,
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    const result = await evaluationUseCase({
      competitionKey: 'premier-league',
      season: 2024
    })

    expect(result.status).toBe('ok')
    expect(result.metrics.fixturesEvaluated).toBeGreaterThanOrEqual(100)
    expect(result.metrics.coverage).toBeGreaterThan(0.7)
  })

  test('returns an explicit block when persisted history is insufficient', async () => {
    const fixtures = createPredictionHistoricalFixtures()
    const evaluationUseCase = createEvaluateHistoricalModelUseCase({
      competitionRepository: {
        async findCompetitionByTargetKeyAndSeason() {
          return fixtures[0].competition
        }
      },
      fixtureRepository: {
        async listCompletedFixturesByCompetition() {
          return fixtures.slice(0, 2)
        }
      },
      modelVersionRepository: {},
      historicalPredictionRepository: {},
      modelEvaluationRepository: {},
      modelConfig: {
        evaluation: {
          minFixturesForEvaluation: 20,
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    await expect(
      evaluationUseCase({
        competitionKey: 'premier-league',
        season: 2024
      })
    ).resolves.toMatchObject({
      status: 'insufficient_persisted_history'
    })
  })

  test('generates a historical prediction and persists it idempotently at the use-case boundary', async () => {
    const fixtures = createPredictionHistoricalFixtures()
    const persisted = new Map()
    const useCase = createGenerateHistoricalPredictionUseCase({
      fixtureRepository: {
        async findFixtureById(id) {
          return fixtures.find((fixture) => fixture.id === id) || null
        },
        async listFixturesByCompetition() {
          return fixtures
        }
      },
      modelVersionRepository: {
        async upsertModelVersion(payload) {
          return {
            id: 1,
            ...payload
          }
        }
      },
      historicalPredictionRepository: {
        async upsertHistoricalPrediction(payload) {
          const key = `${payload.modelVersionId}:${payload.fixtureId}:${payload.cutoffAt}`
          if (!persisted.has(key)) {
            persisted.set(key, {
              id: persisted.size + 1,
              ...payload
            })
          }

          return persisted.get(key)
        }
      },
      modelConfig: {
        evaluation: {
          minSamplesPerTeam: 1
        }
      },
      now: () => new Date('2026-07-28T00:00:00.000Z')
    })

    const firstRun = await useCase({
      fixtureId: 5
    })
    const secondRun = await useCase({
      fixtureId: 5
    })

    expect(firstRun.status).toBe('ok')
    expect(secondRun.persistedPrediction.id).toBe(
      firstRun.persistedPrediction.id
    )
    expect(persisted.size).toBe(1)
  })
})
