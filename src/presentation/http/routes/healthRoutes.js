import { Router } from 'express'

export function createHealthRoutes({ healthController }) {
  const router = Router()

  router.get('/health', (request, response) =>
    healthController.getHealth(request, response)
  )
  router.get('/health/ready', async (request, response) =>
    healthController.getReadiness(request, response)
  )

  return router
}
