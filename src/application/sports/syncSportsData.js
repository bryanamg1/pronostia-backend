import { AUTHORIZED_COMPETITIONS } from '../../domain/sports/authorizedCompetitions.js'
import { buildFixtureWindow } from '../../domain/sports/buildFixtureWindow.js'
import { normalizeProviderCompetition } from '../../domain/sports/normalizeProviderCompetition.js'
import { normalizeProviderFixture } from '../../domain/sports/normalizeProviderFixture.js'
import { toErrorLogPayload } from '../../shared/utils/sanitize.js'

function shouldStopSync(error) {
  const reason = error?.details?.reason

  return (
    reason === 'soft_limit_reached' ||
    reason === 'daily_quota_exhausted' ||
    reason === 'rate_limited'
  )
}

function buildHistorySyncKey({ providerId, season }) {
  return `history:${providerId}:${season}`
}

function buildAuthorizedCompetitionMap(competitions) {
  return new Map(
    competitions.map((competition) => [competition.providerId, competition])
  )
}

export function createSyncSportsDataUseCase({
  logger,
  sportsApiClient,
  competitionRepository,
  teamRepository,
  fixtureRepository,
  sportsSyncStateRepository,
  databaseConfigured,
  timezone,
  defaultSeason,
  lookaheadHours,
  maxFixtures,
  historyMaxPagesPerRun,
  now = () => new Date(),
  authorizedCompetitions = AUTHORIZED_COMPETITIONS
}) {
  return async function syncSportsData({ trigger = 'manual' } = {}) {
    const startedAt = now()

    if (!databaseConfigured) {
      return {
        status: 'skipped',
        reason: 'database_not_configured',
        trigger,
        startedAt: startedAt.toISOString()
      }
    }

    if (!sportsApiClient) {
      return {
        status: 'skipped',
        reason: 'provider_not_configured',
        trigger,
        startedAt: startedAt.toISOString()
      }
    }

    await sportsApiClient.getStatus()

    const season = defaultSeason
    const fixtureWindow = buildFixtureWindow({
      now: startedAt,
      lookaheadHours,
      timezone
    })
    const selectedDailyFixtures = new Map()
    const historicalFixtures = new Map()
    const uniqueTeams = new Map()
    const errors = []
    const storedCompetitionsByProviderId = new Map()
    let historyPagesProcessed = 0
    let duplicatesDiscarded = 0
    let totalDailyCandidates = 0
    let competitionsSynced = 0
    let stopReason = null
    const authorizedCompetitionsByProviderId = buildAuthorizedCompetitionMap(
      authorizedCompetitions
    )

    for (const targetCompetition of authorizedCompetitions) {
      try {
        const leagueResponse = await sportsApiClient.getLeague({
          providerId: targetCompetition.providerId,
          season
        })
        const providerCompetition = leagueResponse.data?.response?.[0] || null
        const storedCompetition = await competitionRepository.upsertCompetition(
          normalizeProviderCompetition({
            target: targetCompetition,
            providerPayload: providerCompetition,
            season
          })
        )
        storedCompetitionsByProviderId.set(
          targetCompetition.providerId,
          storedCompetition
        )

        competitionsSynced += 1

        const historySyncKey = buildHistorySyncKey({
          providerId: targetCompetition.providerId,
          season
        })
        const historyState =
          await sportsSyncStateRepository.findByKey(historySyncKey)

        if (
          historyPagesProcessed < historyMaxPagesPerRun &&
          historyState?.completed !== true
        ) {
          const page = Number(historyState?.cursor?.page || 1)
          const historyResponse =
            await sportsApiClient.getHistoricalFixturesPage({
              leagueId: targetCompetition.providerId,
              season,
              timezone,
              page
            })
          const historyPayloads = Array.isArray(historyResponse.data?.response)
            ? historyResponse.data.response
            : []

          for (const payload of historyPayloads) {
            const normalized = normalizeProviderFixture({
              payload,
              competitionId: storedCompetition.id
            })

            uniqueTeams.set(normalized.homeTeam.providerId, normalized.homeTeam)
            uniqueTeams.set(normalized.awayTeam.providerId, normalized.awayTeam)
            historicalFixtures.set(normalized.providerId, normalized)
          }

          const currentPage = Number(
            historyResponse.data?.paging?.current || page
          )
          const totalPages = Number(historyResponse.data?.paging?.total || page)
          const completed = currentPage >= totalPages

          await sportsSyncStateRepository.upsertSyncState({
            syncKey: historySyncKey,
            provider: 'api-football',
            scopeType: 'competition-season-history',
            cursor: {
              page: completed ? currentPage : currentPage + 1,
              currentPage,
              totalPages,
              season,
              providerId: targetCompetition.providerId
            },
            metadata: {
              results: Number(
                historyResponse.data?.results || historyPayloads.length
              )
            },
            completed,
            lastStatus: 'success',
            lastSyncedAt: startedAt.toISOString(),
            lastSuccessAt: startedAt.toISOString(),
            lastErrorCode: null,
            lastErrorMessage: null
          })

          historyPagesProcessed += 1
        }
      } catch (error) {
        const errorPayload = toErrorLogPayload(error)
        errors.push({
          competitionKey: targetCompetition.key,
          error: errorPayload
        })
        logger.warn('Sports sync competition failed', {
          competitionKey: targetCompetition.key,
          error: errorPayload
        })

        if (shouldStopSync(error)) {
          stopReason = error.details?.reason || 'provider_limited'
          break
        }
      }
    }

    if (!stopReason) {
      try {
        const fixturesResponse = await sportsApiClient.getFixturesByDateRange({
          fromDate: fixtureWindow.fromDate,
          toDate: fixtureWindow.toDate,
          timezone
        })
        const fixturePayloads = Array.isArray(fixturesResponse.data?.response)
          ? fixturesResponse.data.response
          : []

        for (const payload of fixturePayloads) {
          const providerCompetitionId = Number(payload?.league?.id)
          const authorizedCompetition = authorizedCompetitionsByProviderId.get(
            providerCompetitionId
          )
          const storedCompetition = storedCompetitionsByProviderId.get(
            providerCompetitionId
          )

          if (!authorizedCompetition || !storedCompetition) {
            continue
          }

          const normalized = normalizeProviderFixture({
            payload,
            competitionId: storedCompetition.id
          })
          const kickoffAt = new Date(normalized.kickoffAt)

          if (
            kickoffAt < fixtureWindow.startsAt ||
            kickoffAt > fixtureWindow.endsAt
          ) {
            continue
          }

          totalDailyCandidates += 1
          uniqueTeams.set(normalized.homeTeam.providerId, normalized.homeTeam)
          uniqueTeams.set(normalized.awayTeam.providerId, normalized.awayTeam)

          if (selectedDailyFixtures.has(normalized.providerId)) {
            duplicatesDiscarded += 1
            continue
          }

          selectedDailyFixtures.set(normalized.providerId, normalized)
        }
      } catch (error) {
        const errorPayload = toErrorLogPayload(error)
        errors.push({
          competitionKey: 'global-fixtures',
          error: errorPayload
        })
        logger.warn('Sports sync global fixtures failed', {
          error: errorPayload
        })

        if (shouldStopSync(error)) {
          stopReason = error.details?.reason || 'provider_limited'
        }
      }
    }

    const orderedDailyFixtures = [...selectedDailyFixtures.values()]
      .sort(
        (left, right) =>
          new Date(left.kickoffAt).getTime() -
          new Date(right.kickoffAt).getTime()
      )
      .slice(0, maxFixtures)

    const persistedTeams = new Map()

    for (const team of uniqueTeams.values()) {
      const storedTeam = await teamRepository.upsertTeam(team)
      persistedTeams.set(storedTeam.providerId, storedTeam)
    }

    const fixturesToPersist = new Map()

    for (const fixture of historicalFixtures.values()) {
      fixturesToPersist.set(fixture.providerId, fixture)
    }

    for (const fixture of orderedDailyFixtures) {
      fixturesToPersist.set(fixture.providerId, fixture)
    }

    let persistedFixtures = 0

    for (const fixture of fixturesToPersist.values()) {
      await fixtureRepository.upsertFixture({
        providerId: fixture.providerId,
        competitionId: fixture.competitionId,
        homeTeamId: persistedTeams.get(fixture.homeTeam.providerId).id,
        awayTeamId: persistedTeams.get(fixture.awayTeam.providerId).id,
        kickoffAt: fixture.kickoffAt,
        status: fixture.status,
        homeGoals: fixture.homeGoals,
        awayGoals: fixture.awayGoals,
        rawSourceUpdatedAt: fixture.rawSourceUpdatedAt
      })
      persistedFixtures += 1
    }

    const noFixturesAvailable =
      orderedDailyFixtures.length === 0 && errors.length === 0
    const status = noFixturesAvailable
      ? 'completed'
      : errors.length > 0 || stopReason
        ? 'partial'
        : 'completed'

    const result = {
      status,
      trigger,
      startedAt: startedAt.toISOString(),
      season,
      result: noFixturesAvailable
        ? 'no_fixtures_available'
        : 'fixtures_processed',
      competitionsSynced,
      fixturesFound: totalDailyCandidates,
      fixturesSelected: orderedDailyFixtures.length,
      fixturesPersisted: persistedFixtures,
      duplicatesDiscarded,
      teamsPersisted: persistedTeams.size,
      historyPagesProcessed,
      openAiInvoked: false,
      quota: sportsApiClient.getQuotaSnapshot(),
      errors,
      stopReason
    }

    logger.info('Sports sync finished', result)

    return result
  }
}
