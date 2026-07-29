export const migration = {
  id: '20260729_012_create_manual_odds_audit',
  up: `
    CREATE TABLE IF NOT EXISTS manual_odds_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      odds_id BIGINT UNSIGNED NOT NULL,
      entered_by VARCHAR(128) NOT NULL,
      previous_value DECIMAL(10,4) NULL,
      new_value DECIMAL(10,4) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_manual_odds_audit_odds (odds_id, created_at),
      CONSTRAINT fk_manual_odds_audit_odds
        FOREIGN KEY (odds_id) REFERENCES odds(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
