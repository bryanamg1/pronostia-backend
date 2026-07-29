export const migration = {
  id: '20260729_013_create_openai_usage_records',
  up: `
    CREATE TABLE IF NOT EXISTS openai_usage_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      prediction_id BIGINT UNSIGNED NULL,
      status VARCHAR(32) NOT NULL,
      source VARCHAR(32) NOT NULL,
      model VARCHAR(128) NULL,
      request_id VARCHAR(128) NULL,
      input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
      cached_input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
      output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
      reasoning_tokens INT UNSIGNED NOT NULL DEFAULT 0,
      estimated_cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
      metadata_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_openai_usage_created_at (created_at),
      KEY idx_openai_usage_status_created (status, created_at),
      KEY idx_openai_usage_prediction (prediction_id),
      CONSTRAINT fk_openai_usage_prediction
        FOREIGN KEY (prediction_id) REFERENCES predictions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
