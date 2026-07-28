export const migration = {
  id: '20260728_008_create_model_evaluations',
  up: `
    CREATE TABLE IF NOT EXISTS model_evaluations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      model_version_id BIGINT UNSIGNED NOT NULL,
      competition_id BIGINT UNSIGNED NOT NULL,
      season SMALLINT NOT NULL,
      fixtures_evaluated INT NOT NULL,
      fixtures_excluded INT NOT NULL,
      metrics_json JSON NOT NULL,
      evaluated_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_model_evaluations_version_competition_season (model_version_id, competition_id, season),
      KEY idx_model_evaluations_competition_season (competition_id, season),
      CONSTRAINT fk_model_evaluations_model_version
        FOREIGN KEY (model_version_id) REFERENCES model_versions(id),
      CONSTRAINT fk_model_evaluations_competition
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
