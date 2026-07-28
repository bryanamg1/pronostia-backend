export function createListCompetitionsUseCase({ competitionRepository }) {
  return async function listCompetitions() {
    return competitionRepository.listEnabledCompetitions()
  }
}
