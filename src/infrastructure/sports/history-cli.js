import { createRuntime } from '../../config/index.js'

function parseArgs(argv) {
  return argv.reduce((accumulator, argument) => {
    if (!argument.startsWith('--')) {
      return accumulator
    }

    const [key, value] = argument.slice(2).split('=')
    accumulator[key] = value ?? 'true'
    return accumulator
  }, {})
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const runtime = createRuntime()

  try {
    const result = await runtime.useCases.importHistoricalSeason({
      competitionKey: args.competition || 'premier-league',
      season: Number(args.season || 2024),
      payloadPath: args.payloadPath || undefined
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await runtime.poolManager.close()
    await runtime.loggerHandle.close()
  }
}

if (process.argv[1]?.endsWith('history-cli.js')) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
