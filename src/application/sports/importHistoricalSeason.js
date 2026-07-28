import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { AUTHORIZED_COMPETITIONS } from '../../domain/sports/authorizedCompetitions.js'
import { normalizeProviderCompetition } from '../../domain/sports/normalizeProviderCompetition.js'
import { normalizeProviderFixture } from '../../domain/sports/normalizeProviderFixture.js'
import { ValidationError } from '../../shared/errors/AppError.js'
import { sanitizeHeaders, sanitizeObject } from '../../shared/utils/sanitize.js'

function buildSyncKey({ providerId, season }) {
  return `history:${providerId}:${season}`
}

function areTeamsEqual(left, right) {
  if (!left || !right) {
    return false
  }

  return left.name === right.name && left.logoUrl === right.logoUrl
}

function areFixturesEqual(left, right) {
  if (!left || !right) {
    return false
  }

  return (
    left.competition.id === right.competition.id &&
    left.homeTeam.id === right.homeTeam.id &&
    left.awayTeam.id === right.awayTeam.id &&
    left.kickoffAt === right.kickoffAt &&
    left.status === right.status &&
    left.homeGoals === right.homeGoals &&
    left.awayGoals === right.awayGoals &&
    left.rawSourceUpdatedAt === right.rawSourceUpdatedAt
  )
}

function validateHistoricalFixturePayload({ payload, providerId, season }) {
  const leagueId = Number(payload?.league?.id)
  const payloadSeason = Number(payload?.league?.season)
  const fixtureId = Number(payload?.fixture?.id)
  const homeTeamId = Number(payload?.teams?.home?.id)
  const awayTeamId = Number(payload?.teams?.away?.id)
  const status = payload?.fixture?.status?.short

  if (leagueId !== providerId) {
    throw new ValidationError(
      'Historical payload contains a different league',
      {
        expectedLeagueId: providerId,
        receivedLeagueId: leagueId,
        fixtureId
      }
    )
  }

  if (payloadSeason !== season) {
    throw new ValidationError(
      'Historical payload contains a different season',
      {
        expectedSeason: season,
        receivedSeason: payloadSeason,
        fixtureId
      }
    )
  }

  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    throw new ValidationError(
      'Historical payload contains an invalid fixture id'
    )
  }

  if (!Number.isInteger(homeTeamId) || !Number.isInteger(awayTeamId)) {
    throw new ValidationError(
      'Historical payload contains an invalid team identifier',
      { fixtureId }
    )
  }

  if (status !== 'FT') {
    throw new ValidationError(
      'Historical payload contains a fixture without final FT status',
      {
        fixtureId,
        status
      }
    )
  }
}

