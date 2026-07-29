import { createOpenAiResponsesClient } from '../src/infrastructure/openai/createOpenAiResponsesClient.js'
import { createTestLogger } from './helpers/createTestLogger.js'

describe('openai responses client', () => {
  test('parses structured JSON output and usage counters', async () => {
    const client = createOpenAiResponsesClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      model: 'gpt-5-mini',
      timeoutMs: 1000,
      logger: createTestLogger().logger,
      async fetchImpl() {
        return {
          ok: true,
          async json() {
            return {
              id: 'resp_123',
              model: 'gpt-5-mini',
              output_text:
                '{"summary":"ok","supportingFactors":["a"],"counterFactors":["b"],"warnings":["c"],"responsibleUseNotice":"notice"}',
              usage: {
                input_tokens: 100,
                input_tokens_details: {
                  cached_tokens: 25
                },
                output_tokens: 40,
                output_tokens_details: {
                  reasoning_tokens: 5
                },
                total_tokens: 140
              }
            }
          }
        }
      }
    })

    const result = await client.generateStructuredOutput({
      instructions: 'system',
      payload: {
        sample: true
      },
      schema: {
        name: 'schema',
        description: 'desc',
        schema: {
          type: 'object'
        }
      }
    })

    expect(result.output.summary).toBe('ok')
    expect(result.usage.cachedInputTokens).toBe(25)
    expect(result.usage.reasoningTokens).toBe(5)
  })

  test('failed requests are sanitized before surfacing metadata', async () => {
    const { logger, entries } = createTestLogger()
    const client = createOpenAiResponsesClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      model: 'gpt-5-mini',
      timeoutMs: 1000,
      logger,
      async fetchImpl() {
        return {
          ok: false,
          status: 429,
          headers: new Map([
            ['authorization', 'Bearer secret-key'],
            ['x-request-id', 'req_123']
          ]),
          async json() {
            return {
              error: 'api_key=secret-key'
            }
          }
        }
      }
    })

    await expect(
      client.generateStructuredOutput({
        instructions: 'system',
        payload: {},
        schema: {
          name: 'schema',
          description: 'desc',
          schema: {
            type: 'object'
          }
        }
      })
    ).rejects.toThrow('OpenAI responses request failed with HTTP 429')

    expect(JSON.stringify(entries)).not.toContain('secret-key')
  })
})
