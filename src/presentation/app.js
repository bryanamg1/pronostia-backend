import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { createHealthController } from './http/controllers/healthController.js'
import { createCompetitionsController } from './http/controllers/competitionsController.js'
import { createFixturesController } from './http/controllers/fixturesController.js'
import { createErrorHandler } from './http/middlewares/errorHandler.js'
import { createHttpLogger } from './http/middlewares/httpLogger.js'
import { notFoundHandler } from './http/middlewares/notFoundHandler.js'
import { createRateLimitMiddleware } from './http/middlewares/rateLimit.js'
import { createRequestIdMiddleware } from './http/middlewares/requestIdMiddleware.js'
import { createCompetitionsRoutes } from './http/routes/competitionsRoutes.js'
import { createFixturesRoutes } from './http/routes/fixturesRoutes.js'
import { createHealthRoutes } from './http/routes/healthRoutes.js'
import { createTestRoutes } from './http/routes/testRoutes.js'
import { DEFAULT_JSON_LIMIT } from '../shared/constants/http.js'

export function createApp({
  env,
  logger,
  getHealthStatus,
  getReadinessStatus,
  listCompetitions,
  listTodayFixtures,
  getFixtureById,
  enableTestRoutes = false,
  jsonLimit = DEFAULT_JSON_LIMIT
}) {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: env.frontendUrl,
      optionsSuccessStatus: 204
    })
  )
  app.use(createRequestIdMiddleware())
  app.use(createHttpLogger({ logger }))
  app.use(
    createRateLimitMiddleware({
      windowMs: env.http.rateLimitWindowMs,
      max: env.http.rateLimitMaxRequests
    })
  )
  app.use(express.json({ limit: jsonLimit }))

  const healthController = createHealthController({
    getHealthStatus,
    getReadinessStatus
  })

  app.use('/api', createHealthRoutes({ healthController }))

  if (listCompetitions) {
    const competitionsController = createCompetitionsController({
      listCompetitions
    })

    app.use('/api', createCompetitionsRoutes({ competitionsController }))
  }

  if (listTodayFixtures && getFixtureById) {
    const fixturesController = createFixturesController({
      listTodayFixtures,
      getFixtureById
    })

    app.use('/api', createFixturesRoutes({ fixturesController }))
  }

  if (enableTestRoutes) {
    app.use('/api/test', createTestRoutes())
  }

  app.use(notFoundHandler)
  app.use(
    createErrorHandler({
      environment: env.nodeEnv,
      logger
    })
  )

  return app
}
