import { EXPLANATION_BUDGET_STATES } from '../constants/explanationDefaults.js'

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

export function calculateExplanationBudget({
  monthlyBudgetUsd,
  spentUsd,
  alertPercent,
  degradedPercent,
  hardLimitPercent = 100
}) {
  const safeBudget = Math.max(Number(monthlyBudgetUsd) || 0, 0)
  const safeSpent = Math.max(Number(spentUsd) || 0, 0)
  const spentPercent = safeBudget === 0 ? 100 : (safeSpent / safeBudget) * 100
  const remainingUsd = Math.max(0, safeBudget - safeSpent)

  let state = EXPLANATION_BUDGET_STATES.AVAILABLE

  if (spentPercent >= hardLimitPercent || safeBudget === 0) {
    state = EXPLANATION_BUDGET_STATES.BLOCKED
  } else if (spentPercent >= degradedPercent) {
    state = EXPLANATION_BUDGET_STATES.DEGRADED
  } else if (spentPercent >= alertPercent) {
    state = EXPLANATION_BUDGET_STATES.ALERT
  }

  return {
    state,
    spentUsd: roundCurrency(safeSpent),
    remainingUsd: roundCurrency(remainingUsd),
    spentPercent: roundCurrency(spentPercent),
    monthlyBudgetUsd: roundCurrency(safeBudget)
  }
}

export function estimateOpenAiUsageCost({ usage, pricing }) {
  const inputTokens = Number(usage?.inputTokens ?? 0)
  const cachedInputTokens = Number(usage?.cachedInputTokens ?? 0)
  const outputTokens = Number(usage?.outputTokens ?? 0)
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedInputTokens)

  const total =
    (nonCachedInputTokens * pricing.inputUsdPer1MTokens) / 1_000_000 +
    (cachedInputTokens * pricing.cachedInputUsdPer1MTokens) / 1_000_000 +
    (outputTokens * pricing.outputUsdPer1MTokens) / 1_000_000

  return roundCurrency(total)
}
