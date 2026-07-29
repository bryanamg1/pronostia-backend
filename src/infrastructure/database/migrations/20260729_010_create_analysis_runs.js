export const migration = {
  id: '20260729_010_create_analysis_runs',
  up: `
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      scheduled_for DATETIME NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      status VARCHAR(64) NOT NULL,
      fixtures_found INT UNSIGNED NOT NULL DEFAULT 0,
      fixtures_processed INT UNSIGNED NOT NULL DEFAULT 0,
      api_calls INT UNSIGNED NOT NULL DEFAULT 0,
      openai_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
      error_summary JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_analysis_runs_status_started (status, started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
