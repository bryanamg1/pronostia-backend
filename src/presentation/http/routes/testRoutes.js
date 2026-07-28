import { Router } from 'express'

import { ValidationError } from '../../../shared/errors/AppError.js'

export function createTestRoutes() {
  const router = Router()

  router.get('/controlled-error', (request, response, next) => {
    void request
    void response
    next(new ValidationError('Controlled validation failure'))
  })

  router.get('/unexpected-error', () => {
    throw new Error('DB_PASSWORD=secret')
  })

  return router
}
