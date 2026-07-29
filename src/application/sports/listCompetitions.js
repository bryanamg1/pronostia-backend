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
      competitionsByKey.set(
        competition.targetKey,
        pickPreferredCompetition(
          competitionsByKey.get(competition.targetKey),
          competition
        )
      )
    }

    return Array.from(competitionsByKey.values())
  }
}
