import winston from 'winston'

import {
  sanitizeHeaders,
  sanitizeObject,
  toErrorLogPayload
} from '../../shared/utils/sanitize.js'

export function createLogger(env, overrides = {}) {
  const logger = overrides.logger
    ? overrides.logger
    : winston.createLogger({
        level: env.logLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf((info) =>
            JSON.stringify({
              timestamp: info.timestamp,
              level: info.level,
              message: info.message,
              environment: env.nodeEnv,
              requestId: info.requestId,
              runId: info.runId,
              ...sanitizeObject(info.metadata ?? {})
            })
          )
        ),
        transports: [new winston.transports.Console()]
      })

  return {
    logger: {
      info(message, metadata = {}) {
        logger.info(message, { metadata })
      },
      warn(message, metadata = {}) {
        logger.warn(message, { metadata })
      },
      error(message, metadata = {}) {
        const safeMetadata = metadata.error
          ? {
              ...metadata,
              error: toErrorLogPayload(metadata.error)
            }
          : metadata

        logger.error(message, { metadata: safeMetadata })
      },
      http(message, metadata = {}) {
        logger.http(message, {
          metadata: {
            ...metadata,
            headers: metadata.headers
              ? sanitizeHeaders(metadata.headers)
              : undefined
          }
        })
      }
    },
    async close() {
      if (typeof logger.end === 'function') {
        logger.end()
      }
    }
  }
}
