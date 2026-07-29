import { Router } from 'express'

export function createPredictionsRoutes({ predictionsController }) {
  const router = Router()

  router.get('/predictions/today', async (request, response) =>
    predictionsController.getTodayPredictions(request, response)
  )
  router.get('/predictions/top', async (request, response) =>
    predictionsController.getTopPredictions(request, response)
  )
  router.get('/predictions/:id', async (request, response) =>
    predictionsController.getPredictionById(request, response)
  )
  router.post('/admin/odds/manual', async (request, response) =>
    predictionsController.createManualOdds(request, response)
  )

  return router
}
