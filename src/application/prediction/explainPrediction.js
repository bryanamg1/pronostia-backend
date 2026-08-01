import { NotFoundError } from '../../shared/errors/AppError.js'
import { toErrorLogPayload } from '../../shared/utils/sanitize.js'
import {
  EXPLANATION_BUDGET_STATES,
  EXPLANATION_SOURCES,
  EXPLANATION_STATUSES,
  OPENAI_USAGE_RECORD_STATUSES
} from '../../domain/prediction/constants/explanationDefaults.js'
import {
  buildUnavailableExplanation,
  buildPublicExplanationContent,
  buildFallbackExplanation,
  buildFinalExplanation,
  buildPredictionExplanationContract,
  hasMinimumExplanationData,
  validateGeneratedExplanation
} from '../../domain/prediction/services/predictionExplanation.js'
import {
  calculateExplanationBudget,
  estimateOpenAiUsageCost
} from '../../domain/prediction/services/explanationBudget.js'

const OPENAI_EXPLANATION_INSTRUCTIONS = `Eres el modulo explicativo de PronostIA.
Usa exclusivamente el JSON suministrado.
No modifiques probabilidades, cuotas, edge, confianza ni recomendacion.
No inventes lesiones, alineaciones, estadisticas o noticias.
Selecciona solo cadenas literales presentes en las listas candidatas.
No agregues contenido fuera del esquema.
No expongas razonamiento privado; entrega una salida estructurada y auditable.`

function getCurrentMonthBounds(referenceDate) {
  const from = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1)
  )
  const to = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1)
  )

  return {
    from,
    to
  }
}

