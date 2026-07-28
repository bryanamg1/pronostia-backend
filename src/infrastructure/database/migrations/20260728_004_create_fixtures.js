export const migration = {
  id: '20260728_004_create_fixtures',
  up: `
    CREATE TABLE IF NOT EXISTS fixtures (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      provider_id INT NOT NULL,
      competition_id BIGINT UNSIGNED NOT NULL,
      home_team_id BIGINT UNSIGNED NOT NULL,
      away_team_id BIGINT UNSIGNED NOT NULL,
      kickoff_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL,
      home_goals SMALLINT NULL,
      away_goals SMALLINT NULL,
      raw_source_updated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_fixtures_provider_id (provider_id),
      KEY idx_fixtures_kickoff_at (kickoff_at),
      KEY idx_fixtures_competition_status_kickoff (competition_id, status, kickoff_at),
      CONSTRAINT fk_fixtures_competition
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
      CONSTRAINT fk_fixtures_home_team
        FOREIGN KEY (home_team_id) REFERENCES teams(id),
      CONSTRAINT fk_fixtures_away_team
        FOREIGN KEY (away_team_id) REFERENCES teams(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
