import { createRuntime } from '../../config/index.js'

async function main() {
  const runtime = createRuntime()

  try {
    const result = await runtime.useCases.syncSportsData({
      trigger: 'cli'
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
