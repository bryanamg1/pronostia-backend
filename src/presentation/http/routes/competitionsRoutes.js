import { Router } from 'express'

export function createCompetitionsRoutes({ competitionsController }) {
  const router = Router()

  router.get('/competitions', async (request, response) =>
    competitionsController.getCompetitions(request, response)
  )

  return router
}
