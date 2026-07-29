export const migration = {
  id: '20260728_007_create_historical_predictions',
  up: `
    CREATE TABLE IF NOT EXISTS historical_predictions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      model_version_id BIGINT UNSIGNED NOT NULL,
      fixture_id BIGINT UNSIGNED NOT NULL,
      cutoff_at DATETIME NOT NULL,
      expected_home_goals DECIMAL(8,4) NOT NULL,
      expected_away_goals DECIMAL(8,4) NOT NULL,
      home_win_probability DECIMAL(10,8) NOT NULL,
      draw_probability DECIMAL(10,8) NOT NULL,
      away_win_probability DECIMAL(10,8) NOT NULL,
      over_25_probability DECIMAL(10,8) NOT NULL,
      under_25_probability DECIMAL(10,8) NOT NULL,
      btts_yes_probability DECIMAL(10,8) NOT NULL,
      btts_no_probability DECIMAL(10,8) NOT NULL,
      double_chance_1x_probability DECIMAL(10,8) NOT NULL,
      double_chance_x2_probability DECIMAL(10,8) NOT NULL,
      double_chance_12_probability DECIMAL(10,8) NOT NULL,
      data_quality_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_historical_predictions_version_fixture_cutoff (model_version_id, fixture_id, cutoff_at),
      KEY idx_historical_predictions_fixture (fixture_id),
      CONSTRAINT fk_historical_predictions_model_version
        FOREIGN KEY (model_version_id) REFERENCES model_versions(id),
      CONSTRAINT fk_historical_predictions_fixture
        FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
