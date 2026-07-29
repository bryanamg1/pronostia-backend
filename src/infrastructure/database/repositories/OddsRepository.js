import { toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapOddsRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    fixtureId: Number(row.fixture_id),
    bookmaker: row.bookmaker,
    market: row.market,
    selection: row.selection,
    decimalOdds: Number(row.decimal_odds),
    sourceType: row.source_type,
    capturedAt: new Date(row.captured_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }
}

export function createOddsRepository({ poolManager }) {
  return {
    async upsertOdds(odds) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO odds (
            fixture_id,
            bookmaker,
            market,
            selection,
            decimal_odds,
            source_type,
            captured_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            decimal_odds = VALUES(decimal_odds),
            captured_at = VALUES(captured_at),
            updated_at = NOW()
        `,
        [
          odds.fixtureId,
          odds.bookmaker,
          odds.market,
          odds.selection,
          odds.decimalOdds,
          odds.sourceType,
          toMySqlDateTime(odds.capturedAt)
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM odds WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapOddsRow(rows[0])
    },

    async findOdds({ fixtureId, bookmaker, market, selection, sourceType }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM odds
          WHERE fixture_id = ?
            AND bookmaker = ?
            AND market = ?
            AND selection = ?
            AND source_type = ?
          LIMIT 1
        `,
        [fixtureId, bookmaker, market, selection, sourceType]
      )

      return mapOddsRow(rows[0])
    },

    async listLatestOddsByFixtureId(fixtureId) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `
          SELECT *
          FROM odds
          WHERE fixture_id = ?
          ORDER BY captured_at DESC, id DESC
        `,
        [fixtureId]
      )

      return rows.map(mapOddsRow)
    }
  }
}
