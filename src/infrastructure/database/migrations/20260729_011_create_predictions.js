export const migration = {
  id: '20260729_011_create_predictions',
  up: `
    CREATE TABLE IF NOT EXISTS predictions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      run_id BIGINT UNSIGNED NULL,
      fixture_id BIGINT UNSIGNED NOT NULL,
      market VARCHAR(64) NOT NULL,
      selection VARCHAR(64) NOT NULL,
      model_probability DECIMAL(10,8) NOT NULL,
      market_probability DECIMAL(10,8) NOT NULL,
      edge_pp DECIMAL(10,4) NOT NULL,
      confidence_score INT UNSIGNED NOT NULL,
      risk_level ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
      recommendation ENUM('CONSIDER', 'NO_RECOMMENDATION') NOT NULL,
      model_version VARCHAR(128) NOT NULL,
      explanation_json JSON NULL,
      sources_json JSON NOT NULL,
      is_daily_top TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_predictions_fixture_market_selection_model (
        fixture_id,
        market,
        selection,
        model_version
      ),
      KEY idx_predictions_fixture (fixture_id),
      KEY idx_predictions_top (is_daily_top, fixture_id),
      KEY idx_predictions_recommendation (recommendation, confidence_score),
      CONSTRAINT fk_predictions_run
        FOREIGN KEY (run_id) REFERENCES analysis_runs(id),
      CONSTRAINT fk_predictions_fixture
        FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