async function loadCachedPayload(payloadPath) {
  try {
    const fileContent = await readFile(payloadPath, 'utf8')
    return JSON.parse(fileContent)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function persistPayloadFile(payloadPath, payload) {
  await mkdir(path.dirname(payloadPath), {
    recursive: true
  })
  await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function createImportHistoricalSeasonUseCase({
  logger,
  env,
  competitionRepository,
  teamRepository,
  fixtureRepository,
  sportsSyncStateRepository,
  fetchImpl = global.fetch,
  now = () => new Date()
}) {
  return async function importHistoricalSeason({
    competitionKey = 'premier-league',
    season = 2024,
    payloadPath = path.join(
      process.cwd(),
      'docs',
      'discovery-output',
      `${competitionKey}-${season}-historical-fixtures.json`
    )
  } = {}) {
    const competitionTarget = AUTHORIZED_COMPETITIONS.find(
      (competition) => competition.key === competitionKey
    )

    if (!competitionTarget) {
      throw new ValidationError(
        'Unknown authorized competition for history import',
        {
          competitionKey
        }
      )
    }

    if (season !== 2024 || competitionTarget.providerId !== 39) {
      throw new ValidationError(
        'Historical validation in this run is restricted to Premier League 2024',
        {
          competitionKey,
          season
        }
      )
    }

    const cachedPayload = await loadCachedPayload(payloadPath)
    let datasetSource = 'local-cache'
    let datasetEnvelope = cachedPayload

    if (!datasetEnvelope) {
      if (!env.sports.configured || !env.sports.apiKey) {
        throw new ValidationError(
          'No local historical payload found and SPORTS_API_KEY is not configured'
        )
      }

      const url = new URL(
        'fixtures',
        `${env.sports.baseUrl.replace(/\/$/, '')}/`
      )
      url.searchParams.set('league', String(competitionTarget.providerId))
      url.searchParams.set('season', String(season))
      url.searchParams.set('status', 'FT')

      const response = await fetchImpl(url, {
        headers: {
          'x-apisports-key': env.sports.apiKey
        }
      })
      const text = await response.text()
      const body = text ? JSON.parse(text) : null
      const responseHeaders = sanitizeHeaders(response.headers)

      datasetEnvelope = {
        fetchedAt: now().toISOString(),
        request: {
          url: url.toString()
        },
        response: {
          status: response.status,
          headers: responseHeaders,
          body: sanitizeObject(body)
        }
      }
      datasetSource = 'provider-query'

      await persistPayloadFile(payloadPath, datasetEnvelope)

      if (!response.ok) {
        throw new ValidationError('Historical provider query failed', {
          status: response.status
        })
      }
    }

    const providerBody =
      datasetEnvelope?.response?.body || datasetEnvelope?.body || null
    const providerErrors = providerBody?.errors
    const providerFixtures = Array.isArray(providerBody?.response)
      ? providerBody.response
      : []

    if (
      providerErrors &&
      ((Array.isArray(providerErrors) && providerErrors.length > 0) ||
        (!Array.isArray(providerErrors) &&
          Object.keys(providerErrors).length > 0))
    ) {
      throw new ValidationError('Historical provider payload contains errors', {
        errors: providerErrors
      })
    }

    if (providerFixtures.length === 0) {
      throw new ValidationError(
        'Historical provider payload does not contain fixtures'
      )
    }

    const existingCompetition =
      await competitionRepository.findCompetitionByProviderIdAndSeason({
        providerId: competitionTarget.providerId,
        season
      })
    const beforeFixtureCount = (
      await fixtureRepository.listCompletedFixturesByCompetition({
        competitionId: existingCompetition?.id || -1
      })
    ).length

    const providerCompetition = providerFixtures[0]
    const storedCompetition = await competitionRepository.upsertCompetition(
      normalizeProviderCompetition({
        target: competitionTarget,
        providerPayload: {
          league: providerCompetition.league,
          country: {
            name:
              providerCompetition.league?.country || competitionTarget.country
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

    const orderedPayloads = [...providerFixtures].sort((left, right) => {
      const leftTime = Date.parse(left?.fixture?.date || '')
      const rightTime = Date.parse(right?.fixture?.date || '')

      if (leftTime !== rightTime) {
        return leftTime - rightTime
      }

      return Number(left?.fixture?.id || 0) - Number(right?.fixture?.id || 0)
    })

    const teamCache = new Map()
    const runStats = {
      source: datasetSource,
      payloadPath,
      requestStatus: datasetEnvelope?.response?.status || null,
      responseHeaders: datasetEnvelope?.response?.headers || {},
      bodyErrors: providerErrors || [],
      bodyResults: Number(providerBody?.results || orderedPayloads.length),
      paging: providerBody?.paging || null,
      responseLength: orderedPayloads.length,
      fixturesReceived: orderedPayloads.length,
      fixturesNew: 0,
      fixturesUpdated: 0,
      fixturesUnchanged: 0,
      fixturesRejected: 0,
      teamsNew: 0,
      teamsUpdated: 0,
      teamsUnchanged: 0,
      competitionNew: existingCompetition ? 0 : 1,
      competitionUnchanged: existingCompetition ? 1 : 0,
      competitionId: storedCompetition.id,
      initialFixtureCount: beforeFixtureCount
    }

    for (const payload of orderedPayloads) {
      try {
        validateHistoricalFixturePayload({
          payload,
          providerId: competitionTarget.providerId,
          season
        })

        const normalized = normalizeProviderFixture({
          payload,
          competitionId: storedCompetition.id
        })
        const existingHomeTeam = teamCache.has(normalized.homeTeam.providerId)
          ? teamCache.get(normalized.homeTeam.providerId)
          : await teamRepository.findByProviderId(
              normalized.homeTeam.providerId
            )
        const existingAwayTeam = teamCache.has(normalized.awayTeam.providerId)
          ? teamCache.get(normalized.awayTeam.providerId)
          : await teamRepository.findByProviderId(
              normalized.awayTeam.providerId
            )

        const storedHomeTeam = await teamRepository.upsertTeam(
          normalized.homeTeam
        )
        const storedAwayTeam = await teamRepository.upsertTeam(
          normalized.awayTeam
        )

        teamCache.set(storedHomeTeam.providerId, storedHomeTeam)
        teamCache.set(storedAwayTeam.providerId, storedAwayTeam)

        if (!existingHomeTeam) {
          runStats.teamsNew += 1
        } else if (areTeamsEqual(existingHomeTeam, storedHomeTeam)) {
          runStats.teamsUnchanged += 1
        } else {
          runStats.teamsUpdated += 1
        }

        if (!existingAwayTeam) {
          runStats.teamsNew += 1
        } else if (areTeamsEqual(existingAwayTeam, storedAwayTeam)) {
          runStats.teamsUnchanged += 1
        } else {
          runStats.teamsUpdated += 1
        }

        const existingFixture = await fixtureRepository.findFixtureByProviderId(
          normalized.providerId
        )
        const storedFixture = await fixtureRepository.upsertFixture({
          providerId: normalized.providerId,
          competitionId: storedCompetition.id,
          homeTeamId: storedHomeTeam.id,
          awayTeamId: storedAwayTeam.id,
          kickoffAt: normalized.kickoffAt,
          status: normalized.status,
          homeGoals: normalized.homeGoals,
          awayGoals: normalized.awayGoals,
          rawSourceUpdatedAt: normalized.rawSourceUpdatedAt
        })

        if (!existingFixture) {
          runStats.fixturesNew += 1
        } else if (areFixturesEqual(existingFixture, storedFixture)) {
          runStats.fixturesUnchanged += 1
        } else {
          runStats.fixturesUpdated += 1
        }
      } catch (error) {
        runStats.fixturesRejected += 1
        logger.warn('Historical fixture import rejected', {
          provider: 'api-football',
          competitionKey,
          season,
          fixtureId: payload?.fixture?.id || null,
          error: sanitizeObject({
            message: error.message,
            details: error.details
          })
        })
      }
    }

    const finalFixtures =
      await fixtureRepository.listCompletedFixturesByCompetition({
        competitionId: storedCompetition.id
      })
    const duplicateProviderIds =
      finalFixtures.length -
      new Set(finalFixtures.map((fixture) => fixture.providerId)).size

    await sportsSyncStateRepository.upsertSyncState({
      syncKey: buildSyncKey({
        providerId: competitionTarget.providerId,
        season
      }),
      provider: 'api-football',
      scopeType: 'competition-season-history',
      cursor: {
        season,
        providerId: competitionTarget.providerId,
        importedFixtures: finalFixtures.length,
        source: datasetSource
      },
      metadata: {
        responseLength: orderedPayloads.length,
        initialFixtureCount: beforeFixtureCount,
        finalFixtureCount: finalFixtures.length,
        duplicateProviderIds
      },
      completed: true,
      lastStatus: 'success',
      lastSyncedAt: now().toISOString(),
      lastSuccessAt: now().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null
    })

    return {
      ...runStats,
      finalFixtureCount: finalFixtures.length,
      duplicateProviderIds
    }
  }
}
