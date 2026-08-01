import { randomUUID } from 'node:crypto'

import { createSystemRun } from '../../domain/system/SystemRun.js'
import { AUTHORIZED_COMPETITIONS } from '../../domain/sports/authorizedCompetitions.js'
import { buildFixtureWindow } from '../../domain/sports/buildFixtureWindow.js'
import { normalizeProviderCompetition } from '../../domain/sports/normalizeProviderCompetition.js'
import { normalizeProviderFixture } from '../../domain/sports/normalizeProviderFixture.js'
import { extractApiFootballOddsRows } from '../prediction/services/apiFootballOdds.js'
import { ValidationError } from '../../shared/errors/AppError.js'
import { toErrorLogPayload } from '../../shared/utils/sanitize.js'

const PILOT_LOCK_KEY = 'sports:current-prediction-pilot'
const MIN_HISTORY_SAMPLES_PER_TEAM = 3
const MAX_SELECTED_FIXTURES = 3
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function listDatesInWindow({ startsAt, endsAt, timezone }) {
  const dates = []
  const cursor = new Date(startsAt)
  const targetDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(endsAt)

  while (true) {
    const currentDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(cursor)
    dates.push(currentDate)

    if (currentDate === targetDate) {
      break
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return [...new Set(dates)]
}

function buildPilotWindows(now, timezone) {
  return {
    '24h': buildFixtureWindow({
      now,
      lookaheadHours: 24,
      timezone
    }),
    '72h': buildFixtureWindow({
      now,
      lookaheadHours: 72,
      timezone
    }),
    '7d': buildFixtureWindow({
      now,
      lookaheadHours: 168,
      timezone
    })
  }
}

function initializeCompetitionWindowStats() {
  return AUTHORIZED_COMPETITIONS.map((competition) => ({
    competitionKey: competition.key,
    providerCompetitionId: competition.providerId,
    observedName: competition.name,
    season: null,
    fixtures24h: 0,
    fixtures72h: 0,
    fixtures7d: 0,
    nearestKickoffAt: null,
    status: 'NO_FIXTURES_IN_WINDOW',
    bodyErrors: null,
    requestsUsed: 0
  }))
}

function updateCompetitionWindowStats(stats, payload, windows, requestsUsed) {
  const fixtureDate = new Date(payload.fixture.date)

  if (
    fixtureDate > windows['24h'].startsAt &&
    fixtureDate <= windows['24h'].endsAt
  ) {
    stats.fixtures24h += 1
  }

  if (
    fixtureDate > windows['72h'].startsAt &&
    fixtureDate <= windows['72h'].endsAt
  ) {
    stats.fixtures72h += 1
  }

  if (
    fixtureDate > windows['7d'].startsAt &&
    fixtureDate <= windows['7d'].endsAt
  ) {
    stats.fixtures7d += 1
  }

  if (
    !stats.nearestKickoffAt ||
    fixtureDate < new Date(stats.nearestKickoffAt)
  ) {
    stats.nearestKickoffAt = payload.fixture.date
  }

  stats.observedName = payload.league?.name || stats.observedName
  stats.season = Number(payload.league?.season || stats.season || 0) || null
  stats.requestsUsed = requestsUsed
  stats.status =
    stats.fixtures24h > 0
      ? 'CURRENT_FIXTURES_AVAILABLE'
      : stats.fixtures72h > 0 || stats.fixtures7d > 0
        ? 'UPCOMING_FIXTURES_AVAILABLE'
        : 'NO_FIXTURES_IN_WINDOW'
}

export function assessPilotDatabaseSafety({ nodeEnv, host, name }) {
  const normalizedHost = String(host || '')
    .trim()
    .toLowerCase()
  const normalizedName = String(name || '')
    .trim()
    .toLowerCase()
  const looksLocal = LOCAL_DATABASE_HOSTS.has(normalizedHost)
  const looksSafeName =
    normalizedName === 'pronostia' ||
    normalizedName.includes('dev') ||
    normalizedName.includes('local') ||
    normalizedName.includes('pilot') ||
    normalizedName.includes('test')
  const looksUnsafeName =
    normalizedName.includes('prod') || normalizedName.includes('production')
  const safe =
    nodeEnv !== 'production' &&
    !looksUnsafeName &&
    (looksLocal || looksSafeName)

  return {
    safe,
    status: safe ? 'LOCAL_DEV_SAFE' : 'PILOT_DATABASE_NOT_SAFE',
    logicalName: normalizedName || null,
    hostClass: looksLocal ? 'local' : normalizedHost ? 'remote' : 'missing'
  }
}

function countPriorCompletedSamples(fixtures, targetFixture) {
  const targetKickoffAt = new Date(targetFixture.kickoffAt).getTime()
  let homeCount = 0
  let awayCount = 0

  for (const fixture of fixtures) {
    const fixtureKickoffAt = new Date(fixture.kickoffAt).getTime()

    if (
      fixtureKickoffAt >= targetKickoffAt ||
      !['FT', 'AET', 'PEN'].includes(fixture.status) ||
      fixture.homeGoals === null ||
      fixture.awayGoals === null
    ) {
      continue
    }

    if (
      fixture.homeTeam.id === targetFixture.homeTeam.id ||
      fixture.awayTeam.id === targetFixture.homeTeam.id
    ) {
      homeCount += 1
    }

    if (
      fixture.homeTeam.id === targetFixture.awayTeam.id ||
      fixture.awayTeam.id === targetFixture.awayTeam.id
    ) {
      awayCount += 1
    }
  }

  return {
    home: homeCount,
    away: awayCount
  }
}

function mapPilotStatus({
  fixturesSelected,
  predictionsPersisted,
  predictionsGenerated,
  databaseSafe,
  plan
}) {
  if (String(plan || '').toLowerCase() === 'free') {
    return 'API_FOOTBALL_PRO_NOT_ACTIVE'
  }

  if (!databaseSafe) {
    return 'PILOT_DATABASE_NOT_SAFE'
  }

  if (fixturesSelected === 0) {
    return 'NO_ELIGIBLE_REAL_FIXTURES'
  }

  if (predictionsPersisted > 0) {
    return 'REAL_PREDICTION_PILOT_READY_FOR_REVIEW'
  }

  if (predictionsGenerated > 0) {
    return 'REAL_PREDICTION_PILOT_PARTIALLY_COMPLETED'
  }

  return 'REAL_PREDICTION_PILOT_PARTIALLY_COMPLETED'
}

function mapPilotStatusToSystemRun(finalStatus) {
  if (finalStatus === 'NO_ELIGIBLE_REAL_FIXTURES') {
    return 'NO_FIXTURES'
  }

  if (
    finalStatus === 'PILOT_DATABASE_NOT_SAFE' ||
    finalStatus === 'API_FOOTBALL_PRO_NOT_ACTIVE' ||
    finalStatus === 'PROVIDER_QUOTA_UNSAFE'
  ) {
    return 'SKIPPED'
  }

  if (finalStatus === 'REAL_PREDICTION_PILOT_READY_FOR_REVIEW') {
    return 'COMPLETED'
  }

  return 'PARTIAL'
}

async function persistFixturePayload({
  payload,
  targetCompetition,
  competitionRepository,
  teamRepository,
  fixtureRepository
}) {
  const season = Number(
    payload?.league?.season || targetCompetition.referenceSeason
  )
  const storedCompetition = await competitionRepository.upsertCompetition(
    normalizeProviderCompetition({
      target: targetCompetition,
      providerPayload: {
        league: payload.league,
        country: {
          name: payload?.league?.country || targetCompetition.country
        },
        seasons: [
          {
            year: season,
            coverage: null
          }
        ]
      },
      season
    })
  )
  const normalizedFixture = normalizeProviderFixture({
    payload,
    competitionId: storedCompetition.id
  })
  const storedHomeTeam = await teamRepository.upsertTeam(
    normalizedFixture.homeTeam
  )
  const storedAwayTeam = await teamRepository.upsertTeam(
    normalizedFixture.awayTeam
  )
  const storedFixture = await fixtureRepository.upsertFixture({
    providerId: normalizedFixture.providerId,
    competitionId: storedCompetition.id,
    homeTeamId: storedHomeTeam.id,
    awayTeamId: storedAwayTeam.id,
    kickoffAt: normalizedFixture.kickoffAt,
    status: normalizedFixture.status,
    homeGoals: normalizedFixture.homeGoals,
    awayGoals: normalizedFixture.awayGoals,
    rawSourceUpdatedAt: normalizedFixture.rawSourceUpdatedAt
  })

  return {
    storedCompetition,
    storedFixture
  }
}

async function hydrateRequiredHistoryForFixture({
  sportsApiClient,
  sportsSyncStateRepository,
  teamRepository,
  fixtureRepository,
  storedCompetition,
  storedFixture,
  timezone,
  historyMaxPagesPerRun,
  now
}) {
  let pagesProcessed = 0
  let fixturesHydrated = 0
  let fixturesExcluded = 0
  const syncKey = `history:${storedCompetition.providerId}:${storedCompetition.season}`
  const lastWindows = [20, 40].slice(0, Math.max(1, historyMaxPagesPerRun))
  let latestFixtures = await fixtureRepository.listFixturesByCompetition({
    competitionId: storedCompetition.id
  })
  let sampleCounts = countPriorCompletedSamples(latestFixtures, storedFixture)

  for (const last of lastWindows) {
    if (
      sampleCounts.home >= MIN_HISTORY_SAMPLES_PER_TEAM &&
      sampleCounts.away >= MIN_HISTORY_SAMPLES_PER_TEAM
    ) {
      break
    }

    const historyResponse =
      await sportsApiClient.getHistoricalFixturesByLeagueSeason({
        leagueId: storedCompetition.providerId,
        season: storedCompetition.season,
        timezone,
        last
      })
    const payloads = Array.isArray(historyResponse.data?.response)
      ? historyResponse.data.response
      : []

    for (const payload of payloads) {
      const normalizedFixture = normalizeProviderFixture({
        payload,
        competitionId: storedCompetition.id
      })

      if (
        new Date(normalizedFixture.kickoffAt) >=
        new Date(storedFixture.kickoffAt)
      ) {
        fixturesExcluded += 1
        continue
      }

      const storedHomeTeam = await teamRepository.upsertTeam(
        normalizedFixture.homeTeam
      )
      const storedAwayTeam = await teamRepository.upsertTeam(
        normalizedFixture.awayTeam
      )

      await fixtureRepository.upsertFixture({
        providerId: normalizedFixture.providerId,
        competitionId: storedCompetition.id,
        homeTeamId: storedHomeTeam.id,
        awayTeamId: storedAwayTeam.id,
        kickoffAt: normalizedFixture.kickoffAt,
        status: normalizedFixture.status,
        homeGoals: normalizedFixture.homeGoals,
        awayGoals: normalizedFixture.awayGoals,
        rawSourceUpdatedAt: normalizedFixture.rawSourceUpdatedAt
      })
      fixturesHydrated += 1
    }

    pagesProcessed += 1

    await sportsSyncStateRepository.upsertSyncState({
      syncKey,
      provider: 'api-football',
      scopeType: 'competition-season-history',
      cursor: {
        strategy: 'league-season-last-fixtures',
        last,
        season: storedCompetition.season,
        providerId: storedCompetition.providerId
      },
      metadata: {
        results: Number(historyResponse.data?.results || payloads.length)
      },
      completed: true,
      lastStatus: 'success',
      lastSyncedAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    })

    latestFixtures = await fixtureRepository.listFixturesByCompetition({
      competitionId: storedCompetition.id
    })
    sampleCounts = countPriorCompletedSamples(latestFixtures, storedFixture)
  }

  return {
    pagesProcessed,
    fixturesHydrated,
    fixturesExcluded,
    sampleCounts
  }
}

async function persistFixtureOdds({
  sportsApiClient,
  oddsRepository,
  storedFixture,
  now
}) {
  const oddsResponse = await sportsApiClient.getOddsByFixture({
    fixtureId: storedFixture.providerId,
    page: 1
  })
  const oddsItems = Array.isArray(oddsResponse.data?.response)
    ? oddsResponse.data.response
    : []
  const selectedItem =
    oddsItems.find(
      (item) => Number(item?.fixture?.id || 0) === storedFixture.providerId
    ) ||
    oddsItems[0] ||
    null

  if (!selectedItem) {
    return {
      bookmakerCount: 0,
      selectedBookmaker: null,
      completedMarkets: 0,
      oddsPersisted: 0
    }
  }

  const extractedRows = extractApiFootballOddsRows({
    fixtureId: storedFixture.id,
    oddsResponseItem: selectedItem,
    fallbackCapturedAt: now.toISOString()
  })

  for (const row of extractedRows.rows) {
    await oddsRepository.upsertOdds(row)
  }

  return {
    bookmakerCount: extractedRows.bookmakerCount,
    selectedBookmaker: extractedRows.selectedBookmaker,
    completedMarkets: extractedRows.completedMarkets,
    oddsPersisted: extractedRows.rows.length
  }
}

export function createRunCurrentPredictionPilotUseCase({
  logger,
  sportsApiClient,
  competitionRepository,
  teamRepository,
  fixtureRepository,
  sportsSyncStateRepository,
  oddsRepository,
  predictionRepository,
  systemRunRepository,
  analysisRunRepository,
  generateScoredPredictions,
  distributedLockManager,
  databaseConfigured,
  databaseConfig,
  nodeEnv,
  timezone,
  maxFixtures,
  historyMaxPagesPerRun,
  now = () => new Date()
}) {
  return async function runCurrentPredictionPilot({
    mode = 'dry-run',
    trigger = 'cli'
  } = {}) {
    if (!['dry-run', 'persist'].includes(mode)) {
      throw new ValidationError('mode must be dry-run or persist')
    }

    const startedAt = now()
    const databaseSafety = assessPilotDatabaseSafety({
      nodeEnv,
      host: databaseConfig.host,
      name: databaseConfig.name
    })
    const run = createSystemRun({
      runId: randomUUID(),
      runType:
        mode === 'persist'
          ? 'CURRENT_PREDICTION_PILOT'
          : 'CURRENT_PREDICTION_PILOT_DRY_RUN',
      status: 'PREPARED',
      startedAt: startedAt.toISOString()
    })

    if (systemRunRepository?.savePreparedRun) {
      await systemRunRepository.savePreparedRun(run)
    }

    if (!sportsApiClient) {
      return {
        status: 'API_FOOTBALL_AUTH_FAILED',
        mode,
        trigger,
        database: databaseSafety
      }
    }

    const lockHandle = await distributedLockManager?.tryAcquire?.({
      key: PILOT_LOCK_KEY,
      timeoutSeconds: 0
    })

    if (distributedLockManager && !lockHandle) {
      return {
        status: 'INCONCLUSIVE',
        mode,
        trigger,
        reason: 'pilot_already_running',
        database: databaseSafety
      }
    }

    let analysisRun = null

    try {
      const statusResponse = await sportsApiClient.getStatus()
      const initialQuota = sportsApiClient.getQuotaSnapshot()
      const plan =
        statusResponse.data?.response?.subscription?.plan || initialQuota.plan
      const dailyLimit = initialQuota.limitDay
      const conservativeCurrent = initialQuota.conservativeCurrent
      const currentUsagePercent =
        Number.isFinite(dailyLimit) && Number.isFinite(conservativeCurrent)
          ? (conservativeCurrent / dailyLimit) * 100
          : 0

      if (!plan) {
        throw new ValidationError('API-Football status did not return a plan')
      }

      if (String(plan).toLowerCase() === 'free') {
        return {
          status: 'API_FOOTBALL_PRO_NOT_ACTIVE',
          mode,
          trigger,
          database: databaseSafety,
          providerPlan: plan,
          quota: initialQuota
        }
      }

      if (
        Number.isFinite(dailyLimit) &&
        Number.isFinite(conservativeCurrent) &&
        currentUsagePercent >= initialQuota.softLimitPercent
      ) {
        return {
          status: 'PROVIDER_QUOTA_UNSAFE',
          mode,
          trigger,
          database: databaseSafety,
          providerPlan: plan,
          quota: initialQuota
        }
      }

      const windows = buildPilotWindows(startedAt, timezone)
      const competitionStats = initializeCompetitionWindowStats()
      const statsByProviderId = new Map(
        competitionStats.map((entry) => [entry.providerCompetitionId, entry])
      )
      const selectedFixtures = []
      const discoveredAuthorizedFixtures = new Map()
      const dates = listDatesInWindow(windows['7d'])

      for (const date of dates) {
        const fixturesResponse = await sportsApiClient.getFixturesByDate({
          date,
          timezone
        })
        const payloads = Array.isArray(fixturesResponse.data?.response)
          ? fixturesResponse.data.response
          : []
        const requestsUsed =
          sportsApiClient.getQuotaSnapshot().successfulCallsIssued

        for (const payload of payloads) {
          const targetCompetition = AUTHORIZED_COMPETITIONS.find(
            (competition) =>
              competition.providerId === Number(payload?.league?.id || 0)
          )

          if (!targetCompetition) {
            continue
          }

          const kickoffAt = new Date(payload?.fixture?.date || '')

          if (!(kickoffAt > startedAt && kickoffAt <= windows['7d'].endsAt)) {
            continue
          }

          updateCompetitionWindowStats(
            statsByProviderId.get(targetCompetition.providerId),
            payload,
            windows,
            requestsUsed
          )

          const dedupeKey = Number(payload?.fixture?.id || 0)

          if (!dedupeKey || discoveredAuthorizedFixtures.has(dedupeKey)) {
            continue
          }

          discoveredAuthorizedFixtures.set(dedupeKey, {
            payload,
            targetCompetition
          })
        }
      }

      const orderedAuthorizedFixtures = [
        ...discoveredAuthorizedFixtures.values()
      ].sort((left, right) => {
        const leftTime = Date.parse(left.payload.fixture.date)
        const rightTime = Date.parse(right.payload.fixture.date)

        if (leftTime !== rightTime) {
          return leftTime - rightTime
        }

        return (
          Number(left.payload.fixture.id) - Number(right.payload.fixture.id)
        )
      })

      for (const candidate of orderedAuthorizedFixtures) {
        if (
          selectedFixtures.length >=
          Math.min(MAX_SELECTED_FIXTURES, maxFixtures)
        ) {
          break
        }

        selectedFixtures.push(candidate)
      }

      if (mode === 'dry-run' || !databaseConfigured || !databaseSafety.safe) {
        const finalStatus = mapPilotStatus({
          fixturesSelected: selectedFixtures.length,
          predictionsPersisted: 0,
          predictionsGenerated: 0,
          databaseSafe: databaseSafety.safe,
          plan
        })

        if (systemRunRepository?.markRunFinished) {
          await systemRunRepository.markRunFinished({
            runId: run.runId,
            status: mapPilotStatusToSystemRun(finalStatus),
            finishedAt: now().toISOString(),
            errorCode:
              finalStatus === 'PILOT_DATABASE_NOT_SAFE' ? finalStatus : null,
            errorMessage:
              finalStatus === 'PILOT_DATABASE_NOT_SAFE' ? finalStatus : null
          })
        }

        return {
          status: finalStatus,
          mode,
          trigger,
          providerPlan: plan,
          database: databaseSafety,
          quota: sportsApiClient.getQuotaSnapshot(),
          windows,
          fixturesFetched: dates.length,
          fixturesAuthorized: orderedAuthorizedFixtures.length,
          fixturesSelected: selectedFixtures.length,
          competitionStats,
          selectedFixtures: selectedFixtures.map(
            ({ payload, targetCompetition }) => ({
              providerFixtureId: Number(payload.fixture.id),
              competitionKey: targetCompetition.key,
              competitionName: payload.league?.name || targetCompetition.name,
              homeTeam: payload.teams?.home?.name || null,
              awayTeam: payload.teams?.away?.name || null,
              kickoffAt: payload.fixture?.date || null
            })
          )
        }
      }

      analysisRun = await analysisRunRepository?.createRun?.({
        startedAt: startedAt.toISOString(),
        status: 'RUNNING',
        fixturesFound: orderedAuthorizedFixtures.length,
        fixturesProcessed: 0,
        apiCalls: sportsApiClient.getQuotaSnapshot().successfulCallsIssued,
        openaiCostUsd: 0,
        errorSummary: null
      })

      const persistedFixtures = []
      const historySummaries = []
      const oddsSummaries = []
      const predictionResults = []
      const skipReasons = {}

      for (const selected of selectedFixtures) {
        const { storedCompetition, storedFixture } =
          await persistFixturePayload({
            payload: selected.payload,
            targetCompetition: selected.targetCompetition,
            competitionRepository,
            teamRepository,
            fixtureRepository
          })
        const historySummary = await hydrateRequiredHistoryForFixture({
          sportsApiClient,
          sportsSyncStateRepository,
          teamRepository,
          fixtureRepository,
          storedCompetition,
          storedFixture,
          timezone,
          historyMaxPagesPerRun,
          now: startedAt
        })
        const oddsSummary = await persistFixtureOdds({
          sportsApiClient,
          oddsRepository,
          storedFixture,
          now: startedAt
        })
        const predictionResult = await generateScoredPredictions({
          fixtureId: storedFixture.id,
          runId: analysisRun?.id || null
        })

        if (predictionResult.status !== 'ok') {
          skipReasons[predictionResult.status] =
            (skipReasons[predictionResult.status] || 0) + 1
        }

        persistedFixtures.push({
          fixture: storedFixture,
          competition: storedCompetition
        })
        historySummaries.push({
          fixtureId: storedFixture.id,
          providerFixtureId: storedFixture.providerId,
          ...historySummary
        })
        oddsSummaries.push({
          fixtureId: storedFixture.id,
          providerFixtureId: storedFixture.providerId,
          ...oddsSummary
        })
        predictionResults.push(predictionResult)
      }

      const predictionsGenerated = predictionResults.reduce((total, result) => {
        if (result.status === 'ok') {
          return total + result.predictions.length
        }

        return total
      }, 0)
      const predictionsPersisted = predictionsGenerated
      const finalStatus = mapPilotStatus({
        fixturesSelected: selectedFixtures.length,
        predictionsPersisted,
        predictionsGenerated,
        databaseSafe: databaseSafety.safe,
        plan
      })

      if (analysisRunRepository?.updateRun && analysisRun) {
        analysisRun = await analysisRunRepository.updateRun({
          id: analysisRun.id,
          finishedAt: now().toISOString(),
          status:
            finalStatus === 'REAL_PREDICTION_PILOT_READY_FOR_REVIEW'
              ? 'COMPLETED'
              : 'PARTIAL',
          fixturesFound: orderedAuthorizedFixtures.length,
          fixturesProcessed: persistedFixtures.length,
          apiCalls: sportsApiClient.getQuotaSnapshot().successfulCallsIssued,
          openaiCostUsd: 0,
          errorSummary:
            Object.keys(skipReasons).length > 0 ? { skipReasons } : null
        })
      }

      if (systemRunRepository?.markRunFinished) {
        await systemRunRepository.markRunFinished({
          runId: run.runId,
          status: mapPilotStatusToSystemRun(finalStatus),
          finishedAt: now().toISOString(),
          errorCode:
            Object.keys(skipReasons).length > 0
              ? Object.keys(skipReasons)[0]
              : null,
          errorMessage:
            Object.keys(skipReasons).length > 0
              ? JSON.stringify(skipReasons)
              : null
        })
      }

      return {
        status: finalStatus,
        mode,
        trigger,
        providerPlan: plan,
        database: databaseSafety,
        quota: sportsApiClient.getQuotaSnapshot(),
        windows,
        fixturesFetched: dates.length,
        fixturesAuthorized: orderedAuthorizedFixtures.length,
        fixturesSelected: selectedFixtures.length,
        historicalFixturesHydrated: historySummaries.reduce(
          (total, summary) => total + summary.fixturesHydrated,
          0
        ),
        historicalFixturesExcluded: historySummaries.reduce(
          (total, summary) => total + summary.fixturesExcluded,
          0
        ),
        oddsFound: oddsSummaries.reduce(
          (total, summary) => total + summary.oddsPersisted,
          0
        ),
        predictionsGenerated,
        predictionsPersisted,
        predictionsSkipped: Object.values(skipReasons).reduce(
          (total, value) => total + value,
          0
        ),
        skipReasons,
        competitionStats,
        persistedFixtures,
        historySummaries,
        oddsSummaries,
        predictionResults,
        systemRun: {
          runId: run.runId,
          runType: run.runType
        },
        analysisRun
      }
    } catch (error) {
      logger.error('Current prediction pilot failed', {
        error: toErrorLogPayload(error)
      })

      if (analysisRunRepository?.updateRun && analysisRun?.id) {
        await analysisRunRepository.updateRun({
          id: analysisRun.id,
          finishedAt: now().toISOString(),
          status: 'FAILED',
          fixturesFound: analysisRun.fixturesFound || 0,
          fixturesProcessed: analysisRun.fixturesProcessed || 0,
          apiCalls: sportsApiClient.getQuotaSnapshot().successfulCallsIssued,
          openaiCostUsd: 0,
          errorSummary: toErrorLogPayload(error)
        })
      }

      if (systemRunRepository?.markRunFinished) {
        await systemRunRepository.markRunFinished({
          runId: run.runId,
          status: 'FAILED',
          finishedAt: now().toISOString(),
          errorCode: error.code || 'CURRENT_PILOT_FAILED',
          errorMessage: error.message
        })
      }

      throw error
    } finally {
      if (distributedLockManager?.release && lockHandle) {
        await distributedLockManager.release(lockHandle)
      }
    }
  }
}
