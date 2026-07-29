import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapCompetitionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    targetKey: row.target_key,
    providerId: Number(row.provider_id),
    name: row.name,
    country: row.country,
    season: Number(row.season),
    enabled: Boolean(row.enabled),
    coverage: parseJsonColumn(row.coverage_json),
    sourceUpdatedAt: row.source_updated_at
      ? new Date(row.source_updated_at).toISOString()
      : null
  }
}

export function createCompetitionRepository({ poolManager }) {
  return {
    async upsertCompetition(competition) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO competitions (
            target_key,
            provider_id,
            name,
            country,
            season,
            enabled,
            coverage_json,
            source_updated_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            name = VALUES(name),
            country = VALUES(country),
            enabled = VALUES(enabled),
            coverage_json = VALUES(coverage_json),
            source_updated_at = VALUES(source_updated_at),
            updated_at = NOW()
        `,
        [
          competition.targetKey,
          competition.providerId,
          competition.name,
          competition.country,
          competition.season,
          competition.enabled ? 1 : 0,
          competition.coverage ? JSON.stringify(competition.coverage) : null,
          toMySqlDateTime(competition.sourceUpdatedAt)
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM competitions WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapCompetitionRow(rows[0])
    },

    async listEnabledCompetitions() {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(`
        SELECT *
        FROM competitions
        WHERE enabled = 1
        ORDER BY country ASC, name ASC, season DESC
      `)

      return rows.map(mapCompetitionRow)
    },

    async findCompetitionByTargetKeyAndSeason({ targetKey, season }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM competitions
          WHERE target_key = ? AND season = ?
          LIMIT 1
        `,
        [targetKey, season]
      )

      return mapCompetitionRow(rows[0])
    },

    async findCompetitionByProviderIdAndSeason({ providerId, season }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM competitions
          WHERE provider_id = ? AND season = ?
          LIMIT 1
        `,
        [providerId, season]
      )

      return mapCompetitionRow(rows[0])
    }
  }
}
