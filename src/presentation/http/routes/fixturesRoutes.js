import { Router } from 'express'

export function createFixturesRoutes({ fixturesController }) {
  const router = Router()

  router.get('/fixtures/today', async (request, response) =>
    fixturesController.getTodayFixtures(request, response)
  )
  router.get('/fixtures/:id', async (request, response) =>
    fixturesController.getFixtureById(request, response)
  )

  return router
}
