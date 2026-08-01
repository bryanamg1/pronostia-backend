import { createAnalysisRunRepository } from '../src/infrastructure/database/repositories/AnalysisRunRepository.js'
import { createSystemRunRepository } from '../src/infrastructure/database/repositories/SystemRunRepository.js'

describe('run repositories', () => {
  test('system run repository serializes ISO timestamps to MySQL DATETIME values', async () => {
    const queries = []
    const repository = createSystemRunRepository({
      poolManager: {
        hasConfig: () => true,
        getPool: () => ({
          async query(sql, params) {
            queries.push({
              sql,
              params
            })
            return [[], []]
          }
        })
      }
    })

    await repository.savePreparedRun({
      runId: 'run-1',
      runType: 'CURRENT_PREDICTION_PILOT',
      status: 'PREPARED',
      startedAt: '2026-08-01T00:57:08.766Z',
      finishedAt: null
    })

    await repository.markRunFinished({
      runId: 'run-1',
      status: 'COMPLETED',
      finishedAt: '2026-08-01T01:02:03.999Z'
    })

    expect(queries[0].params[3]).toBe('2026-08-01 00:57:08')
    expect(queries[0].params[4]).toBeNull()
    expect(queries[1].params[1]).toBe('2026-08-01 01:02:03')
  })

  test('analysis run repository serializes timestamps to MySQL DATETIME values', async () => {
    const queries = []
    const rowsById = new Map([
      [
        7,
        {
          id: 7,
          scheduled_for: new Date('2026-08-01T02:00:00.000Z'),
          started_at: new Date('2026-08-01T01:00:00.000Z'),
          finished_at: new Date('2026-08-01T01:30:00.000Z'),
          status: 'COMPLETED',
          fixtures_found: 2,
          fixtures_processed: 2,
          api_calls: 5,
          openai_cost_usd: 0,
          error_summary: null,
          created_at: new Date('2026-08-01T01:00:00.000Z'),
          updated_at: new Date('2026-08-01T01:30:00.000Z')
        }
      ]
    ])
    const repository = createAnalysisRunRepository({
      poolManager: {
        hasConfig: () => true,
        getPool: () => ({
          async query(sql, params) {
            queries.push({
              sql,
              params
            })

            if (sql.includes('INSERT INTO analysis_runs')) {
              return [{ insertId: 7 }, []]
            }

            if (sql.includes('SELECT * FROM analysis_runs WHERE id = ?')) {
              return [[rowsById.get(params[0])], []]
            }

            return [[], []]
          }
        })
      }
    })

    await repository.createRun({
      scheduledFor: '2026-08-01T02:00:00.000Z',
      startedAt: '2026-08-01T01:00:00.000Z',
      finishedAt: null,
      status: 'RUNNING',
      fixturesFound: 0,
      fixturesProcessed: 0,
      apiCalls: 1,
      openaiCostUsd: 0
    })

    expect(queries[0].params[0]).toBe('2026-08-01 02:00:00')
    expect(queries[0].params[1]).toBe('2026-08-01 01:00:00')
    expect(queries[0].params[2]).toBeNull()
  })
})
