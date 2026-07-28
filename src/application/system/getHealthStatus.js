import { SERVICE_NAME } from '../../shared/constants/http.js'

export function createGetHealthStatusUseCase({
  environment,
  now = () => new Date()
}) {
  return function getHealthStatus() {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      timestamp: now().toISOString(),
      environment
    }
  }
}
