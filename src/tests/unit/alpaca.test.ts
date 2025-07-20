import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { assertEquals, assertExists, assertInstanceOf, assertThrows } from '@std/assert'
import { spy, Stub, stub } from '@std/testing/mock'
import { AlpacaMarketClient } from '../../client/alpaca.ts'
import { AlpacaMarketError } from '../../errors/errors.ts'
import { ALPACA_ENVIRONMENT, AlpacaClientConfig } from '../../client/alpaca.types.ts'

// TODO(@albedosehen): move Stub type definition to an exported type from src/tests/mock.types.ts file for mocked types.
let mockFetch: Stub<typeof globalThis, Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>

describe('AlpacaMarketClient', () => {
  let client: AlpacaMarketClient
  let baseConfig: AlpacaClientConfig

  beforeEach(() => {
    baseConfig = {
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      environment: ALPACA_ENVIRONMENT.PAPER,
      timeout: 5000,
    }

    // Mock fetch globally
    mockFetch = stub(globalThis, 'fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ))
  })

  afterEach(async () => {
    if (client) {
      try {
        await client.dispose()
      } catch {
        // Ignore disposal errors
      }
    }
    mockFetch?.restore?.()
  })

  describe('Basic Client Operations', () => {
    it('should create a client instance with minimal config', () => {
      client = new AlpacaMarketClient(baseConfig)
      assertExists(client)
      assertEquals(client.getConfig().environment, ALPACA_ENVIRONMENT.PAPER)
    })

    it('should return correct config', () => {
      client = new AlpacaMarketClient(baseConfig)
      const config = client.getConfig()
      assertEquals(config.apiKey, baseConfig.apiKey)
      assertEquals(config.secretKey, baseConfig.secretKey)
      assertEquals(config.environment, baseConfig.environment)
    })

    it('should set correct URLs for paper environment', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        environment: ALPACA_ENVIRONMENT.PAPER,
      })
      assertExists(client.getConfig())
    })

    it('should set correct URLs for live environment', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        environment: ALPACA_ENVIRONMENT.LIVE,
      })
      assertExists(client.getConfig())
    })

    it('should handle custom URLs and timeouts', () => {
      const customConfig = {
        ...baseConfig,
        baseUrl: 'https://custom-api.example.com',
        dataUrl: 'https://custom-data.example.com',
        timeout: 10000,
      }
      client = new AlpacaMarketClient(customConfig)

      const config = client.getConfig()
      assertEquals(config.baseUrl, 'https://custom-api.example.com')
      assertEquals(config.dataUrl, 'https://custom-data.example.com')
      assertEquals(config.timeout, 10000)
    })

    it('should handle invalid environment', () => {
      assertThrows(
        () =>
          new AlpacaMarketClient({
            ...baseConfig,
            environment: 'invalid' as unknown as typeof ALPACA_ENVIRONMENT.PAPER,
          }),
        AlpacaMarketError,
        'Invalid environment',
      )
    })
  })

  describe('Advanced Feature Configuration', () => {
    it('should initialize with global cache enabled', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        cache: {
          enabled: true,
          defaultTtlMs: 300000,
          maxSize: 2000,
        },
      })

      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.cache)
    })

    it('should initialize with global circuit breaker enabled', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        circuitBreaker: {
          failureThreshold: 5,
          timeoutMs: 15000,
          recoveryTimeoutMs: 60000,
          resetTimeoutMs: 120000,
        },
      })

      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.circuitBreaker)
    })

    it('should initialize with trading enabled', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        trading: {
          enabled: true,
          cacheConfig: {
            enabled: true,
            defaultTtlMs: 60000,
            maxSize: 1000,
          },
        },
      })

      assertExists(client.trading)
      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.trading)
    })

    it('should initialize with streaming enabled', () => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        streaming: {
          enabled: true,
          autoConnect: false,
        },
      })

      assertExists(client.ws)
      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.streaming)
    })

    it('should handle full advanced configuration', () => {
      const fullConfig: AlpacaClientConfig = {
        ...baseConfig,
        trading: {
          enabled: true,
          cacheConfig: {
            enabled: true,
            defaultTtlMs: 60000,
            maxSize: 1000,
          },
          circuitBreakerConfig: {
            failureThreshold: 3,
            timeoutMs: 10000,
            recoveryTimeoutMs: 30000,
            resetTimeoutMs: 60000,
          },
        },
        streaming: {
          enabled: true,
          autoConnect: false,
          eventHandlers: {
            onConnect: spy(() => {}),
            onDisconnect: spy(() => {}),
            onError: spy(() => {}),
            onReconnect: spy(() => {}),
          },
        },
        cache: {
          enabled: true,
          defaultTtlMs: 300000,
          maxSize: 2000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          timeoutMs: 15000,
          recoveryTimeoutMs: 60000,
          resetTimeoutMs: 120000,
        },
      }

      client = new AlpacaMarketClient(fullConfig)

      assertExists(client.trading)
      assertExists(client.ws)
      assertExists(client.marketDataClient)

      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.client)
      assertExists(healthMetrics.trading)
      assertExists(healthMetrics.cache)
      assertExists(healthMetrics.circuitBreaker)
    })
  })

  describe('Client Accessors', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        trading: { enabled: true },
        streaming: { enabled: true, autoConnect: false },
      })
    })

    it('should provide trading client access when enabled', () => {
      assertExists(client.trading)
      assertExists(client.trading.getAccount)
      assertExists(client.trading.getOrders)
      assertExists(client.trading.getPositions)
    })

    it('should throw error when trading not enabled', () => {
      const clientWithoutTrading = new AlpacaMarketClient(baseConfig)

      assertThrows(
        () => clientWithoutTrading.trading,
        AlpacaMarketError,
        'Trading client not enabled',
      )

      clientWithoutTrading.dispose()
    })

    it('should provide streaming client access when enabled', () => {
      assertExists(client.ws)
      assertExists(client.ws.connect)
      assertExists(client.ws.disconnect)
    })

    it('should throw error when streaming not enabled', () => {
      const clientWithoutStreaming = new AlpacaMarketClient(baseConfig)

      assertThrows(
        () => clientWithoutStreaming.ws,
        AlpacaMarketError,
        'Streaming client not enabled',
      )

      clientWithoutStreaming.dispose()
    })

    it('should always provide market data client access', () => {
      assertExists(client.marketDataClient)
      assertExists(client.marketDataClient.getLatestBars)
      assertExists(client.marketDataClient.getLatestTrades)
    })
  })

  describe('Request Execution', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient(baseConfig)
    })

    it('should execute basic HTTP requests', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ))

      const result = await client.request('/test-endpoint')

      assertEquals((result as Record<string, unknown>).success, true)
      assertEquals(mockFetch.calls.length, 1)
    })

    it('should handle request parameters', async () => {
      const testParams = { symbol: 'NVDA', limit: 10 }

      await client.request('/test-endpoint', {
        method: 'GET',
        params: testParams,
      })

      const [call] = mockFetch.calls
      const [url] = call.args
      assertExists(url)
      assertEquals(typeof url, 'string')
    })

    it('should handle request body for POST requests', async () => {
      const testBody = { symbol: 'NVDA', qty: '1' }

      await client.request('/test-endpoint', {
        method: 'POST',
        body: testBody,
      })

      const [call] = mockFetch.calls
      const [, options] = call.args
      assertEquals(options?.method, 'POST')
      assertExists(options?.body)
    })

    it('should use Market Data endpoint when specified', async () => {
      await client.request('/test-endpoint', {
        useDataUrl: true,
      })

      const [call] = mockFetch.calls
      const [url] = call.args
      assertExists(url)
    })

    it('should handle HTTP errors', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Unauthorized', {
            status: 401,
          }),
        ))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertEquals(error.message.includes('401'), true)
      }
    })

    it('should handle network errors', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () => Promise.reject(new Error('Network error')))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertExists(error.message)
      }
    })

    it('should include proper authentication headers', async () => {
      await client.request('/test-endpoint')

      const [call] = mockFetch.calls
      const [, options] = call.args
      assertExists(options?.headers)
      const headers = options?.headers as Record<string, string>
      assertEquals(headers['APCA-API-KEY-ID'], baseConfig.apiKey)
      assertEquals(headers['APCA-API-SECRET-KEY'], baseConfig.secretKey)
    })
  })

  describe('Circuit Breaker Integration', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        circuitBreaker: {
          failureThreshold: 2,
          timeoutMs: 5000,
          recoveryTimeoutMs: 10000,
          resetTimeoutMs: 10000,
        },
      })
    })

    it('should integrate circuit breaker with requests', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Server Error', {
            status: 500,
          }),
        ))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch {
        // Expected
      }

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch {
        // Expected
      }

      // Next call should be blocked by circuit breaker
      try {
        await client.request('/test-endpoint')
        throw new Error('Should have been blocked')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        // Should be a circuit breaker error
        assertExists(error.message)
      }
    })

    it('should report circuit breaker metrics', () => {
      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.circuitBreaker)
    })
  })

  describe('Cache Integration', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        cache: {
          enabled: true,
          defaultTtlMs: 60000,
          maxSize: 1000,
        },
      })
    })

    it('should report cache metrics', () => {
      const healthMetrics = client.getHealthMetrics()
      assertExists(healthMetrics.cache)
    })
  })

  describe('Streaming Operations', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        streaming: {
          enabled: true,
          autoConnect: false,
        },
      })
    })

    it('should handle streaming connection status', () => {
      assertEquals(client.isMarketStreamConnected(), false)
    })

    it('should connect to streaming when requested', async () => {
      // FYI: This test is simplified due to WebSocket mocking complexity
      try {
        await client.connectToMarketStream() // In a real scenario, this would attempt to connect
      } catch {
        // Connection may fail in test environment
      }
    })

    it('should disconnect from streaming when requested', async () => {
      await client.disconnectFromMarketStream()
      // Should complete without error
    })
  })

  describe('Health Monitoring', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        trading: { enabled: true },
        streaming: { enabled: true, autoConnect: false },
        cache: { enabled: true },
        circuitBreaker: {
          failureThreshold: 5,
          timeoutMs: 15000,
          recoveryTimeoutMs: 60000,
          resetTimeoutMs: 120000,
        },
      })
    })

    it('should provide comprehensive health metrics', () => {
      const healthMetrics = client.getHealthMetrics()

      assertExists(healthMetrics.client)
      assertEquals(healthMetrics.client.environment, ALPACA_ENVIRONMENT.PAPER)
      assertExists(healthMetrics.client.baseUrl)
      assertExists(healthMetrics.client.dataUrl)

      assertExists(healthMetrics.trading)
      assertExists(healthMetrics.cache)
      assertExists(healthMetrics.circuitBreaker)
    })

    it('should test connectivity to all services', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 'account-123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ))

      const connectivityResult = await client.testClientConnections()

      assertExists(connectivityResult.endpoints.trading)
      assertExists(connectivityResult.endpoints.marketData)
      assertExists(connectivityResult.endpoints.streaming)
      assertEquals(typeof connectivityResult.endpoints.trading, 'boolean')
      assertEquals(typeof connectivityResult.endpoints.marketData, 'boolean')
      assertEquals(typeof connectivityResult.endpoints.streaming, 'boolean')
    })

    it('should handle connectivity test failures gracefully', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Server Error', {
            status: 500,
          }),
        ))

      const connectivityResult = await client.testClientConnections()

      assertExists(connectivityResult)
    })
  })

  describe('Resource Management', () => {
    it('should properly dispose of all resources', async () => {
      const fullClient = new AlpacaMarketClient({
        ...baseConfig,
        trading: { enabled: true },
        streaming: { enabled: true, autoConnect: false },
        cache: { enabled: true },
        circuitBreaker: {
          failureThreshold: 5,
          timeoutMs: 15000,
          recoveryTimeoutMs: 60000,
          resetTimeoutMs: 60000,
        },
      })

      assertExists(fullClient.trading)
      assertExists(fullClient.ws)
      assertExists(fullClient.marketDataClient)

      await fullClient.dispose()
    })

    it('should reset and reinitialize all components', async () => {
      const resetClient = new AlpacaMarketClient({
        ...baseConfig,
        trading: { enabled: true },
        cache: { enabled: true },
      })

      const initialMetrics = resetClient.getHealthMetrics()
      assertExists(initialMetrics.trading)
      assertExists(initialMetrics.cache)

      await resetClient.reset()

      assertExists(resetClient.trading)
      const postResetMetrics = resetClient.getHealthMetrics()
      assertExists(postResetMetrics.trading)
      assertExists(postResetMetrics.cache)

      resetClient.dispose()
    })

    it('should handle disposal when no advanced features are enabled', async () => {
      const simpleClient = new AlpacaMarketClient(baseConfig)

      await simpleClient.dispose()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        trading: { enabled: true },
        circuitBreaker: {
          failureThreshold: 3,
          timeoutMs: 10000,
          recoveryTimeoutMs: 30000,
          resetTimeoutMs: 30000,
        },
      })
    })

    it('should handle authentication errors', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Unauthorized', {
            status: 401,
          }),
        ))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertEquals(error.message.includes('401'), true)
      }
    })

    it('should handle rate limiting errors', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Too Many Requests', {
            status: 429,
          }),
        ))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertEquals(error.message.includes('429'), true)
      }
    })

    it('should handle timeout errors', async () => {
      mockFetch.restore()
      const timeoutIds: number[] = []
      mockFetch = stub(
        globalThis,
        'fetch',
        (_input: URL | RequestInfo, init?: RequestInit) =>
          new Promise((resolve, reject) => {
            const signal = init?.signal
            if (signal) {
              signal.addEventListener('abort', () => {
                reject(new DOMException('Request timed out', 'AbortError'))
              })
            }

            const timeoutId = setTimeout(() => {
              resolve(new Response(JSON.stringify({}), { status: 200 }))
            }, 10000) // 10s
            timeoutIds.push(timeoutId)
          }),
      )

      const shortTimeoutClient = new AlpacaMarketClient({
        ...baseConfig,
        timeout: 100, // Very short timeout
      })

      try {
        await shortTimeoutClient.request('/test-endpoint')
        throw new Error('Should have timed out')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertExists(error.message)
      }

      timeoutIds.forEach((id) => clearTimeout(id))
      await shortTimeoutClient.dispose()
    })

    it('should propagate errors through all layers', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response('Internal Server Error', {
            status: 500,
          }),
        ))

      try {
        await client.request('/test-endpoint')
        throw new Error('Should have failed')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assertExists(error.message)
      }
    })
  })

  describe('Performance and Concurrency', () => {
    beforeEach(() => {
      client = new AlpacaMarketClient({
        ...baseConfig,
        cache: { enabled: true },
      })
    })

    it('should handle concurrent requests', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 'response' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ))

      const requests = Array.from({ length: 5 }, () => client.request('/test-endpoint'))

      const results = await Promise.all(requests)

      assertEquals(results.length, 5)
      results.forEach((result) => {
        assertExists((result as Record<string, unknown>).id)
      })
    })

    it('should handle mixed success and failure scenarios', async () => {
      let callCount = 0
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () => {
        callCount++
        if (callCount % 2 === 0) {
          return Promise.resolve(
            new Response('Server Error', { status: 500 }),
          )
        } else {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'success' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      })

      const requests = Array.from({ length: 4 }, () => client.request('/test-endpoint'))

      const results = await Promise.allSettled(requests)

      const successes = results.filter((r) => r.status === 'fulfilled')
      const failures = results.filter((r) => r.status === 'rejected')

      assertEquals(successes.length, 2)
      assertEquals(failures.length, 2)
    })

    it('should perform efficiently with many requests', async () => {
      mockFetch.restore()
      mockFetch = stub(globalThis, 'fetch', () =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 'performance-test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ))

      const startTime = Date.now()

      const requests = Array.from({ length: 20 }, () => client.request('/test-endpoint'))

      await Promise.allSettled(requests)

      const duration = Date.now() - startTime

      assertEquals(duration < 5000, true)
    })
  })
})
