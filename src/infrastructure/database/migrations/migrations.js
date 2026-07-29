import { migration as createSystemRunsMigration } from './20260728_001_create_system_runs.js'
import { migration as createCompetitionsMigration } from './20260728_002_create_competitions.js'
import { migration as createTeamsMigration } from './20260728_003_create_teams.js'
import { migration as createFixturesMigration } from './20260728_004_create_fixtures.js'
import { migration as createSportsSyncStateMigration } from './20260728_005_create_sports_sync_state.js'
import { migration as createModelVersionsMigration } from './20260728_006_create_model_versions.js'
import { migration as createHistoricalPredictionsMigration } from './20260728_007_create_historical_predictions.js'
import { migration as createModelEvaluationsMigration } from './20260728_008_create_model_evaluations.js'
import { migration as createOddsMigration } from './20260729_009_create_odds.js'
import { migration as createAnalysisRunsMigration } from './20260729_010_create_analysis_runs.js'
import { migration as createPredictionsMigration } from './20260729_011_create_predictions.js'
import { migration as createManualOddsAuditMigration } from './20260729_012_create_manual_odds_audit.js'
import { migration as createOpenAiUsageRecordsMigration } from './20260729_013_create_openai_usage_records.js'

export const migrations = [
  createSystemRunsMigration,
  createCompetitionsMigration,
  createTeamsMigration,
  createFixturesMigration,
  createSportsSyncStateMigration,
  createModelVersionsMigration,
  createHistoricalPredictionsMigration,
  createModelEvaluationsMigration,
  createOddsMigration,
  createAnalysisRunsMigration,
  createPredictionsMigration,
  createManualOddsAuditMigration,
  createOpenAiUsageRecordsMigration
]
