export function createCompetitionsController({ listCompetitions }) {
  return {
    async getCompetitions(request, response) {
      const competitions = await listCompetitions()

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
