import { sanitizeHeaders, sanitizeObject } from '../../shared/utils/sanitize.js'

const SAFE_OPENAI_ERROR_HEADERS = new Set([
  'content-type',
  'date',
  'openai-processing-ms',
  'retry-after',
  'x-request-id'
])

function extractOutputText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.length > 0) {
    return body.output_text
  }

  for (const item of body?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string' && content.text.length > 0) {
        return content.text
      }
    }
  }

  return ''
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    cachedInputTokens: Number(usage.input_tokens_details?.cached_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningTokens: Number(usage.output_tokens_details?.reasoning_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0)
  }
}

function sanitizeOpenAiErrorHeaders(headers = {}) {
  const sanitizedHeaders = sanitizeHeaders(headers)

  return Object.fromEntries(
    Object.entries(sanitizedHeaders).filter(([key]) =>
      SAFE_OPENAI_ERROR_HEADERS.has(key.toLowerCase())
    )
  )
}

export function createOpenAiResponsesClient({
  baseUrl,
  apiKey,
  model,
  timeoutMs,
  logger,
  fetchImpl = fetch
}) {
  return {
    async generateStructuredOutput({ instructions, payload, schema }) {
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
      const url = `${baseUrl.replace(/\/$/, '')}/responses`
      const body = {
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: instructions
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(payload)
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: schema.name,
            description: schema.description,
            schema: schema.schema,
            strict: true
          }
        }
      }

      let response

      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutHandle)
      }

      const responseBody = await response.json()

      if (!response.ok) {
        const error = new Error(
          `OpenAI responses request failed with HTTP ${response.status}`
        )
        error.details = {
          status: response.status,
          headers: sanitizeOpenAiErrorHeaders(response.headers),
          body: sanitizeObject(responseBody)
        }

        logger?.warn?.('OpenAI explanation request failed', {
          metadata: error.details
        })
        throw error
      }

      const outputText = extractOutputText(responseBody)

      if (!outputText) {
        const error = new Error('OpenAI returned an empty structured output')
        error.details = {
          body: sanitizeObject(responseBody)
        }
        throw error
      }

      return {
        id: responseBody.id ?? null,
        model: responseBody.model ?? model,
        output: JSON.parse(outputText),
        usage: normalizeUsage(responseBody.usage)
      }
    }
  }
}
