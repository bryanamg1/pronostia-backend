export const migration = {
  id: '20260728_003_create_teams',
  up: `
    CREATE TABLE IF NOT EXISTS teams (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      provider_id INT NOT NULL,
      name VARCHAR(128) NOT NULL,
      logo_url VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_teams_provider_id (provider_id),
      KEY idx_teams_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
