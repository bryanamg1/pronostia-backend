import { toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapManualOddsAuditRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    oddsId: Number(row.odds_id),
    enteredBy: row.entered_by,
    previousValue:
      row.previous_value === null ? null : Number(row.previous_value),
    newValue: Number(row.new_value),
    createdAt: new Date(row.created_at).toISOString()
  }
}

export function createManualOddsAuditRepository({ poolManager }) {
  return {
    async createEntry(entry) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO manual_odds_audit (
            odds_id,
            entered_by,
            previous_value,
            new_value,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          entry.oddsId,
          entry.enteredBy,
          entry.previousValue,
          entry.newValue,
          toMySqlDateTime(entry.createdAt)
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM manual_odds_audit WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapManualOddsAuditRow(rows[0])
    }
  }
}
