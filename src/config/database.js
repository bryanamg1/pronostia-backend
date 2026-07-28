import { SystemReadinessProbe } from '../domain/system/SystemReadinessProbe.js'

export class MySqlReadinessProbe extends SystemReadinessProbe {
  constructor(poolManager) {
    super()
    this.poolManager = poolManager
  }

  async check() {
    return this.poolManager.ping()
  }
}
