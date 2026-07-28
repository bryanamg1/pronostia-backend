import { parseJsonColumn } from '../mysql/sqlValueHelpers.js'

function mapModelVersionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    version: row.version,
    modelType: row.model_type,
    parameters: parseJsonColumn(row.parameters_json),
    status: row.status
  }
}

export function createModelVersionRepository({ poolManager }) {
  return {
    async upsertModelVersion(modelVersion) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO model_versions (
            version,
            model_type,
            parameters_json,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            parameters_json = VALUES(parameters_json),
            status = VALUES(status),
            updated_at = NOW()
        `,
        [
          modelVersion.version,
          modelVersion.modelType,
          JSON.stringify(modelVersion.parameters),
          modelVersion.status
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM model_versions WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapModelVersionRow(rows[0])
    }
  }
}
