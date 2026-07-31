import { ValidationError } from '../../shared/errors/AppError.js'
import {
  AUTHORIZED_COMPETITIONS,
  AUTHORIZED_COMPETITION_AVAILABILITY_STATUSES,
  AUTHORIZED_COMPETITION_COUNTRIES,
  AUTHORIZED_COMPETITION_REGIONS,
  AUTHORIZED_COMPETITION_TYPES,
  getAuthorizedCompetitionByKey
} from '../../domain/sports/competitionCatalog.js'

const HISTORICAL_STATUSES = new Set([
  'FT',
  'AET',
  'PEN',
  'CANC',
  'ABD',
  'AWD',
  'WO'
])

function getSeasonValue(competition) {
  return Number.isInteger(competition?.season) ? competition.season : -1
}

function pickPreferredCompetition(current, candidate) {
  if (!current) {
    return candidate
  }

  if (getSeasonValue(candidate) > getSeasonValue(current)) {
    return candidate
  }

  return current
}

function normalizeFilterValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeFilters(filters = {}) {
  return {
    type: normalizeFilterValue(filters.type),
    country: normalizeFilterValue(filters.country),
    region: normalizeFilterValue(filters.region),
    availabilityStatus: normalizeFilterValue(filters.availabilityStatus)
  }
}

function assertValidFilterValue(value, allowedValues, fieldName) {
  if (!value) {
    return
  }

  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} is not supported`)
  }
}

function assertValidFilters(filters) {
  assertValidFilterValue(filters.type, AUTHORIZED_COMPETITION_TYPES, 'type')
  assertValidFilterValue(
    filters.country,
    AUTHORIZED_COMPETITION_COUNTRIES,
    'country'
  )
  assertValidFilterValue(
    filters.region,
    AUTHORIZED_COMPETITION_REGIONS,
    'region'
  )
  assertValidFilterValue(
    filters.availabilityStatus,
    AUTHORIZED_COMPETITION_AVAILABILITY_STATUSES,
    'availabilityStatus'
  )
}

function toMySqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function isHistoricalFixture(fixture, now) {
  if (HISTORICAL_STATUSES.has(fixture.status)) {
    return true
  }

  const kickoffTime = Date.parse(fixture.kickoffAt)

  if (Number.isNaN(kickoffTime)) {
    return false
  }

  return kickoffTime < now.getTime()
}

function createEmptyCompetitionStats() {
  return {
    fixtureCount: 0,
    predictionCount: 0,
    historicalFixtureCount: 0
  }
}

function buildCompetitionStats({ fixtures, predictions, now }) {
  const statsByCompetitionKey = new Map()

  for (const fixture of fixtures) {
    const competitionKey = fixture.competition?.targetKey

    if (!competitionKey) {
      continue
    }

    const currentStats =
      statsByCompetitionKey.get(competitionKey) || createEmptyCompetitionStats()

    currentStats.fixtureCount += 1

    if (isHistoricalFixture(fixture, now)) {
      currentStats.historicalFixtureCount += 1
    }

    statsByCompetitionKey.set(competitionKey, currentStats)
  }

  for (const prediction of predictions) {
    const competitionKey = prediction.fixture?.competition?.targetKey

    if (!competitionKey) {
      continue
    }

    const currentStats =
      statsByCompetitionKey.get(competitionKey) || createEmptyCompetitionStats()

    currentStats.predictionCount += 1
    statsByCompetitionKey.set(competitionKey, currentStats)
  }

  return statsByCompetitionKey
}

function toPublicCompetition({
  storedCompetition,
  catalogCompetition,
  stats = createEmptyCompetitionStats()
}) {
  return {
    id: storedCompetition?.id ?? null,
    key: catalogCompetition.key,
    targetKey: catalogCompetition.key,
    name: catalogCompetition.name,
    country: catalogCompetition.country,
    region: catalogCompetition.region,
    type: catalogCompetition.type,
    availabilityStatus: catalogCompetition.availabilityStatus,
    season: storedCompetition?.season ?? catalogCompetition.referenceSeason,
    isEnabled: storedCompetition?.enabled ?? catalogCompetition.isEnabled,
    displayOrder: catalogCompetition.displayOrder,
    fixtureCount: stats.fixtureCount,
    predictionCount: stats.predictionCount,
    historicalFixtureCount: stats.historicalFixtureCount,
    hasHistoricalDataOnly:
      stats.fixtureCount > 0 &&
      stats.fixtureCount === stats.historicalFixtureCount
  }
}

function matchesFilters(competition, filters) {
  if (filters.type && competition.type !== filters.type) {
    return false
  }

  if (filters.country && competition.country !== filters.country) {
    return false
  }

  if (filters.region && competition.region !== filters.region) {
    return false
  }

  if (
    filters.availabilityStatus &&
    competition.availabilityStatus !== filters.availabilityStatus
  ) {
    return false
  }

  return true
}

export function createListCompetitionsUseCase({
  competitionRepository,
  fixtureRepository = null,
  predictionRepository = null,
  now = () => new Date(),
  lookaheadHours = 24,
  maxFixtures = 40
}) {
  return async function listCompetitions(filters = {}) {
    const competitions = await competitionRepository.listEnabledCompetitions()
    const startsAt = now()
    const endsAt = new Date(
      startsAt.getTime() + lookaheadHours * 60 * 60 * 1000
    )
    const competitionsByKey = new Map()
    const normalizedFilters = normalizeFilters(filters)
    const [fixtures, predictions] =
      fixtureRepository && predictionRepository
        ? await Promise.all([
            fixtureRepository.listFixturesByWindow({
              from: startsAt,
              to: endsAt,
              limit: maxFixtures
            }),
            predictionRepository.listPredictionsByWindow({
              from: toMySqlDateTime(startsAt),
              to: toMySqlDateTime(endsAt),
              limit: maxFixtures * 6
            })
          ])
        : [[], []]
    const statsByCompetitionKey = buildCompetitionStats({
      fixtures,
      predictions,
      now: startsAt
    })

    assertValidFilters(normalizedFilters)

    for (const competition of competitions) {
      const catalogCompetition = getAuthorizedCompetitionByKey(
        competition.targetKey
      )

      if (!catalogCompetition) {
        continue
      }

      competitionsByKey.set(
        competition.targetKey,
        pickPreferredCompetition(
          competitionsByKey.get(competition.targetKey),
          competition
        )
      )
    }

    return AUTHORIZED_COMPETITIONS.map((catalogCompetition) =>
      toPublicCompetition({
        catalogCompetition,
        storedCompetition:
          competitionsByKey.get(catalogCompetition.key) || null,
        stats:
          statsByCompetitionKey.get(catalogCompetition.key) ||
          createEmptyCompetitionStats()
      })
    ).filter((competition) => matchesFilters(competition, normalizedFilters))
  }
}
