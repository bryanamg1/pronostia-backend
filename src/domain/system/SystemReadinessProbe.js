export class SystemReadinessProbe {
  async check() {
    throw new Error('SystemReadinessProbe.check must be implemented')
  }
}
