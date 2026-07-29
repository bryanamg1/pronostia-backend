import { createRuntime } from '../../config/index.js'
import { ValidationError } from '../../shared/errors/AppError.js'

export function parseArgs(argv) {
  return argv.reduce((accumulator, argument) => {
    if (!argument.startsWith('--')) {
      return accumulator
    }

    const [key, value] = argument.slice(2).split('=')
    accumulator[key] = value ?? 'true'
    return accumulator
  }, {})
}

export function readOptionalArg(args, keys, fallback = null) {
  for (const key of keys) {
    if (args[key] !== undefined) {
      return args[key]
    }

    if (process.env[key] !== undefined) {
      return process.env[key]
    }
  }

  return fallback
}

async function main() {
  const argv = process.argv.slice(2)
  const lifecycleEvent = process.env.npm_lifecycle_event || ''
  const command =
    argv.find((argument) => !argument.startsWith('--')) ||
    (lifecycleEvent === 'model:predict' ? 'predict' : 'evaluate')
  const args = parseArgs(argv)
  const runtime = createRuntime()

  try {
    if (command === 'predict') {
      const fixtureId = Number(
        readOptionalArg(
          args,
          ['fixtureId', 'fixtureid', 'npm_config_fixtureid'],
          null
        )
      )

      if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
        throw new ValidationError(
          'model:predict requires a positive integer --fixtureId'
        )
      }

      const result = await runtime.useCases.generateHistoricalPrediction({
        fixtureId
      })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    if (command === 'score') {
      const fixtureId = Number(
        readOptionalArg(
          args,
          ['fixtureId', 'fixtureid', 'npm_config_fixtureid'],
          null
        )
      )

      if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
        throw new ValidationError(
          'model:score requires a positive integer --fixtureId'
        )
      }

      const result = await runtime.useCases.generateScoredPredictions({
        fixtureId
      })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    if (command === 'explain') {
      const predictionId = Number(
        readOptionalArg(
          args,
          ['predictionId', 'predictionid', 'npm_config_predictionid'],
          0
        )
      )
      const force =
        readOptionalArg(args, ['force', 'npm_config_force'], 'false') === 'true'

      if (Number.isInteger(predictionId) && predictionId > 0) {
        const result = await runtime.useCases.explainPrediction({
          predictionId,
          force
        })
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
        return
      }

      const result = await runtime.useCases.explainTodayPredictions()
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return
    }

    const competitionKey = readOptionalArg(
      args,
      ['competition', 'npm_config_competition'],
      'premier-league'
    )
    const season = Number(
      readOptionalArg(args, ['season', 'npm_config_season'], 2024)
    )

    if (!Number.isInteger(season) || season <= 0) {
      throw new ValidationError(
        'model:evaluate requires a positive integer --season'
      )
    }

    const result = await runtime.useCases.evaluateHistoricalModel({
      competitionKey,
      season
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
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
