import { createSyncSportsDataUseCase } from '../src/application/sports/syncSportsData.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('sports sync use case', () => {
  test('syncs competitions, deduplicates fixtures, persists history, and caps the active window', async () => {
    const { logger } = createTestLogger()
    const storedCompetitions = new Map()
    const storedTeams = new Map()
    const storedFixtures = []
    const syncStates = []

    const useCase = createSyncSportsDataUseCase({
      logger,
      sportsApiClient: {
        async getStatus() {
          return {
            data: {
              response: {
                subscription: {
                  plan: 'Free'
                },
                requests: {
                  current: 10,
                  limit_day: 100
                }
              }
            }
          }
        },
        async getLeague({ providerId }) {
          return {
            data: {
              response: [
                {
                  league: {
                    id: providerId,
                    name: `League ${providerId}`
                  },
                  country: {
                    name: 'World'
                  },
                  seasons: [
                    {
                      year: 2026,
                      coverage: {
                        fixtures: true
                      }
                    }
                  ]
                }
              ]
            }
          }
        },
        async getFixturesByDateRange() {
          return {
            data: {
              response: [
                {
                  league: {
                    id: 140
                  },
                  fixture: {
                    id: 1,
                    date: '2026-07-28T10:00:00.000Z',
                    update: '2026-07-28T09:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 10,
                      name: 'Team 10',
                      logo: 'logo-10'
                    },
                    away: {
                      id: 11,
                      name: 'Team 11',
                      logo: 'logo-11'
                    }
                  }
                },
                {
                  league: {
                    id: 140
                  },
                  fixture: {
                    id: 2,
                    date: '2026-07-28T12:00:00.000Z',
                    update: '2026-07-28T11:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 12,
                      name: 'Team 12',
                      logo: 'logo-12'
                    },
                    away: {
                      id: 13,
                      name: 'Team 13',
                      logo: 'logo-13'
                    }
                  }
                },
                {
                  league: {
                    id: 2
                  },
                  fixture: {
                    id: 2,
                    date: '2026-07-28T12:00:00.000Z',
                    update: '2026-07-28T11:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 14,
                      name: 'Team 14',
                      logo: 'logo-14'
                    },
                    away: {
                      id: 15,
                      name: 'Team 15',
                      logo: 'logo-15'
                    }
                  }
                },
                {
                  league: {
                    id: 2
                  },
                  fixture: {
                    id: 3,
                    date: '2026-07-28T14:00:00.000Z',
                    update: '2026-07-28T13:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 16,
                      name: 'Team 16',
                      logo: 'logo-16'
                    },
                    away: {
                      id: 17,
                      name: 'Team 17',
                      logo: 'logo-17'
                    }
                  }
                },
                {
                  league: {
                    id: 999
                  },
                  fixture: {
                    id: 4,
                    date: '2026-07-28T16:00:00.000Z',
                    update: '2026-07-28T15:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 18,
                      name: 'Team 18',
                      logo: 'logo-18'
                    },
                    away: {
                      id: 19,
                      name: 'Team 19',
                      logo: 'logo-19'
                    }
                  }
                },
                {
                  league: {
                    id: 140
                  },
                  fixture: {
                    id: 5,
                    date: '2026-07-30T10:00:00.000Z',
                    update: '2026-07-30T09:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 20,
                      name: 'Team 20',
                      logo: 'logo-20'
                    },
                    away: {
                      id: 21,
                      name: 'Team 21',
                      logo: 'logo-21'
                    }
                  }
                }
              ]
            }
          }
        },
        async getHistoricalFixturesPage({ leagueId }) {
          return {
            data: {
              response: [
                {
                  fixture: {
                    id: 1000 + leagueId,
                    date: '2026-07-15T10:00:00.000Z',
                    update: '2026-07-15T12:00:00.000Z',
                    status: {
                      short: 'FT'
                    }
                  },
                  goals: {
                    home: 1,
                    away: 0
                  },
                  teams: {
                    home: {
                      id: 30 + leagueId,
                      name: `History Home ${leagueId}`,
                      logo: null
                    },
                    away: {
                      id: 40 + leagueId,
                      name: `History Away ${leagueId}`,
                      logo: null
                    }
                  }
                }
              ],
              paging: {
                current: 1,
                total: 1
              },
              results: 1
            }
          }
        },
        getQuotaSnapshot() {
          return {
            plan: 'Free',
            current: 10,
            limitDay: 100,
            conservativeCurrent: 14,
            remaining: 86
          }
        }
      },
      competitionRepository: {
        async upsertCompetition(competition) {
          return {
            ...competition,
            id: competition.providerId
          }
        }
      },
      teamRepository: {
        async upsertTeam(team) {
          const stored = {
            ...team,
            id: storedTeams.size + 1
          }
          storedTeams.set(team.providerId, stored)
          return stored
        }
      },
      fixtureRepository: {
        async upsertFixture(fixture) {
          storedFixtures.push(fixture)
          return fixture
        }
      },
      sportsSyncStateRepository: {
        async findByKey() {
          return null
        },
        async upsertSyncState(state) {
          syncStates.push(state)
          return state
        }
      },
      databaseConfigured: true,
      timezone: 'America/Argentina/Buenos_Aires',
      defaultSeason: 2026,
      lookaheadHours: 24,
      maxFixtures: 2,
      historyMaxPagesPerRun: 1,
      now: () => new Date('2026-07-28T00:00:00.000Z'),
      authorizedCompetitions: [
        {
          key: 'laliga',
          providerId: 140,
          name: 'La Liga',
          country: 'Spain'
        },
        {
          key: 'uefa-champions-league',
          providerId: 2,
          name: 'UEFA Champions League',
          country: 'World'
        }
      ]
    })

    const result = await useCase({
      trigger: 'test'
    })

    expect(result.status).toBe('completed')
    expect(result.result).toBe('fixtures_processed')
    expect(result.fixturesFound).toBe(4)
    expect(result.fixturesSelected).toBe(2)
    expect(result.duplicatesDiscarded).toBe(1)
    expect(result.historyPagesProcessed).toBe(1)
    expect(result.teamsPersisted).toBeGreaterThanOrEqual(6)
    expect(result.openAiInvoked).toBe(false)
    expect(storedFixtures).toHaveLength(3)
    expect(syncStates).toHaveLength(1)
  })

  test('continues with no_fixtures when global feed only returns non-authorized leagues', async () => {
    const { logger } = createTestLogger()
    const useCase = createSyncSportsDataUseCase({
      logger,
      sportsApiClient: {
        async getStatus() {
          return {
            data: {
              response: {
                subscription: {
                  plan: 'Free'
                },
                requests: {
                  current: 10,
                  limit_day: 100
                }
              }
            }
          }
        },
        async getLeague({ providerId }) {
          return {
            data: {
              response: [
                {
                  league: {
                    id: providerId,
                    name: `League ${providerId}`
                  },
                  country: {
                    name: 'World'
                  },
                  seasons: [
                    {
                      year: 2026,
                      coverage: {
                        fixtures: true
                      }
                    }
                  ]
                }
              ]
            }
          }
        },
        async getFixturesByDateRange() {
          return {
            data: {
              response: [
                {
                  league: {
                    id: 999
                  },
                  fixture: {
                    id: 50,
                    date: '2026-07-28T10:00:00.000Z',
                    update: '2026-07-28T09:00:00.000Z',
                    status: {
                      short: 'NS'
                    }
                  },
                  goals: {
                    home: null,
                    away: null
                  },
                  teams: {
                    home: {
                      id: 100,
                      name: 'Team 100',
                      logo: 'logo-100'
                    },
                    away: {
                      id: 101,
                      name: 'Team 101',
                      logo: 'logo-101'
                    }
                  }
                }
              ]
            }
          }
        },
        getQuotaSnapshot() {
          return {
            plan: 'Free',
            current: 10,
            limitDay: 100,
            conservativeCurrent: 13,
            remaining: 85
          }
        }
      },
      competitionRepository: {
        async upsertCompetition(competition) {
          return {
            ...competition,
            id: competition.providerId
          }
        }
      },
      teamRepository: {
        async upsertTeam() {}
      },
      fixtureRepository: {
        async upsertFixture() {}
      },
      sportsSyncStateRepository: {
        async findByKey() {
          return {
            completed: true
          }
        }
      },
      databaseConfigured: true,
      timezone: 'America/Argentina/Buenos_Aires',
      defaultSeason: 2026,
      lookaheadHours: 24,
      maxFixtures: 2,
      historyMaxPagesPerRun: 1,
      now: () => new Date('2026-07-28T00:00:00.000Z'),
      authorizedCompetitions: [
        {
          key: 'laliga',
          providerId: 140,
          name: 'La Liga',
          country: 'Spain'
        },
        {
          key: 'uefa-champions-league',
          providerId: 2,
          name: 'UEFA Champions League',
          country: 'World'
        }
      ]
    })

    const result = await useCase({
      trigger: 'test'
    })

    expect(result.status).toBe('completed')
    expect(result.result).toBe('no_fixtures_available')
    expect(result.fixturesFound).toBe(0)
    expect(result.fixturesSelected).toBe(0)
    expect(result.teamsPersisted).toBe(0)
    expect(result.openAiInvoked).toBe(false)
  })

  test('skips the sync when the provider is not configured', async () => {
    const { logger } = createTestLogger()
    const useCase = createSyncSportsDataUseCase({
      logger,
      sportsApiClient: null,
      competitionRepository: {},
      teamRepository: {},
      fixtureRepository: {},
      sportsSyncStateRepository: {},
      databaseConfigured: true,
      timezone: 'America/Argentina/Buenos_Aires',
      defaultSeason: 2026,
      lookaheadHours: 24,
      maxFixtures: 40,
      historyMaxPagesPerRun: 1
    })

    await expect(useCase()).resolves.toMatchObject({
      status: 'skipped',
      reason: 'provider_not_configured'
    })
  })
})
