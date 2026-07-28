export function createTeamRepository({ poolManager }) {
  return {
    async upsertTeam(team) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO teams (
            provider_id,
            name,
            logo_url,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            name = VALUES(name),
            logo_url = VALUES(logo_url),
            updated_at = NOW()
        `,
        [team.providerId, team.name, team.logoUrl]
      )

      const [rows] = await pool.query(
        'SELECT * FROM teams WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      const row = rows[0]

      return {
        id: Number(row.id),
        providerId: Number(row.provider_id),
        name: row.name,
        logoUrl: row.logo_url
      }
    }
  }
}
