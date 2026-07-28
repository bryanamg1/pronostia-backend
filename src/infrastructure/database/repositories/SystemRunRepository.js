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
    }
  }
}
