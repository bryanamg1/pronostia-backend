import { toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

export function createSystemRunRepository({ poolManager }) {
  function mapSystemRunRow(row) {
    if (!row) {
      return null
    }

    return {
      runId: row.run_id,
      runType: row.run_type,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      finishedAt: row.finished_at
        ? new Date(row.finished_at).toISOString()
        : null,
      errorCode: row.error_code ?? null
    }
  }

  return {
    async savePreparedRun(run) {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      await pool.query(
        `
          INSERT INTO system_runs (
            run_id,
            run_type,
            status,
            started_at,
            finished_at,
            error_code,
            error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NOW(), NOW())
        `,
        [
          run.runId,
          run.runType,
          run.status,
          toMySqlDateTime(run.startedAt),
          toMySqlDateTime(run.finishedAt)
        ]
      )

      return run
    },

    async markRunFinished({
      runId,
      status,
      finishedAt,
      errorCode = null,
      errorMessage = null
    }) {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      await pool.query(
        `
          UPDATE system_runs
          SET
            status = ?,
            finished_at = ?,
            error_code = ?,
            error_message = ?,
            updated_at = NOW()
          WHERE run_id = ?
        `,
        [status, toMySqlDateTime(finishedAt), errorCode, errorMessage, runId]
      )

      return {
        runId,
        status,
        finishedAt,
        errorCode,
        errorMessage
      }
    },

    async getLatestRun() {
      if (!poolManager.hasConfig()) {
        return null
      }

      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM system_runs
          ORDER BY started_at DESC, created_at DESC, id DESC
          LIMIT 1
        `
      )

      return mapSystemRunRow(rows[0])
    }
  }
}
