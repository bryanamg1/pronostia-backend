import { createRuntime } from '../../config/index.js'
import { createApp } from '../../presentation/app.js'
import request from 'supertest'

async function verifyPublicEndpoints(runtime, pilotResult) {
  const app = createApp({
    env: runtime.env,
    logger: runtime.logger,
    ...runtime.useCases
  })
  const firstPredictionId =
    pilotResult.predictionResults?.find((result) => result.status === 'ok')
      ?.predictions?.[0]?.id || null
  const competitionsResponse = await request(app).get('/api/competitions')
  const fixturesResponse = await request(app).get('/api/fixtures/today')
  const todayPredictionsResponse = await request(app).get(
    '/api/predictions/today'
  )
  const topPredictionsResponse = await request(app).get('/api/predictions/top')
  const systemRunResponse = await request(app).get('/api/system/runs/latest')
  let detailResponse = null

  if (firstPredictionId) {
    detailResponse = await request(app).get(
      `/api/predictions/${firstPredictionId}`
    )
  }

  return {
    competitions: {
      status: competitionsResponse.status,
      count: Array.isArray(competitionsResponse.body?.data)
        ? competitionsResponse.body.data.length
        : 0
    },
    fixturesToday: {
      status: fixturesResponse.status,
      count: Array.isArray(fixturesResponse.body?.data)
        ? fixturesResponse.body.data.length
        : 0
    },
    predictionsToday: {
      status: todayPredictionsResponse.status,
      count: Array.isArray(todayPredictionsResponse.body?.data)
        ? todayPredictionsResponse.body.data.length
        : 0
    },
    predictionsTop: {
      status: topPredictionsResponse.status,
      count: Array.isArray(topPredictionsResponse.body?.data)
        ? topPredictionsResponse.body.data.length
        : 0
    },
    predictionDetail: detailResponse
      ? {
          status: detailResponse.status,
          predictionId: detailResponse.body?.data?.id || null
        }
      : null,
    latestSystemRun: {
      status: systemRunResponse.status,
      runId: systemRunResponse.body?.data?.runId || null,
      runStatus: systemRunResponse.body?.data?.status || null,
      analysisStatus: systemRunResponse.body?.data?.analysis?.status || null,
      fixturesProcessed:
        systemRunResponse.body?.data?.analysis?.fixturesProcessed ?? null,
      apiCalls: systemRunResponse.body?.data?.analysis?.apiCalls ?? null
    }
  }
}

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => {
        const [key, value] = argument.slice(2).split('=')
        return [key, value ?? 'true']
      })
  )
  const mode = args.mode || 'dry-run'
  const runtime = createRuntime()

  try {
    const result = await runtime.useCases.runCurrentPredictionPilot({
      mode,
      trigger: 'cli'
    })
    const output = {
      ...result
    }

    if (
      mode === 'persist' &&
      result.status !== 'PILOT_DATABASE_NOT_SAFE' &&
      result.status !== 'API_FOOTBALL_PRO_NOT_ACTIVE'
    ) {
      output.endpointVerification = await verifyPublicEndpoints(runtime, result)
    }

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  } finally {
    await runtime.poolManager.close()
    await runtime.loggerHandle.close()
  }
}

if (process.argv[1]?.endsWith('cli.js')) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
