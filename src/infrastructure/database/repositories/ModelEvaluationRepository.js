import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapModelEvaluationRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    modelVersionId: Number(row.model_version_id),
    competitionId: Number(row.competition_id),
    season: Number(row.season),
    fixturesEvaluated: Number(row.fixtures_evaluated),
    fixturesExcluded: Number(row.fixtures_excluded),
    metrics: parseJsonColumn(row.metrics_json),
    evaluatedAt: new Date(row.evaluated_at).toISOString()
  }
}

export function createModelEvaluationRepository({ poolManager }) {
  return {
    async upsertModelEvaluation(evaluation) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO model_evaluations (
            model_version_id,
            competition_id,
            season,
            fixtures_evaluated,
            fixtures_excluded,
            metrics_json,
            evaluated_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            fixtures_evaluated = VALUES(fixtures_evaluated),
            fixtures_excluded = VALUES(fixtures_excluded),
            metrics_json = VALUES(metrics_json),
            evaluated_at = VALUES(evaluated_at),
            updated_at = NOW()
        `,
        [
          evaluation.modelVersionId,
          evaluation.competitionId,
          evaluation.season,
          evaluation.fixturesEvaluated,
          evaluation.fixturesExcluded,
          JSON.stringify(evaluation.metrics),
          toMySqlDateTime(evaluation.evaluatedAt)
        ]
      )

      const [rows] = await pool.query(
        'SELECT * FROM model_evaluations WHERE id = ? LIMIT 1',
        [result.insertId]
      )

      return mapModelEvaluationRow(rows[0])
    }
  }
}
