import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapHistoricalPredictionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    modelVersionId: Number(row.model_version_id),
    fixtureId: Number(row.fixture_id),
    cutoffAt: new Date(row.cutoff_at).toISOString(),
    expectedHomeGoals: Number(row.expected_home_goals),
    expectedAwayGoals: Number(row.expected_away_goals),
    dataQuality: parseJsonColumn(row.data_quality_json)
  }
}

export function createHistoricalPredictionRepository({ poolManager }) {
  return {
    async upsertHistoricalPrediction(prediction) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO historical_predictions (
            model_version_id,
            fixture_id,
            cutoff_at,
            expected_home_goals,
            expected_away_goals,
            home_win_probability,
            draw_probability,
            away_win_probability,
            over_25_probability,
            under_25_probability,
            btts_yes_probability,
            btts_no_probability,
            double_chance_1x_probability,
            double_chance_x2_probability,
            double_chance_12_probability,
            data_quality_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            expected_home_goals = VALUES(expected_home_goals),
            expected_away_goals = VALUES(expected_away_goals),
            home_win_probability = VALUES(home_win_probability),
            draw_probability = VALUES(draw_probability),
            away_win_probability = VALUES(away_win_probability),
            over_25_probability = VALUES(over_25_probability),
            under_25_probability = VALUES(under_25_probability),
            btts_yes_probability = VALUES(btts_yes_probability),
            btts_no_probability = VALUES(btts_no_probability),
            double_chance_1x_probability = VALUES(double_chance_1x_probability),
            double_chance_x2_probability = VALUES(double_chance_x2_probability),
            double_chance_12_probability = VALUES(double_chance_12_probability),
            data_quality_json = VALUES(data_quality_json),
            updated_at = NOW()
        `,
        [
          prediction.modelVersionId,
          prediction.fixtureId,
          toMySqlDateTime(prediction.cutoffAt),
          prediction.expectedHomeGoals,
          prediction.expectedAwayGoals,
          prediction.probabilities.homeWin,
          prediction.probabilities.draw,
          prediction.probabilities.awayWin,
          prediction.probabilities.over25,
          prediction.probabilities.under25,
          prediction.probabilities.bttsYes,
          prediction.probabilities.bttsNo,
          prediction.probabilities.doubleChance1X,
          prediction.probabilities.doubleChanceX2,
          prediction.probabilities.doubleChance12,
          JSON.stringify(prediction.dataQuality)
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM historical_predictions WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapHistoricalPredictionRow(rows[0])
    }
  }
}
