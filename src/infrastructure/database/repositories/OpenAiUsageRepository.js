import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapUsageRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    predictionId: row.prediction_id === null ? null : Number(row.prediction_id),
    status: row.status,
    source: row.source,
    model: row.model,
    requestId: row.request_id,
    inputTokens: Number(row.input_tokens),
    cachedInputTokens: Number(row.cached_input_tokens),
    outputTokens: Number(row.output_tokens),
    reasoningTokens: Number(row.reasoning_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
    metadata: parseJsonColumn(row.metadata_json),
    createdAt: new Date(row.created_at).toISOString()
  }
}

export function createOpenAiUsageRepository({ poolManager }) {
  return {
    async createUsageRecord(record) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO openai_usage_records (
            prediction_id,
            status,
            source,
            model,
            request_id,
            input_tokens,
            cached_input_tokens,
            output_tokens,
            reasoning_tokens,
            estimated_cost_usd,
            metadata_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.predictionId ?? null,
          record.status,
          record.source,
          record.model ?? null,
          record.requestId ?? null,
          record.inputTokens ?? 0,
          record.cachedInputTokens ?? 0,
          record.outputTokens ?? 0,
          record.reasoningTokens ?? 0,
          record.estimatedCostUsd ?? 0,
          record.metadata ? JSON.stringify(record.metadata) : null,
          toMySqlDateTime(record.createdAt ?? new Date())
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM openai_usage_records WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapUsageRow(rows[0])
    },

    async getUsageSummaryByPeriod({ from, to }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT
            COUNT(*) AS records_count,
            COALESCE(SUM(estimated_cost_usd), 0) AS total_cost_usd,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(cached_input_tokens), 0) AS cached_input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens
          FROM openai_usage_records
          WHERE created_at >= ? AND created_at < ?
        `,
        [toMySqlDateTime(from), toMySqlDateTime(to)]
      )

      const row = rows[0] ?? {}

      return {
        recordsCount: Number(row.records_count ?? 0),
        totalCostUsd: Number(row.total_cost_usd ?? 0),
        inputTokens: Number(row.input_tokens ?? 0),
        cachedInputTokens: Number(row.cached_input_tokens ?? 0),
        outputTokens: Number(row.output_tokens ?? 0),
        reasoningTokens: Number(row.reasoning_tokens ?? 0)
      }
    }
  }
}
