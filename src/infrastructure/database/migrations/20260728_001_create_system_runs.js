export const migration = {
  id: '20260728_001_create_system_runs',
  description: 'Create system_runs table',
  up: `
    CREATE TABLE IF NOT EXISTS system_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id CHAR(36) NOT NULL,
      run_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      error_code VARCHAR(64) NULL,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_system_runs_run_id (run_id),
      KEY idx_system_runs_status_started_at (status, started_at),
      KEY idx_system_runs_run_type_started_at (run_type, started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  down: `
    DROP TABLE IF EXISTS system_runs;
  `
}
