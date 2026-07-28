export function createSystemRunRepository({ poolManager }) {
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
        [run.runId, run.runType, run.status, run.startedAt, run.finishedAt]
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
        [status, finishedAt, errorCode, errorMessage, runId]
      )

      return {
        runId,
        status,
        finishedAt,
        errorCode,
        errorMessage
      }
    }
  }
}
