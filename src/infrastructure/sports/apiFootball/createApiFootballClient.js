import { InfrastructureError } from '../../../shared/errors/AppError.js'
import {
  sanitizeHeaders,
  toErrorLogPayload
} from '../../../shared/utils/sanitize.js'

const MAX_429_RETRIES = 2

export function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (!value) {
    return null
  }

  const numericSeconds = Number(String(value).trim())

  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, numericSeconds * 1000)
  }

  const parsedDate = Date.parse(String(value))
  if (Number.isFinite(parsedDate)) {
    return Math.max(0, parsedDate - nowMs)
  }

  return null
}

function buildUrl(baseUrl, endpoint, params = {}) {
  const url = new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

export function createApiFootballClient({
  baseUrl,
  apiKey,
  minIntervalMs,
  retryAfterFallbackMs,
  softLimitPercent,
  logger,
  fetchImpl = global.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowMs = () => Date.now()
}) {
  let lastRequestStartedAtMs = null
  let nonStatusCallsIssued = 0
  let quota = {
    plan: null,
    current: null,
    limitDay: null
  }

  function getQuotaSnapshot() {
    const conservativeCurrent = Number.isFinite(quota.current)
      ? quota.current + nonStatusCallsIssued
      : null
    const remaining =
      Number.isFinite(conservativeCurrent) && Number.isFinite(quota.limitDay)
        ? quota.limitDay - conservativeCurrent
        : null

    return {
      plan: quota.plan,
      current: quota.current,
      limitDay: quota.limitDay,
      nonStatusCallsIssued,
      conservativeCurrent,
      remaining,
      softLimitPercent
    }
  }

  async function waitForNextSlot() {
    if (lastRequestStartedAtMs === null) {
      return 0
    }

    const waitMs = Math.max(
      0,
      minIntervalMs - (nowMs() - lastRequestStartedAtMs)
    )

    if (waitMs > 0) {
      await sleep(waitMs)
    }

    return waitMs
  }

  function ensureQuotaBudget(endpoint) {
    if (endpoint === 'status') {
      return
    }

    const snapshot = getQuotaSnapshot()
    if (!Number.isFinite(snapshot.limitDay)) {
      return
    }

    if (Number.isFinite(snapshot.remaining) && snapshot.remaining <= 0) {
      throw new InfrastructureError('Sports API daily quota exhausted', {
        provider: 'api-football',
        reason: 'daily_quota_exhausted'
      })
    }

    if (Number.isFinite(snapshot.conservativeCurrent)) {
      const usagePercent =
        (snapshot.conservativeCurrent / snapshot.limitDay) * 100

      if (usagePercent >= softLimitPercent) {
        throw new InfrastructureError('Sports API soft limit reached', {
          provider: 'api-football',
          reason: 'soft_limit_reached',
          limitDay: snapshot.limitDay,
          conservativeCurrent: snapshot.conservativeCurrent
        })
      }
    }
  }

  async function apiGet(endpoint, params = {}, context = {}) {
    ensureQuotaBudget(endpoint)

    let attempts = 0

    while (attempts <= MAX_429_RETRIES) {
      const waitedBeforeCallMs = await waitForNextSlot()
      const url = buildUrl(baseUrl, endpoint, params)
      const startedAtMs = nowMs()
      const intervalSincePreviousMs =
        lastRequestStartedAtMs === null
          ? null
          : startedAtMs - lastRequestStartedAtMs

      lastRequestStartedAtMs = startedAtMs

      const response = await fetchImpl(url, {
        headers: {
          'x-apisports-key': apiKey
        }
      })
      const durationMs = nowMs() - startedAtMs
      const responseText = await response.text()
      const responseHeaders = sanitizeHeaders(response.headers)

      let data = null

      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          throw new InfrastructureError('Sports API returned a non-JSON body', {
            provider: 'api-football',
            endpoint,
            status: response.status
          })
        }
      }

      logger.info('Sports API request completed', {
        provider: 'api-football',
        endpoint,
        context: context.step || null,
        status: response.status,
        durationMs,
        attempts: attempts + 1,
        waitedBeforeCallMs,
        intervalSincePreviousMs,
        responseHeaders
      })

      if (response.status === 429) {
        const retryAfterMs =
          parseRetryAfterMs(response.headers.get('retry-after'), nowMs()) ??
          retryAfterFallbackMs

        attempts += 1

        if (attempts > MAX_429_RETRIES) {
          throw new InfrastructureError('Sports API rate limit persisted', {
            provider: 'api-football',
            endpoint,
            reason: 'rate_limited',
            retryAfterMs
          })
        }

        await sleep(retryAfterMs)
        continue
      }

      if (!response.ok) {
        throw new InfrastructureError('Sports API request failed', {
          provider: 'api-football',
          endpoint,
          status: response.status
        })
      }

      if (endpoint === 'status') {
        const providerResponse = data?.response || {}
        quota = {
          plan: providerResponse.subscription?.plan || null,
          current: Number.isFinite(Number(providerResponse.requests?.current))
            ? Number(providerResponse.requests.current)
            : null,
          limitDay: Number.isFinite(
            Number(providerResponse.requests?.limit_day)
          )
            ? Number(providerResponse.requests.limit_day)
            : null
        }
      } else {
        nonStatusCallsIssued += 1
      }

      return {
        url: url.toString(),
        data,
        responseHeaders
      }
    }

    throw new InfrastructureError('Sports API request aborted unexpectedly', {
      provider: 'api-football',
      endpoint
    })
  }

  return {
    async getStatus() {
      return apiGet('status', {}, { step: 'status' })
    },

    async getLeague({ providerId, season }) {
      return apiGet(
        'leagues',
        {
          id: providerId,
          season
        },
        {
          step: `competition:${providerId}`
        }
      )
    },

    async getFixturesByDate({ date, timezone }) {
      return apiGet(
        'fixtures',
        {
          date,
          timezone
        },
        {
          step: `fixtures:${date}`
        }
      )
    },

    async getHistoricalFixturesPage({ leagueId, season, timezone, page }) {
      return apiGet(
        'fixtures',
        {
          league: leagueId,
          season,
          status: 'FT-AET-PEN',
          timezone,
          page
        },
        {
          step: `history:${leagueId}:${season}:${page}`
        }
      )
    },

    async getOddsByDateRange({
      fromDate,
      toDate,
      timezone,
      leagueId,
      season,
      page = 1
    }) {
      return apiGet(
        'odds',
        {
          date: fromDate,
          timezone,
          league: leagueId,
          season,
          page
        },
        {
          step: `odds:${leagueId ?? 'global'}:${fromDate}:${page}`
        }
      )
    },

    getQuotaSnapshot,

    toErrorPayload(error) {
      return toErrorLogPayload(error)
    }
  }
}
