export function createTestLogger() {
  const entries = []

  const logger = {
    info(message, metadata = {}) {
      entries.push({ level: 'info', message, metadata })
    },
    warn(message, metadata = {}) {
      entries.push({ level: 'warn', message, metadata })
    },
    error(message, metadata = {}) {
      entries.push({ level: 'error', message, metadata })
    },
    http(message, metadata = {}) {
      entries.push({ level: 'http', message, metadata })
    }
  }

  return {
    logger,
    entries
  }
}
