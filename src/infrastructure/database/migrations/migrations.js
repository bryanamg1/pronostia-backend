import { migration as createSystemRunsMigration } from './20260728_001_create_system_runs.js'
import { migration as createCompetitionsMigration } from './20260728_002_create_competitions.js'
import { migration as createTeamsMigration } from './20260728_003_create_teams.js'
import { migration as createFixturesMigration } from './20260728_004_create_fixtures.js'
import { migration as createSportsSyncStateMigration } from './20260728_005_create_sports_sync_state.js'
import { migration as createModelVersionsMigration } from './20260728_006_create_model_versions.js'
import { migration as createHistoricalPredictionsMigration } from './20260728_007_create_historical_predictions.js'
import { migration as createModelEvaluationsMigration } from './20260728_008_create_model_evaluations.js'

export const migrations = [
  createSystemRunsMigration,
  createCompetitionsMigration,
  createTeamsMigration,
  createFixturesMigration,
  createSportsSyncStateMigration,
  createModelVersionsMigration,
  createHistoricalPredictionsMigration,
  createModelEvaluationsMigration
]
