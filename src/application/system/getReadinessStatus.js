import { SERVICE_NAME } from '../../shared/constants/http.js'

export function createGetReadinessStatusUseCase({
  environment,
  readinessProbe,
  now = () => new Date()
}) {
  return async function getReadinessStatus() {
    const readiness = await readinessProbe.check()

    return {
      status: readiness.ready ? 'ok' : 'error',
      service: SERVICE_NAME,
      timestamp: now().toISOString(),
      environment,
      checks: readiness.checks
    }
  }
}
