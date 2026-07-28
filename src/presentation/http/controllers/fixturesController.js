export function createFixturesController({
  listTodayFixtures,
  getFixtureById
}) {
  return {
    async getTodayFixtures(request, response) {
      const fixtures = await listTodayFixtures()

      response.status(200).json({
        success: true,
        data: fixtures,
        meta: {
          requestId: request.requestId
        }
      })
    },

    async getFixtureById(request, response) {
      const fixture = await getFixtureById(request.params.id)

      response.status(200).json({
        success: true,
        data: fixture,
        meta: {
          requestId: request.requestId
        }
      })
    }
  }
}
