export function createGetLatestSystemRunUseCase({ systemRunRepository }) {
  return async function getLatestSystemRun() {
    return systemRunRepository.getLatestRun()
  }
}
