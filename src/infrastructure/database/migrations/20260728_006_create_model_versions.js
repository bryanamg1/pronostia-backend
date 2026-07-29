export const migration = {
  id: '20260728_006_create_model_versions',
  up: `
    CREATE TABLE IF NOT EXISTS model_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(128) NOT NULL,
      model_type VARCHAR(64) NOT NULL,
      parameters_json JSON NOT NULL,
      status VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_model_versions_version_type (version, model_type),
      KEY idx_model_versions_status_type (status, model_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
}
