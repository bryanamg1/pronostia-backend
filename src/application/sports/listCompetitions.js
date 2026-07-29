import { AUTHORIZED_COMPETITIONS } from '../../domain/sports/authorizedCompetitions.js'

const authorizedCompetitionOrder = new Map(
  AUTHORIZED_COMPETITIONS.map((competition, index) => [competition.key, index])
)

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

export function createListCompetitionsUseCase({ competitionRepository }) {
  return async function listCompetitions() {
    const competitions = await competitionRepository.listEnabledCompetitions()
    const competitionsByKey = new Map()

    for (const competition of competitions) {
      if (!authorizedCompetitionOrder.has(competition.targetKey)) {
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

    return Array.from(competitionsByKey.values()).sort(
      (left, right) =>
        authorizedCompetitionOrder.get(left.targetKey) -
        authorizedCompetitionOrder.get(right.targetKey)
    )
  }
}