export function createExplainPredictionUseCase({
  predictionRepository,
  generateHistoricalPrediction,
  openAiUsageRepository,
  openAiClient,
  openAiConfig,
  distributedLockManager,
  logger,
  now = () => new Date()
}) {
  const activeRequests = new Set()

  async function writeUsageRecordSafely(record, metadata) {
    try {
      await openAiUsageRepository.createUsageRecord(record)
    } catch (error) {
      logger?.warn?.('OpenAI usage record could not be persisted', {
        metadata: {
          ...metadata,
          error: toErrorLogPayload(error)
        }
      })
    }
  }

  async function readBudgetSnapshot(referenceDate) {
    const { from, to } = getCurrentMonthBounds(referenceDate)
    const usage = await openAiUsageRepository.getUsageSummaryByPeriod({
      from,
      to
    })
    const budget = calculateExplanationBudget({
      monthlyBudgetUsd: openAiConfig.budget.monthlyUsd,
      spentUsd: usage.totalCostUsd,
      alertPercent: openAiConfig.budget.alertPercent,
      degradedPercent: openAiConfig.budget.degradedPercent,
      hardLimitPercent: openAiConfig.budget.hardLimitPercent
    })

    return {
      usage,
      budget
    }
  }

  async function persistFallback({
    prediction,
    budget,
    content,
    reason,
    referenceDate,
    budgetState,
    logicalRequestKey,
    shouldWriteUsageRecord = true
  }) {
    const explanation = buildFallbackExplanation({
      generatedAt: referenceDate.toISOString(),
      model: null,
      budget,
      content,
      reason
    })

    const updatedPrediction =
      await predictionRepository.updatePredictionExplanation({
        id: prediction.id,
        explanation
      })

    if (shouldWriteUsageRecord) {
      await writeUsageRecordSafely(
        {
          predictionId: prediction.id,
          status:
            budgetState === EXPLANATION_BUDGET_STATES.BLOCKED
              ? OPENAI_USAGE_RECORD_STATUSES.BLOCKED
              : OPENAI_USAGE_RECORD_STATUSES.FALLBACK,
          source: EXPLANATION_SOURCES.DETERMINISTIC_FALLBACK,
          model: null,
          estimatedCostUsd: 0,
          metadata: {
            reason,
            provider: 'OPENAI',
            requestType: 'PREDICTION_EXPLANATION',
            currency: 'USD',
            logicalRequestKey
          },
          createdAt: referenceDate
        },
        {
          predictionId: prediction.id,
          logicalRequestKey,
          status: 'fallback'
        }
      )
    }

    return updatedPrediction
  }

  return async function explainPrediction({
    predictionId,
    strategy = 'auto',
    force = false,
    rank = 1,
    degradedOpenAiLimit = 5
  }) {
    const logicalRequestKey = `prediction:${predictionId}:explain:${force ? 'force' : 'default'}`
    const concurrencyKey = `prediction:${predictionId}:explain`

    if (activeRequests.has(concurrencyKey)) {
      return {
        status: 'already_processing',
        prediction: await predictionRepository.findPredictionById(predictionId)
      }
    }

    activeRequests.add(concurrencyKey)
    let distributedLockHandle = null

    try {
      if (distributedLockManager?.tryAcquire) {
        distributedLockHandle = await distributedLockManager.tryAcquire({
          key: concurrencyKey
        })

        if (!distributedLockHandle) {
          logger?.warn?.(
            'Prediction explanation skipped because another worker already holds the lock',
            {
              metadata: {
                predictionId,
                logicalRequestKey
              }
            }
          )

          return {
            status: 'already_processing',
            prediction:
              await predictionRepository.findPredictionById(predictionId)
          }
        }
      }

      const prediction =
        await predictionRepository.findPredictionById(predictionId)

      if (!prediction) {
        throw new NotFoundError('Prediction not found')
      }

      if (
        !force &&
        prediction.explanation?.status === EXPLANATION_STATUSES.READY
      ) {
        return {
          status: 'already_explained',
          prediction
        }
      }

      const modelResult = await generateHistoricalPrediction({
        fixtureId: prediction.fixtureId
      })

      if (modelResult.status !== 'ok') {
        throw new NotFoundError('Underlying deterministic prediction not found')
      }

      const referenceDate = now()
      const hasMinimumData = hasMinimumExplanationData({
        prediction,
        modelPrediction: modelResult.prediction
      })

      if (!hasMinimumData) {
        const explanation = buildUnavailableExplanation({
          generatedAt: referenceDate.toISOString(),
          content: buildPublicExplanationContent({
            prediction,
            modelPrediction: modelResult.prediction,
            explanation: null
          })
        })
        const updatedPrediction =
          await predictionRepository.updatePredictionExplanation({
            id: prediction.id,
            explanation
          })

        return {
          status: 'unavailable',
          prediction: updatedPrediction,
          budget: null
        }
      }

      const contract = buildPredictionExplanationContract({
        prediction,
        modelPrediction: modelResult.prediction
      })

      let budget

      try {
        ;({ budget } = await readBudgetSnapshot(referenceDate))
      } catch (error) {
        logger?.warn?.(
          'OpenAI usage ledger unavailable, switching to fallback',
          {
            metadata: {
              predictionId,
              error: toErrorLogPayload(error)
            }
          }
        )

        const explanation = buildFallbackExplanation({
          generatedAt: referenceDate.toISOString(),
          model: null,
          budget: null,
          content: contract.fallbackContent,
          reason: 'LEDGER_UNAVAILABLE'
        })
        const updatedPrediction =
          await predictionRepository.updatePredictionExplanation({
            id: prediction.id,
            explanation
          })

        return {
          status: 'fallback',
          prediction: updatedPrediction,
          budget: null
        }
      }

      const mustFallback =
        strategy === 'fallback' ||
        !openAiConfig.configured ||
        !openAiClient ||
        budget.state === EXPLANATION_BUDGET_STATES.BLOCKED ||
        (strategy === 'auto' &&
          budget.state === EXPLANATION_BUDGET_STATES.DEGRADED &&
          rank > degradedOpenAiLimit)

      if (mustFallback) {
        const reason =
          strategy === 'fallback'
            ? 'FORCED_FALLBACK'
            : !openAiConfig.configured || !openAiClient
              ? 'OPENAI_NOT_CONFIGURED'
              : budget.state === EXPLANATION_BUDGET_STATES.BLOCKED
                ? 'BUDGET_BLOCKED'
                : 'DEGRADED_TOP_FIVE_ONLY'
        const updatedPrediction = await persistFallback({
          prediction,
          budget,
          content: contract.fallbackContent,
          reason,
          referenceDate,
          budgetState: budget.state,
          logicalRequestKey
        })

        return {
          status: 'fallback',
          prediction: updatedPrediction,
          budget
        }
      }

      try {
        const openAiResult = await openAiClient.generateStructuredOutput({
          instructions: OPENAI_EXPLANATION_INSTRUCTIONS,
          payload: contract.llmInput,
          schema: contract.responseSchema
        })
        const estimatedCostUsd = estimateOpenAiUsageCost({
          usage: openAiResult.usage,
          pricing: openAiConfig.pricing
        })

        if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
          throw new Error('Invalid OpenAI pricing configuration')
        }

        const validatedOutput = validateGeneratedExplanation({
          contract,
          output: openAiResult.output
        })
        const finalBudget = calculateExplanationBudget({
          monthlyBudgetUsd: openAiConfig.budget.monthlyUsd,
          spentUsd: budget.spentUsd + estimatedCostUsd,
          alertPercent: openAiConfig.budget.alertPercent,
          degradedPercent: openAiConfig.budget.degradedPercent,
          hardLimitPercent: openAiConfig.budget.hardLimitPercent
        })
        const explanation = buildFinalExplanation({
          status: EXPLANATION_STATUSES.READY,
          source: EXPLANATION_SOURCES.OPENAI,
          generatedAt: referenceDate.toISOString(),
          model: openAiResult.model,
          budget: finalBudget,
          content: validatedOutput,
          metadata: {
            requestId: openAiResult.id,
            usage: openAiResult.usage,
            logicalRequestKey
          }
        })
        const updatedPrediction =
          await predictionRepository.updatePredictionExplanation({
            id: prediction.id,
            explanation
          })

        await writeUsageRecordSafely(
          {
            predictionId: prediction.id,
            status: OPENAI_USAGE_RECORD_STATUSES.SUCCESS,
            source: EXPLANATION_SOURCES.OPENAI,
            model: openAiResult.model,
            requestId: openAiResult.id,
            inputTokens: openAiResult.usage.inputTokens,
            cachedInputTokens: openAiResult.usage.cachedInputTokens,
            outputTokens: openAiResult.usage.outputTokens,
            reasoningTokens: openAiResult.usage.reasoningTokens,
            estimatedCostUsd,
            metadata: {
              budgetStateBefore: budget.state,
              budgetStateAfter: finalBudget.state,
              provider: 'OPENAI',
              requestType: 'PREDICTION_EXPLANATION',
              currency: 'USD',
              logicalRequestKey
            },
            createdAt: referenceDate
          },
          {
            predictionId: prediction.id,
            logicalRequestKey,
            status: 'success'
          }
        )

        return {
          status: 'ready',
          prediction: updatedPrediction,
          budget: finalBudget
        }
      } catch (error) {
        logger?.warn?.(
          'Prediction explanation degraded to deterministic fallback',
          {
            metadata: {
              predictionId,
              error: toErrorLogPayload(error)
            }
          }
        )

        await writeUsageRecordSafely(
          {
            predictionId: prediction.id,
            status: OPENAI_USAGE_RECORD_STATUSES.FAILED,
            source: EXPLANATION_SOURCES.OPENAI,
            model: openAiConfig.model,
            estimatedCostUsd: 0,
            metadata: {
              error: toErrorLogPayload(error),
              provider: 'OPENAI',
              requestType: 'PREDICTION_EXPLANATION',
              currency: 'USD',
              logicalRequestKey,
              errorCode: error?.code ?? error?.name ?? 'OPENAI_FAILED'
            },
            createdAt: referenceDate
          },
          {
            predictionId: prediction.id,
            logicalRequestKey,
            status: 'failed'
          }
        )

        const updatedPrediction = await persistFallback({
          prediction,
          budget,
          content: contract.fallbackContent,
          reason: 'OPENAI_FAILED',
          referenceDate,
          budgetState: budget.state,
          logicalRequestKey,
          shouldWriteUsageRecord: false
        })

        return {
          status: 'fallback',
          prediction: updatedPrediction,
          budget
        }
      }
    } finally {
      if (distributedLockHandle) {
        await distributedLockManager.release(distributedLockHandle)
      }

      activeRequests.delete(concurrencyKey)
    }
  }
}
