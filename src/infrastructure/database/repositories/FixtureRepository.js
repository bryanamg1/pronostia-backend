import { toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapFixtureRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    providerId: Number(row.provider_id),
    kickoffAt:
      row.kickoff_at instanceof Date
        ? row.kickoff_at.toISOString()
        : new Date(row.kickoff_at).toISOString(),
    status: row.status,
    homeGoals: row.home_goals === null ? null : Number(row.home_goals),
    awayGoals: row.away_goals === null ? null : Number(row.away_goals),
    rawSourceUpdatedAt: row.raw_source_updated_at
      ? new Date(row.raw_source_updated_at).toISOString()
      : null,
    competition: {
      id: Number(row.competition_id),
      targetKey: row.competition_target_key,
      providerId: Number(row.competition_provider_id),
      name: row.competition_name,
      country: row.competition_country,
      season: Number(row.competition_season)
    },
    homeTeam: {
      id: Number(row.home_team_id),
      providerId: Number(row.home_provider_id),
      name: row.home_team_name,
      logoUrl: row.home_team_logo_url
    },
    awayTeam: {
      id: Number(row.away_team_id),
      providerId: Number(row.away_provider_id),
      name: row.away_team_name,
      logoUrl: row.away_team_logo_url
    }
  }
}

const FIXTURE_SELECT = `
  SELECT
    f.*,
    c.target_key AS competition_target_key,
    c.provider_id AS competition_provider_id,
    c.name AS competition_name,
    c.country AS competition_country,
    c.season AS competition_season,
    home.provider_id AS home_provider_id,
    home.name AS home_team_name,
    home.logo_url AS home_team_logo_url,
    away.provider_id AS away_provider_id,
    away.name AS away_team_name,
    away.logo_url AS away_team_logo_url
  FROM fixtures f
  INNER JOIN competitions c ON c.id = f.competition_id
  INNER JOIN teams home ON home.id = f.home_team_id
  INNER JOIN teams away ON away.id = f.away_team_id
`

export function createFixtureRepository({ poolManager }) {
  return {
    async upsertFixture(fixture) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO fixtures (
            provider_id,
            competition_id,
            home_team_id,
            away_team_id,
            kickoff_at,
            status,
            home_goals,
            away_goals,
            raw_source_updated_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            competition_id = VALUES(competition_id),
            home_team_id = VALUES(home_team_id),
            away_team_id = VALUES(away_team_id),
            kickoff_at = VALUES(kickoff_at),
            status = VALUES(status),
            home_goals = VALUES(home_goals),
            away_goals = VALUES(away_goals),
            raw_source_updated_at = VALUES(raw_source_updated_at),
            updated_at = NOW()
        `,
        [
          fixture.providerId,
          fixture.competitionId,
          fixture.homeTeamId,
          fixture.awayTeamId,
          toMySqlDateTime(fixture.kickoffAt),
          fixture.status,
          fixture.homeGoals,
          fixture.awayGoals,
          toMySqlDateTime(fixture.rawSourceUpdatedAt)
        ]
      )

      const [rows] = await pool.query(
        `${FIXTURE_SELECT} WHERE f.id = ? LIMIT 1`,
        [result.insertId]
      )

      return mapFixtureRow(rows[0])
    },

    async listFixturesByWindow({ from, to, limit }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `${FIXTURE_SELECT}
         WHERE f.kickoff_at >= ? AND f.kickoff_at <= ?
         ORDER BY f.kickoff_at ASC, f.id ASC
         LIMIT ?`,
        [toMySqlDateTime(from), toMySqlDateTime(to), limit]
      )

      return rows.map(mapFixtureRow)
    },

    async findFixtureById(id) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `${FIXTURE_SELECT} WHERE f.id = ? LIMIT 1`,
        [id]
      )

      return mapFixtureRow(rows[0])
    }
  }
}
