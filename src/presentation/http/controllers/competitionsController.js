export function createCompetitionsController({ listCompetitions }) {
  return {
    async getCompetitions(request, response) {
      const competitions = await listCompetitions({
        type: request.query.type,
        country: request.query.country,
        region: request.query.region,
        availabilityStatus: request.query.availabilityStatus
      })

      response.status(200).json({
        success: true,
        data: competitions,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
