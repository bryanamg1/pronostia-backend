export const migration = {
  id: '20260729_009_create_odds',
  up: `
    CREATE TABLE IF NOT EXISTS odds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      fixture_id BIGINT UNSIGNED NOT NULL,
      bookmaker VARCHAR(128) NOT NULL,
      market VARCHAR(64) NOT NULL,
      selection VARCHAR(64) NOT NULL,
      decimal_odds DECIMAL(10,4) NOT NULL,
      source_type ENUM('API', 'MANUAL') NOT NULL,
      captured_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_odds_fixture_bookmaker_market_selection_source (
        fixture_id,
        bookmaker,
        market,
        selection,
        source_type
      ),
      KEY idx_odds_fixture_market (fixture_id, market),
      KEY idx_odds_fixture_captured (fixture_id, captured_at),
      CONSTRAINT fk_odds_fixture
        FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
