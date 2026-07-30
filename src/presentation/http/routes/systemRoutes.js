import { Router } from 'express'

export function createSystemRoutes({ systemController }) {
  const router = Router()

  router.get('/system/runs/latest', async (request, response) =>
    systemController.getLatestRun(request, response)
  )

  return router
}
