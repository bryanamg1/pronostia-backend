export const migration = {
  id: '20260728_005_create_sports_sync_state',
  up: `
    CREATE TABLE IF NOT EXISTS sports_sync_state (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      sync_key VARCHAR(128) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      scope_type VARCHAR(64) NOT NULL,
      cursor_json JSON NULL,
      metadata_json JSON NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      last_status VARCHAR(32) NOT NULL,
      last_synced_at DATETIME NULL,
      last_success_at DATETIME NULL,
      last_error_code VARCHAR(64) NULL,
      last_error_message VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_sports_sync_state_sync_key (sync_key),
      KEY idx_sports_sync_state_provider_scope (provider, scope_type, completed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
