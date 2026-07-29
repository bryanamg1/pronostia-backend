import {
  parseArgs,
  readOptionalArg
} from '../src/infrastructure/prediction/cli.js'

describe('prediction cli helpers', () => {
  test('parseArgs extracts key value pairs and bare flags', () => {
    expect(parseArgs(['--predictionId=44', '--force'])).toEqual({
      predictionId: '44',
      force: 'true'
    })
  })

  test('readOptionalArg resolves args first and then process env', () => {
    process.env.TEST_FALLBACK_VALUE = 'from-env'

    expect(
      readOptionalArg(
        {
          direct: 'from-args'
        },
        ['direct', 'TEST_FALLBACK_VALUE'],
        null
      )
    ).toBe('from-args')
    expect(
      readOptionalArg({}, ['MISSING_KEY', 'TEST_FALLBACK_VALUE'], null)
    ).toBe('from-env')

    delete process.env.TEST_FALLBACK_VALUE
  })
})
