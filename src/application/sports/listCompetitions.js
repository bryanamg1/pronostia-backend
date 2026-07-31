import { ValidationError } from '../../shared/errors/AppError.js'
import {
  AUTHORIZED_COMPETITIONS,
  AUTHORIZED_COMPETITION_AVAILABILITY_STATUSES,
  AUTHORIZED_COMPETITION_COUNTRIES,
  AUTHORIZED_COMPETITION_REGIONS,
  AUTHORIZED_COMPETITION_TYPES,
  getAuthorizedCompetitionByKey
} from '../../domain/sports/competitionCatalog.js'

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

function toPublicCompetition({ storedCompetition, catalogCompetition }) {
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
    displayOrder: catalogCompetition.displayOrder
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

export function createListCompetitionsUseCase({ competitionRepository }) {
  return async function listCompetitions(filters = {}) {
    const competitions = await competitionRepository.listEnabledCompetitions()
    const competitionsByKey = new Map()
    const normalizedFilters = normalizeFilters(filters)

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
        storedCompetition: competitionsByKey.get(catalogCompetition.key) || null
      })
    ).filter((competition) => matchesFilters(competition, normalizedFilters))
  }
}
