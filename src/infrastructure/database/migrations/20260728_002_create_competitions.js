export const migration = {
  id: '20260728_002_create_competitions',
  up: `
    CREATE TABLE IF NOT EXISTS competitions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      target_key VARCHAR(64) NOT NULL,
      provider_id INT NOT NULL,
      name VARCHAR(128) NOT NULL,
      country VARCHAR(128) NOT NULL,
      season SMALLINT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      coverage_json JSON NULL,
      source_updated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_competitions_provider_season (provider_id, season),
      UNIQUE KEY uq_competitions_target_season (target_key, season),
      KEY idx_competitions_enabled_name (enabled, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
