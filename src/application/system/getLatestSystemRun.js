export function createGetLatestSystemRunUseCase({
  systemRunRepository,
  analysisRunRepository = null
}) {
  return async function getLatestSystemRun() {
    const latestRun = await systemRunRepository.getLatestRun()

    if (!latestRun || !analysisRunRepository?.getLatestRun) {
      return latestRun
    }

    const latestAnalysis = await analysisRunRepository.getLatestRun()

    if (!latestAnalysis) {
      return latestRun
    }

    return {
      ...latestRun,
      analysis: latestAnalysis
    }
  }
}
