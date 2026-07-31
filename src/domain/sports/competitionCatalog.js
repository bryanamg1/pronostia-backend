import { ValidationError } from '../../shared/errors/AppError.js'

export const COMPETITION_TYPES = {
  DOMESTIC_LEAGUE: 'DOMESTIC_LEAGUE',
  DOMESTIC_CUP: 'DOMESTIC_CUP',
  CONTINENTAL_CUP: 'CONTINENTAL_CUP'
}

export const COMPETITION_AVAILABILITY_STATUSES = {
  VERIFIED: 'VERIFIED',
  PARTIAL: 'PARTIAL',
  PLAN_RESTRICTED: 'PLAN_RESTRICTED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  INCONCLUSIVE: 'INCONCLUSIVE'
}

function buildCompetition(definition, displayOrder) {
  return Object.freeze({
    ...definition,
    displayOrder,
    isAuthorized: true,
    isEnabled: true
  })
}

export const AUTHORIZED_COMPETITIONS = Object.freeze([
  buildCompetition(
    {
      key: 'laliga',
      providerId: 140,
      name: 'LaLiga',
      country: 'Spain',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    0
  ),
  buildCompetition(
    {
      key: 'premier-league',
      providerId: 39,
      name: 'Premier League',
      country: 'England',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    1
  ),
  buildCompetition(
    {
      key: 'ligue-1',
      providerId: 61,
      name: 'Ligue 1',
      country: 'France',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    2
  ),
  buildCompetition(
    {
      key: 'serie-a-italy',
      providerId: 135,
      name: 'Serie A',
      country: 'Italy',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    3
  ),
  buildCompetition(
    {
      key: 'bundesliga',
      providerId: 78,
      name: 'Bundesliga',
      country: 'Germany',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    4
  ),
  buildCompetition(
    {
      key: 'liga-profesional-arg',
      providerId: 128,
      name: 'Liga Profesional Argentina',
      country: 'Argentina',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    5
  ),
  buildCompetition(
    {
      key: 'serie-a-brazil',
      providerId: 71,
      name: 'Brasileirão Série A',
      country: 'Brazil',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_LEAGUE,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    6
  ),
  buildCompetition(
    {
      key: 'copa-del-rey',
      providerId: 143,
      name: 'Copa del Rey',
      country: 'Spain',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2025
    },
    7
  ),
  buildCompetition(
    {
      key: 'fa-cup',
      providerId: 45,
      name: 'FA Cup',
      country: 'England',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2025
    },
    8
  ),
  buildCompetition(
    {
      key: 'coupe-de-france',
      providerId: 66,
      name: 'Coupe de France',
      country: 'France',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2025
    },
    9
  ),
  buildCompetition(
    {
      key: 'coppa-italia',
      providerId: 137,
      name: 'Coppa Italia',
      country: 'Italy',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    10
  ),
  buildCompetition(
    {
      key: 'dfb-pokal',
      providerId: 81,
      name: 'DFB-Pokal',
      country: 'Germany',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    11
  ),
  buildCompetition(
    {
      key: 'copa-argentina',
      providerId: 130,
      name: 'Copa Argentina',
      country: 'Argentina',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    12
  ),
  buildCompetition(
    {
      key: 'copa-do-brasil',
      providerId: 73,
      name: 'Copa do Brasil',
      country: 'Brazil',
      region: null,
      type: COMPETITION_TYPES.DOMESTIC_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    13
  ),
  buildCompetition(
    {
      key: 'uefa-champions-league',
      providerId: 2,
      name: 'UEFA Champions League',
      country: null,
      region: 'Europe',
      type: COMPETITION_TYPES.CONTINENTAL_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    14
  ),
  buildCompetition(
    {
      key: 'uefa-europa-league',
      providerId: 3,
      name: 'UEFA Europa League',
      country: null,
      region: 'Europe',
      type: COMPETITION_TYPES.CONTINENTAL_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    15
  ),
  buildCompetition(
    {
      key: 'conmebol-libertadores',
      providerId: 13,
      name: 'Copa Libertadores',
      country: null,
      region: 'South America',
      type: COMPETITION_TYPES.CONTINENTAL_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    16
  ),
  buildCompetition(
    {
      key: 'conmebol-sudamericana',
      providerId: 11,
      name: 'Copa Sudamericana',
      country: null,
      region: 'South America',
      type: COMPETITION_TYPES.CONTINENTAL_CUP,
      availabilityStatus: COMPETITION_AVAILABILITY_STATUSES.PARTIAL,
      referenceSeason: 2026
    },
    17
  )
])

export const AUTHORIZED_COMPETITIONS_BY_KEY = new Map(
  AUTHORIZED_COMPETITIONS.map((competition) => [competition.key, competition])
)

export const AUTHORIZED_COMPETITIONS_BY_PROVIDER_ID = new Map(
  AUTHORIZED_COMPETITIONS.map((competition) => [
    competition.providerId,
    competition
  ])
)

export const AUTHORIZED_COMPETITION_KEYS = Object.freeze(
  AUTHORIZED_COMPETITIONS.map((competition) => competition.key)
)

export const AUTHORIZED_COMPETITION_COUNTRIES = Object.freeze([
  ...new Set(
    AUTHORIZED_COMPETITIONS.map((competition) => competition.country).filter(
      Boolean
    )
  )
])

export const AUTHORIZED_COMPETITION_REGIONS = Object.freeze([
  ...new Set(
    AUTHORIZED_COMPETITIONS.map((competition) => competition.region).filter(
      Boolean
    )
  )
])

export const AUTHORIZED_COMPETITION_TYPES = Object.freeze(
  Object.values(COMPETITION_TYPES)
)

export const AUTHORIZED_COMPETITION_AVAILABILITY_STATUSES = Object.freeze(
  Object.values(COMPETITION_AVAILABILITY_STATUSES)
)

export function getAuthorizedCompetitionByKey(key) {
  return AUTHORIZED_COMPETITIONS_BY_KEY.get(key) || null
}

export function isAuthorizedCompetitionKey(key) {
  return AUTHORIZED_COMPETITIONS_BY_KEY.has(key)
}

export function assertAuthorizedCompetitionKey(key) {
  if (!isAuthorizedCompetitionKey(key)) {
    throw new ValidationError(
      'competition must be one of the authorized competition keys'
    )
  }
}
