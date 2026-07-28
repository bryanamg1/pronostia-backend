import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createImportHistoricalSeasonUseCase } from '../src/application/sports/importHistoricalSeason.js'
import { createTestLogger } from './helpers/createTestLogger.js'
import { apiFootballHistoricalFixture1208021 } from './fixtures/apiFootballHistoricalFixture1208021.js'

function buildPayloadEnvelope(fixtures) {
  return {
    response: {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-requests-remaining': '72'
      },
      body: {
        errors: [],
        results: fixtures.length,
        paging: {
          current: 1,
          total: 1
        },
        response: fixtures
      }
    }
  }
}

describe('historical season import', () => {
  test('imports cached historical payload and reports idempotent fixture stats', async () => {
    const { logger } = createTestLogger()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pronostia-history-'))
    const payloadPath = path.join(tempDir, 'premier-league-2024.json')
    const fixturePayload = {
      ...apiFootballHistoricalFixture1208021.fixture,
      fixture: {
        ...apiFootballHistoricalFixture1208021.fixture.fixture,
        date: '2024-08-16T19:00:00+00:00'
      }
    }
    const storedTeams = new Map()
    const storedFixtures = new Map()
    let competitionRecord = null
    let syncStateWrites = 0

    const useCase = createImportHistoricalSeasonUseCase({
      logger,
      env: {
        sports: {
          configured: false,
          apiKey: '',
          baseUrl: 'https://example.test'
        }
      },
      competitionRepository: {
        async findCompetitionByProviderIdAndSeason() {
          return competitionRecord
        },
        async upsertCompetition(competition) {
          competitionRecord = {
            id: 1,
            ...competition
          }
          return competitionRecord
        }
      },
      teamRepository: {
        async findByProviderId(providerId) {
          return storedTeams.get(providerId) || null
        },
        async upsertTeam(team) {
          const existing = storedTeams.get(team.providerId)
          const stored = existing || {
            id: storedTeams.size + 1,
            ...team
          }
          storedTeams.set(team.providerId, stored)
          return stored
        }
      },
      fixtureRepository: {
        async listCompletedFixturesByCompetition() {
          return [...storedFixtures.values()]
        },
        async findFixtureByProviderId(providerId) {
          return storedFixtures.get(providerId) || null
        },
        async upsertFixture(fixture) {
          const existing = storedFixtures.get(fixture.providerId)
          const stored = existing || {
            id: storedFixtures.size + 1,
            providerId: fixture.providerId,
            competition: {
              id: fixture.competitionId
            },
            homeTeam: {
              id: fixture.homeTeamId
            },
            awayTeam: {
              id: fixture.awayTeamId
            },
            kickoffAt: fixture.kickoffAt,
            status: fixture.status,
            homeGoals: fixture.homeGoals,
            awayGoals: fixture.awayGoals,
            rawSourceUpdatedAt: fixture.rawSourceUpdatedAt
          }
          storedFixtures.set(fixture.providerId, stored)
          return stored
        }
      },
      sportsSyncStateRepository: {
        async upsertSyncState() {
          syncStateWrites += 1
          return {}
        }
      }
    })

    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(
        payloadPath,
        `${JSON.stringify(buildPayloadEnvelope([fixturePayload]), null, 2)}\n`,
        'utf8'
      )
    )

    const firstRun = await useCase({
      payloadPath
    })
    const secondRun = await useCase({
      payloadPath
    })

    expect(firstRun.source).toBe('local-cache')
    expect(firstRun.fixturesNew).toBe(1)
    expect(firstRun.finalFixtureCount).toBe(1)
    expect(secondRun.fixturesUnchanged).toBe(1)
    expect(secondRun.duplicateProviderIds).toBe(0)
    expect(syncStateWrites).toBe(2)
  })

  test('writes a sanitized payload envelope when it must query the provider', async () => {
    const { logger } = createTestLogger()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pronostia-history-'))
    const payloadPath = path.join(tempDir, 'premier-league-2024.json')
    const fixturePayload = apiFootballHistoricalFixture1208021.fixture
    const useCase = createImportHistoricalSeasonUseCase({
      logger,
      env: {
        sports: {
          configured: true,
          apiKey: 'secret-token',
          baseUrl: 'https://example.test'
        }
      },
      competitionRepository: {
        async findCompetitionByProviderIdAndSeason() {
          return null
        },
        async upsertCompetition(competition) {
          return {
            id: 1,
            ...competition
          }
        }
      },
      teamRepository: {
        async findByProviderId() {
          return null
        },
        async upsertTeam(team) {
          return {
            id: team.providerId,
            ...team
          }
        }
      },
      fixtureRepository: {
        async listCompletedFixturesByCompetition() {
          return []
        },
        async findFixtureByProviderId() {
          return null
        },
        async upsertFixture(fixture) {
          return {
            id: 1,
            providerId: fixture.providerId,
            competition: { id: fixture.competitionId },
            homeTeam: { id: fixture.homeTeamId },
            awayTeam: { id: fixture.awayTeamId },
            kickoffAt: fixture.kickoffAt,
            status: fixture.status,
            homeGoals: fixture.homeGoals,
            awayGoals: fixture.awayGoals,
            rawSourceUpdatedAt: fixture.rawSourceUpdatedAt
          }
        }
      },
      sportsSyncStateRepository: {
        async upsertSyncState() {
          return {}
        }
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            errors: [],
            results: 1,
            paging: {
              current: 1,
              total: 1
            },
            response: [fixturePayload]
          }),
          {
            status: 200,
            headers: {
              'x-apisports-key': 'secret-token',
              'content-type': 'application/json'
            }
          }
        )
    })

    await useCase({
      payloadPath
    })

    const savedEnvelope = await readFile(payloadPath, 'utf8')

    expect(savedEnvelope).not.toContain('secret-token')
    expect(savedEnvelope).toContain('[REDACTED]')
  })
})
