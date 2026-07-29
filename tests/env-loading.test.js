import dotenv from 'dotenv'
import { jest } from '@jest/globals'

import { bootstrapEnv, loadEnv } from '../src/config/env.js'

describe('environment bootstrap', () => {
  test('loadEnv marks the database as configured when all DB variables are present', () => {
    const env = loadEnv({
      shouldLoadDotenv: false,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        FRONTEND_URL: 'http://localhost:5173',
        LOG_LEVEL: 'info',
        TIMEZONE: 'America/Argentina/Buenos_Aires',
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'pronostia',
        SCHEDULER_ENABLED: 'false',
        SCHEDULER_CRON: '0 6 * * *',
        RATE_LIMIT_WINDOW_MS: '1000',
        RATE_LIMIT_MAX_REQUESTS: '100'
      }
    })

    expect(env.database.configured).toBe(true)
    expect(env.database.host).toBe('localhost')
    expect(env.database.name).toBe('pronostia')
  })

  test('external values keep priority over dotenv-loaded values', () => {
    const targetEnv = {
      NODE_ENV: 'development',
      PORT: '9999',
      FRONTEND_URL: 'http://localhost:9999',
      LOG_LEVEL: 'warn',
      TIMEZONE: 'UTC',
      SCHEDULER_ENABLED: 'false',
      SCHEDULER_CRON: '0 6 * * *',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX_REQUESTS: '100'
    }

    const original = Object.assign({}, targetEnv)
    const originalConfigFn = jest.spyOn(dotenv, 'config')
    originalConfigFn.mockImplementation(({ processEnv }) => {
      processEnv.PORT = processEnv.PORT ?? '3000'
      processEnv.FRONTEND_URL =
        processEnv.FRONTEND_URL ?? 'http://localhost:5173'
      processEnv.LOG_LEVEL = processEnv.LOG_LEVEL ?? 'info'
      processEnv.TIMEZONE =
        processEnv.TIMEZONE ?? 'America/Argentina/Buenos_Aires'
      processEnv.DB_HOST = processEnv.DB_HOST ?? 'localhost'
      processEnv.DB_PORT = processEnv.DB_PORT ?? '3306'
      processEnv.DB_USER = processEnv.DB_USER ?? 'root'
      processEnv.DB_PASSWORD = processEnv.DB_PASSWORD ?? ''
      processEnv.DB_NAME = processEnv.DB_NAME ?? 'pronostia'
      return { parsed: {} }
    })

    const env = loadEnv({
      env: targetEnv,
      shouldLoadDotenv: true
    })

    expect(env.port).toBe(9999)
    expect(env.frontendUrl).toBe('http://localhost:9999')
    expect(env.logLevel).toBe('warn')
    expect(targetEnv.PORT).toBe(original.PORT)
    expect(env.database.host).toBe('localhost')

    originalConfigFn.mockRestore()
  })

  test('bootstrapEnv mutates the provided environment target instead of relying on global process.env', () => {
    const previousDbHost = process.env.DB_HOST
    const previousDbPort = process.env.DB_PORT
    const previousDbUser = process.env.DB_USER
    const previousDbPassword = process.env.DB_PASSWORD
    const previousDbName = process.env.DB_NAME

    const configSpy = jest.spyOn(dotenv, 'config')
    configSpy.mockImplementation(({ processEnv }) => {
      processEnv.DB_HOST = 'localhost'
      processEnv.DB_PORT = '3306'
      processEnv.DB_USER = 'root'
      processEnv.DB_PASSWORD = ''
      processEnv.DB_NAME = 'pronostia'
      return { parsed: {} }
    })

    const targetEnv = {
      NODE_ENV: 'development'
    }

    const result = bootstrapEnv({
      env: targetEnv,
      shouldLoadDotenv: true
    })

    expect(result).toBe(targetEnv)
    expect(targetEnv.DB_HOST).toBe('localhost')
    expect(process.env.DB_HOST).toBe(previousDbHost)
    expect(process.env.DB_PORT).toBe(previousDbPort)
    expect(process.env.DB_USER).toBe(previousDbUser)
    expect(process.env.DB_PASSWORD).toBe(previousDbPassword)
    expect(process.env.DB_NAME).toBe(previousDbName)

    configSpy.mockRestore()
  })

  test('incomplete DB configuration still yields databaseConfigured false', () => {
    const env = loadEnv({
      shouldLoadDotenv: false,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        FRONTEND_URL: 'http://localhost:5173',
        LOG_LEVEL: 'info',
        TIMEZONE: 'America/Argentina/Buenos_Aires',
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: '',
        DB_PASSWORD: '',
        DB_NAME: '',
        SCHEDULER_ENABLED: 'false',
        SCHEDULER_CRON: '0 6 * * *',
        RATE_LIMIT_WINDOW_MS: '1000',
        RATE_LIMIT_MAX_REQUESTS: '100'
      }
    })

    expect(env.database.configured).toBe(false)
  })

  test('invalid OpenAI thresholds are rejected', () => {
    expect(() =>
      loadEnv({
        shouldLoadDotenv: false,
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
          FRONTEND_URL: 'http://localhost:5173',
          LOG_LEVEL: 'info',
          TIMEZONE: 'America/Argentina/Buenos_Aires',
          SCHEDULER_ENABLED: 'false',
          SCHEDULER_CRON: '0 6 * * *',
          RATE_LIMIT_WINDOW_MS: '1000',
          RATE_LIMIT_MAX_REQUESTS: '100',
          OPENAI_MONTHLY_ALERT_PERCENT: '90',
          OPENAI_MONTHLY_DEGRADED_PERCENT: '85'
        }
      })
    ).toThrow('OPENAI_MONTHLY_DEGRADED_PERCENT')
  })

  test('hard limit must not be below degraded threshold', () => {
    expect(() =>
      loadEnv({
        shouldLoadDotenv: false,
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
          FRONTEND_URL: 'http://localhost:5173',
          LOG_LEVEL: 'info',
          TIMEZONE: 'America/Argentina/Buenos_Aires',
          SCHEDULER_ENABLED: 'false',
          SCHEDULER_CRON: '0 6 * * *',
          RATE_LIMIT_WINDOW_MS: '1000',
          RATE_LIMIT_MAX_REQUESTS: '100',
          OPENAI_MONTHLY_ALERT_PERCENT: '70',
          OPENAI_MONTHLY_DEGRADED_PERCENT: '85',
          OPENAI_HARD_LIMIT_PERCENT: '80'
        }
      })
    ).toThrow('OPENAI_HARD_LIMIT_PERCENT')
  })
})
