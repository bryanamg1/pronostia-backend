import { readFileSync } from 'node:fs'

describe('layer boundaries', () => {
  test('domain and application layers respect dependency direction', () => {
    const domainFile = readFileSync(
      new URL('../src/domain/system/SystemRun.js', import.meta.url),
      'utf8'
    )
    const applicationFile = readFileSync(
      new URL(
        '../src/application/system/runScheduledSystemCheck.js',
        import.meta.url
      ),
      'utf8'
    )

    expect(domainFile).not.toMatch(/infrastructure|presentation/)
    expect(applicationFile).not.toMatch(/presentation/)
  })

  test('prediction domain remains free from infrastructure and presentation imports', () => {
    const predictionDomainFile = readFileSync(
      new URL(
        '../src/domain/prediction/services/deterministicPredictionModel.js',
        import.meta.url
      ),
      'utf8'
    )

    expect(predictionDomainFile).not.toMatch(/infrastructure|presentation/)
  })
})
