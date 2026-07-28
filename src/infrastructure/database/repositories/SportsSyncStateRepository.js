import { parseJsonColumn, toMySqlDateTime } from '../mysql/sqlValueHelpers.js'

function mapSyncStateRow(row) {
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    syncKey: row.sync_key,
    provider: row.provider,
    scopeType: row.scope_type,
    cursor: parseJsonColumn(row.cursor_json),
    metadata: parseJsonColumn(row.metadata_json),
    completed: Boolean(row.completed),
    lastStatus: row.last_status,
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : null,
    lastSuccessAt: row.last_success_at
      ? new Date(row.last_success_at).toISOString()
      : null,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message
  }
}

export function createSportsSyncStateRepository({ poolManager }) {
  return {
    async findByKey(syncKey) {
      const pool = poolManager.getPool()
      const [rows] = await pool.query(
        'SELECT * FROM sports_sync_state WHERE sync_key = ? LIMIT 1',
        [syncKey]
      )

      return mapSyncStateRow(rows[0])
    },

    async upsertSyncState(state) {
      const pool = poolManager.getPool()
      await pool.query(
        `
          INSERT INTO sports_sync_state (
            sync_key,
            provider,
            scope_type,
            cursor_json,
            metadata_json,
            completed,
            last_status,
            last_synced_at,
            last_success_at,
            last_error_code,
            last_error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            provider = VALUES(provider),
            scope_type = VALUES(scope_type),
            cursor_json = VALUES(cursor_json),
            metadata_json = VALUES(metadata_json),
            completed = VALUES(completed),
            last_status = VALUES(last_status),
            last_synced_at = VALUES(last_synced_at),
            last_success_at = VALUES(last_success_at),
            last_error_code = VALUES(last_error_code),
            last_error_message = VALUES(last_error_message),
            updated_at = NOW()
        `,
        [
          state.syncKey,
          state.provider,
          state.scopeType,
          state.cursor ? JSON.stringify(state.cursor) : null,
          state.metadata ? JSON.stringify(state.metadata) : null,
          state.completed ? 1 : 0,
          state.lastStatus,
          toMySqlDateTime(state.lastSyncedAt),
          toMySqlDateTime(state.lastSuccessAt),
          state.lastErrorCode,
          state.lastErrorMessage
        ]
      )

      return this.findByKey(state.syncKey)
    }
  }
}
