import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapAnalysisRunRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    scheduledFor: row.scheduled_for
      ? new Date(row.scheduled_for).toISOString()
      : null,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at
      ? new Date(row.finished_at).toISOString()
      : null,
    status: row.status,
    fixturesFound: Number(row.fixtures_found),
    fixturesProcessed: Number(row.fixtures_processed),
    apiCalls: Number(row.api_calls),
    openaiCostUsd: Number(row.openai_cost_usd),
    errorSummary: parseJsonColumn(row.error_summary),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }
}

export function createAnalysisRunRepository({ poolManager }) {
  return {
    async createRun(run) {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO analysis_runs (
            scheduled_for,
            started_at,
            finished_at,
            status,
            fixtures_found,
            fixtures_processed,
            api_calls,
            openai_cost_usd,
            error_summary,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          toMySqlDateTime(run.scheduledFor),
          toMySqlDateTime(run.startedAt),
          toMySqlDateTime(run.finishedAt),
          run.status,
          run.fixturesFound ?? 0,
          run.fixturesProcessed ?? 0,
          run.apiCalls ?? 0,
          run.openaiCostUsd ?? 0,
          run.errorSummary ? JSON.stringify(run.errorSummary) : null
        ]
      )

      return this.findById(result.insertId)
    },

    async updateRun(run) {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      await pool.query(
        `
          UPDATE analysis_runs
          SET
            finished_at = ?,
            status = ?,
            fixtures_found = ?,
            fixtures_processed = ?,
            api_calls = ?,
            openai_cost_usd = ?,
            error_summary = ?,
            updated_at = NOW()
          WHERE id = ?
        `,
        [
          toMySqlDateTime(run.finishedAt),
          run.status,
          run.fixturesFound ?? 0,
          run.fixturesProcessed ?? 0,
          run.apiCalls ?? 0,
          run.openaiCostUsd ?? 0,
          run.errorSummary ? JSON.stringify(run.errorSummary) : null,
          run.id
        ]
      )

      return this.findById(run.id)
    },

    async findById(id) {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        'SELECT * FROM analysis_runs WHERE id = ? LIMIT 1',
        [id]
      )

      return mapAnalysisRunRow(rows[0])
    },

    async getLatestRun() {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM analysis_runs
          ORDER BY started_at DESC, created_at DESC, id DESC
          LIMIT 1
        `
      )

      return mapAnalysisRunRow(rows[0])
    }
  }
}
