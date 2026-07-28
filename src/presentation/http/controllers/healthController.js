export function createHealthController({
  getHealthStatus,
  getReadinessStatus
}) {
  return {
    getHealth(request, response) {
      response.status(200).json({
        success: true,
        data: getHealthStatus(),
        meta: {
          requestId: request.requestId
        }
      })
    },
    async getReadiness(request, response) {
      const readiness = await getReadinessStatus()
      const statusCode = readiness.status === 'ok' ? 200 : 503

      response.status(statusCode).json({
        success: true,
        data: readiness,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
