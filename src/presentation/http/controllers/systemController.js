export function createSystemController({ getLatestSystemRun }) {
  return {
    async getLatestRun(request, response) {
      const latestRun = await getLatestSystemRun()

      response.status(200).json({
        success: true,
        data: latestRun,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
