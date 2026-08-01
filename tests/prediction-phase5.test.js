import { jest } from '@jest/globals'

import { createExplainPredictionUseCase } from '../src/application/prediction/explainPrediction.js'
import { createExplainTodayPredictionsUseCase } from '../src/application/prediction/explainTodayPredictions.js'
import {
  EXPLANATION_BUDGET_STATES,
  EXPLANATION_STATUSES
} from '../src/domain/prediction/constants/explanationDefaults.js'
import {
  calculateExplanationBudget,
  estimateOpenAiUsageCost
} from '../src/domain/prediction/services/explanationBudget.js'
import {
  buildPredictionExplanationContract,
  createPendingExplanation,
  validateGeneratedExplanation
} from '../src/domain/prediction/services/predictionExplanation.js'
import { createTestLogger } from './helpers/createTestLogger.js'

function createExplainablePrediction(id = 1) {
  return {
    id,
    fixtureId: 44,
    market: 'MATCH_RESULT',
    selection: 'HOME',
    modelProbability: 0.61,
    marketProbability: 0.48,
    edgePp: 13,
    confidenceScore: 78,
    riskLevel: 'LOW',
    recommendation: 'CONSIDER',
    modelVersion: 'historical-first-v1',
    explanation: createPendingExplanation(),
    sources: {
      bookmaker: 'Bet365',
      sourceType: 'API',
      decimalOdds: 2.15,
      capturedAt: '2026-07-29T09:30:00.000Z',
      oddsAgeHours: 2,
      overround: 1.06,
      dataCoverage: 1,
      marketCompleteness: 1,
      normalizedProbabilities: {
        HOME: 0.48
      }
    },
    fixture: {
      id: 44,
      kickoffAt: '2026-07-29T21:00:00.000Z',
      status: 'NS',
      competition: {
        id: 3,
        name: 'UEFA Champions League',
        season: 2026
      },
      homeTeam: {
        id: 10,
        name: 'FK Crvena Zvezda'
      },
      awayTeam: {
        id: 11,
        name: 'Larne'
      }
    }
  }
}

function createLimitedPrediction(id = 2) {
  return {
    ...createExplainablePrediction(id),
    market: 'DOUBLE_CHANCE',
    selection: 'HOME_OR_DRAW',
    modelProbability: 0.90915218,
    marketProbability: 0.67073171,
    edgePp: 23.842,
    confidenceScore: 68,
    riskLevel: 'HIGH',
    recommendation: 'NO_RECOMMENDATION',
    explanation: null,
    sources: {
      bookmaker: 'Bet365',
      sourceType: 'API',
      decimalOdds: 1.4,
      capturedAt: '2026-07-31T23:04:16.000Z',
      oddsAgeHours: 2,
      overround: 1.08465608,
      dataCoverage: 0.75,
      marketCompleteness: 1,
      rawImpliedProbability: 1 / 1.4,
      fairMarketProbability: 0.67073171,
      normalizationMethod: 'DERIVED_FROM_MATCH_RESULT',
      derivedFromMarket: 'MATCH_RESULT',
      normalizedProbabilities: {
        HOME_OR_DRAW: 0.67073171
      }
    }
  }
}

function createLimitedModelResult() {
  return {
    status: 'ok',
    prediction: {
      modelVersion: 'historical-first-v1',
      fixtureId: 44,
      inputs: {
        historicalCutoff: '2026-08-01T21:30:00.000Z',
        sampleSizeHome: 2,
        sampleSizeAway: 2
      },
      expectedGoals: {
        home: 0.76377358,
        away: 0.2
      },
      dataQuality: {
        status: 'LIMITED',
        flags: ['LOW_SAMPLE_HOME', 'LOW_SAMPLE_AWAY']
      }
    }
  }
}

