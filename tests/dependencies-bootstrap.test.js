import { jest } from '@jest/globals'

import { loadEnv } from '../src/config/env.js'
import { createTestLogger } from './helpers/createTestLogger.js'

const createFixturePublicViewServiceMock = jest.fn()
const createListTodayFixturesUseCaseMock = jest.fn()
const createGetFixtureByIdUseCaseMock = jest.fn()
const createMySqlPoolManagerMock = jest.fn()
const createSchedulerMock = jest.fn()
const createApiFootballClientMock = jest.fn()
const createOpenAiResponsesClientMock = jest.fn()

jest.unstable_mockModule(
  '../src/application/sports/services/fixturePublicView.js',
  () => ({
    createFixturePublicViewService: createFixturePublicViewServiceMock
  })
)
jest.unstable_mockModule(
  '../src/application/sports/listTodayFixtures.js',
  () => ({
    createListTodayFixturesUseCase: createListTodayFixturesUseCaseMock
  })
)
jest.unstable_mockModule('../src/application/sports/getFixtureById.js', () => ({
  createGetFixtureByIdUseCase: createGetFixtureByIdUseCaseMock
}))
jest.unstable_mockModule(
  '../src/infrastructure/database/mysql/createMySqlPoolManager.js',
  () => ({
    createMySqlPoolManager: createMySqlPoolManagerMock
  })
)
jest.unstable_mockModule(
  '../src/infrastructure/scheduler/createScheduler.js',
  () => ({
    createScheduler: createSchedulerMock
  })
)
jest.unstable_mockModule(
  '../src/infrastructure/sports/apiFootball/createApiFootballClient.js',
  () => ({
    createApiFootballClient: createApiFootballClientMock
  })
)
jest.unstable_mockModule(
  '../src/infrastructure/openai/createOpenAiResponsesClient.js',
  () => ({
    createOpenAiResponsesClient: createOpenAiResponsesClientMock
  })
)

const { createDependencies } = await import('../src/config/dependencies.js')

function buildEnv() {
  return loadEnv({
    shouldLoadDotenv: false,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      FRONTEND_URL: 'http://localhost:5173',
      LOG_LEVEL: 'info',
      TIMEZONE: 'America/Argentina/Buenos_Aires',
      SCHEDULER_ENABLED: 'false',
      SCHEDULER_CRON: '0 6 * * *',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX_REQUESTS: '100'
    }
  })
}

describe('real dependency bootstrap composition', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('createDependencies composes Phase 6 public use cases without opening MySQL or external clients', async () => {
    const fixturePublicViewService = {
      toPublicFixture: jest.fn()
    }
    const listTodayFixturesUseCase = jest.fn()
    const getFixtureByIdUseCase = jest.fn()
    const scheduler = {
      start: jest.fn(),
      stop: jest.fn(),
      isStarted: jest.fn(() => false)
    }
    const poolManager = {
      hasConfig: jest.fn(() => false),
      getPool: jest.fn(() => {
        throw new Error('getPool should not be called during bootstrap')
      }),
      ping: jest.fn(async () => ({
        ready: true,
        checks: {
          database: {
            status: 'not_configured'
          }
        }
      })),
      close: jest.fn(async () => false)
    }
    const { logger } = createTestLogger()

    createFixturePublicViewServiceMock.mockReturnValue(fixturePublicViewService)
    createListTodayFixturesUseCaseMock.mockReturnValue(listTodayFixturesUseCase)
    createGetFixtureByIdUseCaseMock.mockReturnValue(getFixtureByIdUseCase)
    createMySqlPoolManagerMock.mockReturnValue(poolManager)
    createSchedulerMock.mockReturnValue(scheduler)

    const dependencies = createDependencies({
      env: buildEnv(),
      loggerOverride: logger
    })

    expect(createFixturePublicViewServiceMock).toHaveBeenCalledTimes(1)
    expect(createListTodayFixturesUseCaseMock).toHaveBeenCalledTimes(1)
    expect(createGetFixtureByIdUseCaseMock).toHaveBeenCalledTimes(1)
    expect(
      createListTodayFixturesUseCaseMock.mock.calls[0][0]
        .fixturePublicViewService
    ).toBe(fixturePublicViewService)
    expect(
      createGetFixtureByIdUseCaseMock.mock.calls[0][0].fixturePublicViewService
    ).toBe(fixturePublicViewService)
    expect(
      createListTodayFixturesUseCaseMock.mock.calls[0][0]
        .fixturePublicViewService
    ).toBe(
      createGetFixtureByIdUseCaseMock.mock.calls[0][0].fixturePublicViewService
    )
    expect(dependencies.useCases.listCompetitions).toEqual(expect.any(Function))
    expect(dependencies.useCases.listTodayFixtures).toBe(
      listTodayFixturesUseCase
    )
    expect(dependencies.useCases.getFixtureById).toBe(getFixtureByIdUseCase)
    expect(dependencies.useCases.listTodayPredictions).toEqual(
      expect.any(Function)
    )
    expect(dependencies.useCases.listTopPredictions).toEqual(
      expect.any(Function)
    )
    expect(dependencies.useCases.getPredictionById).toEqual(
      expect.any(Function)
    )
    expect(dependencies.scheduler).toBe(scheduler)
    expect(dependencies.scheduler.isStarted()).toBe(false)
    expect(scheduler.start).not.toHaveBeenCalled()
    expect(createApiFootballClientMock).not.toHaveBeenCalled()
    expect(createOpenAiResponsesClientMock).not.toHaveBeenCalled()
    expect(poolManager.getPool).not.toHaveBeenCalled()
    expect(poolManager.ping).not.toHaveBeenCalled()

    await expect(dependencies.poolManager.close()).resolves.toBe(false)
  })

  test('createDependencies fails fast when fixturePublicViewService misses its contract', () => {
    const { logger } = createTestLogger()

    createFixturePublicViewServiceMock.mockReturnValue(undefined)
    createListTodayFixturesUseCaseMock.mockImplementation(() => {
      throw new Error('listTodayFixtures should not be created')
    })
    createGetFixtureByIdUseCaseMock.mockImplementation(() => {
      throw new Error('getFixtureById should not be created')
    })
    createMySqlPoolManagerMock.mockReturnValue({
      hasConfig: () => false,
      getPool: jest.fn(),
      ping: jest.fn(),
      close: jest.fn(async () => false)
    })
    createSchedulerMock.mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      isStarted: jest.fn(() => false)
    })

    expect(() =>
      createDependencies({
        env: buildEnv(),
        loggerOverride: logger
      })
    ).toThrow(
      'Invalid dependency composition: fixturePublicViewService must implement toPublicFixture'
    )
    expect(createListTodayFixturesUseCaseMock).not.toHaveBeenCalled()
    expect(createGetFixtureByIdUseCaseMock).not.toHaveBeenCalled()
    expect(createApiFootballClientMock).not.toHaveBeenCalled()
    expect(createOpenAiResponsesClientMock).not.toHaveBeenCalled()
  })
})
