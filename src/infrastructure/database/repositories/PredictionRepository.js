import { parseJsonColumn } from '../mysql/sqlValueHelpers.js'

function mapPredictionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    runId: row.run_id === null ? null : Number(row.run_id),
    fixtureId: Number(row.fixture_id),
    market: row.market,
    selection: row.selection,
    modelProbability: Number(row.model_probability),
    marketProbability: Number(row.market_probability),
    edgePp: Number(row.edge_pp),
    confidenceScore: Number(row.confidence_score),
    riskLevel: row.risk_level,
    recommendation: row.recommendation,
    modelVersion: row.model_version,
    explanation: parseJsonColumn(row.explanation_json),
    sources: parseJsonColumn(row.sources_json),
    isDailyTop: Boolean(row.is_daily_top),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    fixture: row.competition_id
      ? {
          id: Number(row.fixture_id),
          kickoffAt: new Date(row.kickoff_at).toISOString(),
          status: row.fixture_status,
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
            name: row.home_team_name
          },
          awayTeam: {
            id: Number(row.away_team_id),
            providerId: Number(row.away_provider_id),
            name: row.away_team_name
          }
        }
      : null
  }
}

const PREDICTION_SELECT = `
  SELECT
    p.*,
    f.kickoff_at,
    f.status AS fixture_status,
    c.id AS competition_id,
    c.target_key AS competition_target_key,
    c.provider_id AS competition_provider_id,
    c.name AS competition_name,
    c.country AS competition_country,
    c.season AS competition_season,
    home.id AS home_team_id,
    home.provider_id AS home_provider_id,
    home.name AS home_team_name,
    away.id AS away_team_id,
    away.provider_id AS away_provider_id,
    away.name AS away_team_name
  FROM predictions p
  INNER JOIN fixtures f ON f.id = p.fixture_id
  INNER JOIN competitions c ON c.id = f.competition_id
  INNER JOIN teams home ON home.id = f.home_team_id
  INNER JOIN teams away ON away.id = f.away_team_id
`

export function createPredictionRepository({ poolManager }) {
  return {
    async upsertPrediction(prediction) {
      const pool = poolManager.getPool()
      const [result] = await pool.query(
        `
          INSERT INTO predictions (
            run_id,
            fixture_id,
            market,
            selection,
            model_probability,
            market_probability,
            edge_pp,
            confidence_score,
            risk_level,
            recommendation,
            model_version,
            explanation_json,
            sources_json,
            is_daily_top,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            run_id = VALUES(run_id),
            model_probability = VALUES(model_probability),
            market_probability = VALUES(market_probability),
            edge_pp = VALUES(edge_pp),
            confidence_score = VALUES(confidence_score),
            risk_level = VALUES(risk_level),
            recommendation = VALUES(recommendation),
            explanation_json = VALUES(explanation_json),
            sources_json = VALUES(sources_json),
            is_daily_top = VALUES(is_daily_top),
            updated_at = NOW()
        `,
        [
          prediction.runId,
          prediction.fixtureId,
          prediction.market,
          prediction.selection,
          prediction.modelProbability,
          prediction.marketProbability,
          prediction.edgePp,
          prediction.confidenceScore,
          prediction.riskLevel,
          prediction.recommendation,
          prediction.modelVersion,
          prediction.explanation
            ? JSON.stringify(prediction.explanation)
            : null,
          JSON.stringify(prediction.sources),
          prediction.isDailyTop ? 1 : 0
        ]
      )

      const [rows] = await pool.query(
        `${PREDICTION_SELECT} WHERE p.id = ? LIMIT 1`,
        [result.insertId]
      )

      return mapPredictionRow(rows[0])
    },

    async findPredictionById(id) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `${PREDICTION_SELECT} WHERE p.id = ? LIMIT 1`,
        [id]
      )

      return mapPredictionRow(rows[0])
    },

    async updatePredictionExplanation({ id, explanation }) {
      const pool = poolManager.getPool()

      await pool.query(
        `
          UPDATE predictions
          SET explanation_json = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        [explanation ? JSON.stringify(explanation) : null, id]
      )

      const [rows] = await pool.query(
        `${PREDICTION_SELECT} WHERE p.id = ? LIMIT 1`,
        [id]
      )

      return mapPredictionRow(rows[0])
    },

    async listPredictionsByWindow({ from, to, limit = 250 }) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        `${PREDICTION_SELECT}
         WHERE f.kickoff_at >= ? AND f.kickoff_at <= ?
         ORDER BY f.kickoff_at ASC, p.confidence_score DESC, p.id ASC
         LIMIT ?`,
        [from, to, limit]
      )

      return rows.map(mapPredictionRow)
    }
  }
}