function createModelResult() {
  return {
    status: 'ok',
    prediction: {
      modelVersion: 'historical-first-v1',
      fixtureId: 44,
      inputs: {
        historicalCutoff: '2026-07-29T21:00:00.000Z',
        sampleSizeHome: 12,
        sampleSizeAway: 12
      },
      expectedGoals: {
        home: 1.84,
        away: 0.91
      },
      dataQuality: {
        status: 'SUFFICIENT',
        flags: []
      }
    }
  }
}

describe('phase 5 explanation services', () => {
  test('budget thresholds move through alert, degraded and blocked states', () => {
    expect(
      calculateExplanationBudget({
        monthlyBudgetUsd: 20,
        spentUsd: 10,
        alertPercent: 70,
        degradedPercent: 85
      }).state
    ).toBe(EXPLANATION_BUDGET_STATES.AVAILABLE)

    expect(
      calculateExplanationBudget({
        monthlyBudgetUsd: 20,
        spentUsd: 14,
        alertPercent: 70,
        degradedPercent: 85
      }).state
    ).toBe(EXPLANATION_BUDGET_STATES.ALERT)

    expect(
      calculateExplanationBudget({
        monthlyBudgetUsd: 20,
        spentUsd: 17,
        alertPercent: 70,
        degradedPercent: 85
      }).state
    ).toBe(EXPLANATION_BUDGET_STATES.DEGRADED)

    expect(
      calculateExplanationBudget({
        monthlyBudgetUsd: 20,
        spentUsd: 20,
        alertPercent: 70,
        degradedPercent: 85
      }).state
    ).toBe(EXPLANATION_BUDGET_STATES.BLOCKED)
  })

  test('cost estimation uses cached input pricing separately', () => {
    const total = estimateOpenAiUsageCost({
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 400,
        outputTokens: 200
      },
      pricing: {
        inputUsdPer1MTokens: 0.25,
        cachedInputUsdPer1MTokens: 0.025,
        outputUsdPer1MTokens: 2
      }
    })

    expect(total).toBeCloseTo(0.00056, 6)
  })

  test('explanation contract constrains OpenAI to provided candidate strings', () => {
    const contract = buildPredictionExplanationContract({
      prediction: createExplainablePrediction(),
      modelPrediction: createModelResult().prediction
    })

    expect(contract.responseSchema.schema.properties.summary.enum.length).toBe(
      3
    )
    expect(
      contract.responseSchema.schema.properties.supportingFactors.items.enum
    ).toContain(
      'La probabilidad propia para victoria de FK Crvena Zvezda es 61.0% y supera la implicita del mercado (48.0%).'
    )
    expect(
      contract.responseSchema.schema.properties.supportingFactors
    ).not.toHaveProperty('uniqueItems')
    expect(contract.fallbackContent.warnings[0]).toContain('Uso responsable')
  })

  test('backend validation still rejects duplicated factors without relying on JSON schema uniqueItems', () => {
    const contract = buildPredictionExplanationContract({
      prediction: createExplainablePrediction(),
      modelPrediction: createModelResult().prediction
    })

    expect(() =>
      validateGeneratedExplanation({
        contract,
        output: {
          summary: contract.llmInput.summaryCandidates[0],
          supportingFactors: [
            contract.llmInput.supportingCandidates[0],
            contract.llmInput.supportingCandidates[0]
          ],
          counterFactors: contract.llmInput.counterCandidates.slice(0, 1),
          warnings: contract.llmInput.warningCandidates.slice(0, 1),
          responsibleUseNotice: contract.llmInput.responsibleUseNotice
        }
      })
    ).toThrow('Invalid structured explanation output')

    expect(contract.fallbackContent.warnings[0]).toContain('Uso responsable')
  })

  test('generated explanations reject invented facts and prohibited language', () => {
    const contract = buildPredictionExplanationContract({
      prediction: createExplainablePrediction(),
      modelPrediction: createModelResult().prediction
    })

    expect(() =>
      validateGeneratedExplanation({
        contract,
        output: {
          summary: 'Hecho inventado',
          supportingFactors: contract.llmInput.supportingCandidates.slice(0, 1),
          counterFactors: contract.llmInput.counterCandidates.slice(0, 1),
          warnings: contract.llmInput.warningCandidates.slice(0, 1),
          responsibleUseNotice: contract.llmInput.responsibleUseNotice
        }
      })
    ).toThrow('Invalid structured explanation output')

    expect(() =>
      validateGeneratedExplanation({
        contract,
        output: {
          summary: contract.llmInput.summaryCandidates[0],
          supportingFactors: ['apuesta segura'],
          counterFactors: contract.llmInput.counterCandidates.slice(0, 1),
          warnings: contract.llmInput.warningCandidates.slice(0, 1),
          responsibleUseNotice: contract.llmInput.responsibleUseNotice
        }
      })
    ).toThrow('Invalid structured explanation output')
  })

  test('single explanation uses OpenAI when budget allows it', async () => {
    const prediction = createExplainablePrediction()
    const predictionRepository = {
      async findPredictionById() {
        return prediction
      },
      async updatePredictionExplanation({ explanation }) {
        prediction.explanation = explanation
        return prediction
      }
    }
    const usageRecords = []
    const { logger } = createTestLogger()
    const useCase = createExplainPredictionUseCase({
      predictionRepository,
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 0
          }
        },
        async createUsageRecord(payload) {
          usageRecords.push(payload)
          return payload
        }
      },
      openAiClient: {
        async generateStructuredOutput({ payload }) {
          return {
            id: 'resp_123',
            model: 'gpt-5-mini',
            output: {
              summary: payload.summaryCandidates[1],
              supportingFactors: payload.supportingCandidates.slice(0, 2),
              counterFactors: payload.counterCandidates.slice(0, 2),
              warnings: payload.warningCandidates.slice(0, 2),
              responsibleUseNotice: payload.responsibleUseNotice
            },
            usage: {
              inputTokens: 800,
              cachedInputTokens: 0,
              outputTokens: 120,
              reasoningTokens: 0
            }
          }
        }
      },
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const result = await useCase({
      predictionId: 1
    })

    expect(result.status).toBe('ready')
    expect(result.prediction.explanation.status).toBe(
      EXPLANATION_STATUSES.READY
    )
    expect(result.prediction.explanation.source).toBe('OPENAI')
    expect(usageRecords).toHaveLength(1)
    expect(usageRecords[0].estimatedCostUsd).toBeGreaterThan(0)
  })

  test('single explanation can be generated for a persisted prediction without recommendation', async () => {
    const prediction = createLimitedPrediction()
    const predictionRepository = {
      async findPredictionById() {
        return prediction
      },
      async updatePredictionExplanation({ explanation }) {
        prediction.explanation = explanation
        return prediction
      }
    }
    const usageRecords = []
    const useCase = createExplainPredictionUseCase({
      predictionRepository,
      generateHistoricalPrediction: async () => createLimitedModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 0
          }
        },
        async createUsageRecord(payload) {
          usageRecords.push(payload)
          return payload
        }
      },
      openAiClient: {
        async generateStructuredOutput({ payload }) {
          expect(
            payload.warningCandidates.some((value) => value.includes('68/100'))
          ).toBe(true)
          expect(
            payload.counterCandidates.some((value) =>
              value.includes('ausencia de recomendacion oficial')
            )
          ).toBe(true)

          return {
            id: 'resp_456',
            model: 'gpt-5-mini',
            output: {
              summary: payload.summaryCandidates[0],
              supportingFactors: payload.supportingCandidates.slice(0, 2),
              counterFactors: payload.counterCandidates.slice(0, 2),
              warnings: payload.warningCandidates.slice(0, 2),
              responsibleUseNotice: payload.responsibleUseNotice
            },
            usage: {
              inputTokens: 900,
              cachedInputTokens: 0,
              outputTokens: 140,
              reasoningTokens: 0
            }
          }
        }
      },
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-08-01T03:00:00.000Z')
    })

    const result = await useCase({
      predictionId: prediction.id
    })

    expect(result.status).toBe('ready')
    expect(result.prediction.explanation.status).toBe(
      EXPLANATION_STATUSES.READY
    )
    expect(usageRecords).toHaveLength(1)
    expect(result.prediction.confidenceScore).toBe(68)
    expect(result.prediction.recommendation).toBe('NO_RECOMMENDATION')
  })

  test('same prediction cannot be explained concurrently even when force differs', async () => {
    const prediction = createExplainablePrediction()
    let resolveOpenAiResponse
    const openAiClient = {
      generateStructuredOutput: jest.fn(
        ({ payload }) =>
          new Promise((resolve) => {
            resolveOpenAiResponse = () =>
              resolve({
                id: 'resp_locked',
                model: 'gpt-5-mini',
                output: {
                  summary: payload.summaryCandidates[0],
                  supportingFactors: payload.supportingCandidates.slice(0, 1),
                  counterFactors: payload.counterCandidates.slice(0, 1),
                  warnings: payload.warningCandidates.slice(0, 1),
                  responsibleUseNotice: payload.responsibleUseNotice
                },
                usage: {
                  inputTokens: 400,
                  cachedInputTokens: 0,
                  outputTokens: 100,
                  reasoningTokens: 0
                }
              })
          })
      )
    }
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById() {
          return prediction
        },
        async updatePredictionExplanation({ explanation }) {
          prediction.explanation = explanation
          return prediction
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 0
          }
        },
        async createUsageRecord(payload) {
          return payload
        }
      },
      openAiClient,
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const firstRun = useCase({
      predictionId: 1
    })

    await new Promise((resolve) => setImmediate(resolve))

    const secondRun = await useCase({
      predictionId: 1,
      force: true
    })

    expect(secondRun.status).toBe('already_processing')
    expect(openAiClient.generateStructuredOutput).toHaveBeenCalledTimes(1)

    resolveOpenAiResponse()

    await expect(firstRun).resolves.toEqual(
      expect.objectContaining({
        status: 'ready'
      })
    )
  })

  test('distributed lock skips OpenAI work when another worker already owns the prediction lock', async () => {
    const prediction = createExplainablePrediction()
    const openAiClient = {
      generateStructuredOutput: jest.fn(async () => {
        throw new Error('should not be called')
      })
    }
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById() {
          return prediction
        },
        async updatePredictionExplanation({ explanation }) {
          prediction.explanation = explanation
          return prediction
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 0
          }
        },
        async createUsageRecord(payload) {
          return payload
        }
      },
      openAiClient,
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      distributedLockManager: {
        async tryAcquire() {
          return null
        },
        async release() {
          return false
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const result = await useCase({
      predictionId: 1
    })

    expect(result.status).toBe('already_processing')
    expect(openAiClient.generateStructuredOutput).not.toHaveBeenCalled()
  })

  test('explanation falls back when budget is blocked', async () => {
    const prediction = createExplainablePrediction()
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById() {
          return prediction
        },
        async updatePredictionExplanation({ explanation }) {
          prediction.explanation = explanation
          return prediction
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 20
          }
        },
        async createUsageRecord(payload) {
          return payload
        }
      },
      openAiClient: {
        async generateStructuredOutput() {
          throw new Error('should not be called')
        }
      },
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const result = await useCase({
      predictionId: 1
    })

    expect(result.status).toBe('fallback')
    expect(result.prediction.explanation.status).toBe(
      EXPLANATION_STATUSES.FALLBACK
    )
    expect(result.prediction.explanation.metadata.reason).toBe('BUDGET_BLOCKED')
  })

  test('degraded monthly budget keeps OpenAI only for top five predictions', async () => {
    const predictions = Array.from({ length: 6 }, (_, index) => ({
      ...createExplainablePrediction(index + 1),
      id: index + 1,
      confidenceScore: 90 - index
    }))
    const predictionMap = new Map(
      predictions.map((prediction) => [prediction.id, prediction])
    )
    const usageRecords = []
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById(id) {
          return predictionMap.get(id)
        },
        async updatePredictionExplanation({ id, explanation }) {
          const next = {
            ...predictionMap.get(id),
            explanation
          }
          predictionMap.set(id, next)
          return next
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 17.5
          }
        },
        async createUsageRecord(payload) {
          usageRecords.push(payload)
          return payload
        }
      },
      openAiClient: {
        async generateStructuredOutput({ payload }) {
          return {
            id: 'resp_ok',
            model: 'gpt-5-mini',
            output: {
              summary: payload.summaryCandidates[0],
              supportingFactors: payload.supportingCandidates.slice(0, 1),
              counterFactors: payload.counterCandidates.slice(0, 1),
              warnings: payload.warningCandidates.slice(0, 1),
              responsibleUseNotice: payload.responsibleUseNotice
            },
            usage: {
              inputTokens: 400,
              cachedInputTokens: 0,
              outputTokens: 100,
              reasoningTokens: 0
            }
          }
        }
      },
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })
    const explainTodayPredictions = createExplainTodayPredictionsUseCase({
      listTodayPredictions: async () => predictions,
      explainPrediction: useCase,
      maxBatchSize: 6
    })

    const result = await explainTodayPredictions()

    expect(result.readyCount).toBe(5)
    expect(result.fallbackCount).toBe(1)
    expect(predictionMap.get(6).explanation.status).toBe(
      EXPLANATION_STATUSES.FALLBACK
    )
  })

  test('invalid structured output degrades to deterministic fallback', async () => {
    const prediction = createExplainablePrediction()
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById() {
          return prediction
        },
        async updatePredictionExplanation({ explanation }) {
          prediction.explanation = explanation
          return prediction
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          return {
            totalCostUsd: 0
          }
        },
        async createUsageRecord(payload) {
          return payload
        }
      },
      openAiClient: {
        async generateStructuredOutput() {
          return {
            id: 'resp_invalid',
            model: 'gpt-5-mini',
            output: {
              summary: 'inventado',
              supportingFactors: ['inventado'],
              counterFactors: ['inventado'],
              warnings: ['inventado'],
              responsibleUseNotice: 'inventado'
            },
            usage: {
              inputTokens: 500,
              cachedInputTokens: 0,
              outputTokens: 50,
              reasoningTokens: 0
            }
          }
        }
      },
      openAiConfig: {
        configured: true,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const result = await useCase({
      predictionId: 1
    })

    expect(result.status).toBe('fallback')
    expect(result.prediction.explanation.metadata.reason).toBe('OPENAI_FAILED')
  })

  test('missing usage ledger falls back without failing the prediction', async () => {
    const prediction = createExplainablePrediction()
    const useCase = createExplainPredictionUseCase({
      predictionRepository: {
        async findPredictionById() {
          return prediction
        },
        async updatePredictionExplanation({ explanation }) {
          prediction.explanation = explanation
          return prediction
        }
      },
      generateHistoricalPrediction: async () => createModelResult(),
      openAiUsageRepository: {
        async getUsageSummaryByPeriod() {
          throw new Error('ledger unavailable')
        },
        async createUsageRecord(payload) {
          return payload
        }
      },
      openAiClient: null,
      openAiConfig: {
        configured: false,
        model: 'gpt-5-mini',
        budget: {
          monthlyUsd: 20,
          alertPercent: 70,
          degradedPercent: 85,
          hardLimitPercent: 100
        },
        pricing: {
          inputUsdPer1MTokens: 0.25,
          cachedInputUsdPer1MTokens: 0.025,
          outputUsdPer1MTokens: 2
        }
      },
      logger: createTestLogger().logger,
      now: () => new Date('2026-07-29T15:00:00.000Z')
    })

    const result = await useCase({
      predictionId: 1
    })

    expect(result.status).toBe('fallback')
    expect(result.prediction.explanation.metadata.reason).toBe(
      'LEDGER_UNAVAILABLE'
    )
  })
})
