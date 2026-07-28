import { createDependencies } from './dependencies.js'
import { loadEnv } from './env.js'

export function createRuntime(options = {}) {
  const env = loadEnv(options)
  const dependencies = createDependencies({
    env,
    loggerOverride: options.loggerOverride
  })

  return {
    env,
    ...dependencies
  }
}
