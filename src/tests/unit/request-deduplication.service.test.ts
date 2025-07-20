import { assert, assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { assertSpyCalls, restore, spy } from '@std/testing/mock'
import {
  DEFAULT_REQUEST_DEDUPLICATION_CONFIG,
  type RequestDeduplicationConfig,
  RequestDeduplicator,
  RequestDeduplicatorFactory,
} from '../../services/request-deduplication.service.ts'
import { AlpacaMarketError } from '../../errors/errors.ts'

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator
  let config: RequestDeduplicationConfig

  beforeEach(() => {
    config = {
      enabled: true,
      maxPendingRequests: 5,
      timeoutMs: 1000,
    }

    deduplicator = new RequestDeduplicator(config)
  })

  afterEach(() => {
    deduplicator.clear()
    restore()
  })

  describe('Basic Deduplication', () => {
    it('should execute request only once for duplicate keys', async () => {
      let callCount = 0
      const mockRequest = spy(() => {
        callCount++
        return Promise.resolve(`result-${callCount}`)
      })

      const key = 'test-request'

      // Execute same request multiple times simultaneously
      const promises = [
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
      ]
      const results = await Promise.allSettled(promises)

      // Should have only called once
      assertSpyCalls(mockRequest, 1)
      assertEquals(callCount, 1)

      // All results should be the same
      assertEquals((results[0] as PromiseFulfilledResult<string>).value, 'result-1')
      assertEquals((results[1] as PromiseFulfilledResult<string>).value, 'result-1')
      assertEquals((results[2] as PromiseFulfilledResult<string>).value, 'result-1')
    })

    it('should execute different requests separately', async () => {
      const mockRequest1 = spy(() => Promise.resolve('result-1'))
      const mockRequest2 = spy(() => Promise.resolve('result-2'))

      const result1 = await deduplicator.deduplicate('key-1', mockRequest1)
      const result2 = await deduplicator.deduplicate('key-2', mockRequest2)

      assertEquals(result1, 'result-1')
      assertEquals(result2, 'result-2')

      assertSpyCalls(mockRequest1, 1)
      assertSpyCalls(mockRequest2, 1)
    })

    it('should handle request errors correctly', async () => {
      const error = new Error('Request failed')
      const mockRequest = spy(() => Promise.reject(error))

      const key = 'error-request'

      const promises = [
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
      ]

      const results = await Promise.allSettled(promises)

      // Should have only called once
      assertSpyCalls(mockRequest, 1)

      // All results should be errors
      assertEquals(results[0].status, 'rejected')
      assertEquals(results[1].status, 'rejected')

      // Check that both errors are the same original error (not enriched in request deduplication)
      assertEquals((results[0] as PromiseRejectedResult).reason, error)
      assertEquals((results[1] as PromiseRejectedResult).reason, error)
    })

    it('should allow new requests after completion', async () => {
      let callCount = 0
      const mockRequest = spy(() => {
        callCount++
        return Promise.resolve(`result-${callCount}`)
      })

      const key = 'sequential-request'

      const result1 = await deduplicator.deduplicate(key, mockRequest)
      assertEquals(result1, 'result-1')

      // Second request with same key (should execute again)
      const result2 = await deduplicator.deduplicate(key, mockRequest)
      assertEquals(result2, 'result-2')

      assertSpyCalls(mockRequest, 2)
    })
  })

  describe('Configuration Handling', () => {
    it('should bypass deduplication when disabled', async () => {
      const disabledDeduplicator = new RequestDeduplicator({ ...config, enabled: false })

      let callCount = 0
      const mockRequest = spy(() => {
        callCount++
        return Promise.resolve(`result-${callCount}`)
      })

      const key = 'disabled-test'

      const promises = [
        disabledDeduplicator.deduplicate(key, mockRequest),
        disabledDeduplicator.deduplicate(key, mockRequest),
        disabledDeduplicator.deduplicate(key, mockRequest),
      ]

      await Promise.all(promises)

      // When disabled, each request should be executed separately
      assertSpyCalls(mockRequest, 3)
      assertEquals(callCount, 3)
    })

    it('should respect maxPendingRequests limit', async () => {
      const limitedDeduplicator = new RequestDeduplicator({ ...config, maxPendingRequests: 2 })

      const slowRequest = spy(() => {
        return new Promise((resolve) => setTimeout(() => resolve('slow-result'), 100))
      })

      // Fill up the pending requests
      const promise1 = limitedDeduplicator.deduplicate('key-1', slowRequest)
      const promise2 = limitedDeduplicator.deduplicate('key-2', slowRequest)

      // Deduplicate the third request
      try {
        await limitedDeduplicator.deduplicate('key-3', slowRequest)
        throw new Error('Should have thrown')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        assert(error.message.includes('Too many pending requests'))
      }

      // Complete pending requests
      await Promise.all([promise1, promise2])
    })
  })

  describe('Timeout Handling', () => {
    it('should clean up requests after timeout', async () => {
      const shortTimeoutDeduplicator = new RequestDeduplicator({ ...config, timeoutMs: 50 })

      const neverResolvingRequest = spy(() => {
        return new Promise(() => {}) // no resolve
      })

      shortTimeoutDeduplicator.deduplicate('timeout-test', neverResolvingRequest)

      let metrics = shortTimeoutDeduplicator.getMetrics() // before timeout
      assertEquals(metrics.pendingRequests, 1)

      await new Promise((resolve) => setTimeout(resolve, 100))

      metrics = shortTimeoutDeduplicator.getMetrics() // after timeout
      assertEquals(metrics.pendingRequests, 0)
    })

    it('should not interfere with successful requests', async () => {
      const fastRequest = spy(() => Promise.resolve('fast-result'))

      const result = await deduplicator.deduplicate('fast-test', fastRequest)

      assertEquals(result, 'fast-result')

      const metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 0)
    })
  })

  describe('Key Generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = RequestDeduplicator.generateKey('GET', '/api/test')
      const key2 = RequestDeduplicator.generateKey('GET', '/api/test')

      assertEquals(key1, key2)
      assertEquals(key1, 'GET:/api/test')
    })

    it('should generate different keys for different methods', () => {
      const getKey = RequestDeduplicator.generateKey('GET', '/api/test')
      const postKey = RequestDeduplicator.generateKey('POST', '/api/test')

      assert(getKey !== postKey)
    })

    it('should generate different keys for different endpoints', () => {
      const key1 = RequestDeduplicator.generateKey('GET', '/api/test1')
      const key2 = RequestDeduplicator.generateKey('GET', '/api/test2')

      assert(key1 !== key2)
    })

    it('should handle parameters consistently', () => {
      const params1 = { a: 1, b: 2 }
      const params2 = { b: 2, a: 1 } // different order

      const key1 = RequestDeduplicator.generateKey('GET', '/api/test', params1)
      const key2 = RequestDeduplicator.generateKey('GET', '/api/test', params2)

      assertEquals(key1, key2) // should be same due to sorting
    })

    it('should handle empty and undefined parameters', () => {
      const key1 = RequestDeduplicator.generateKey('GET', '/api/test')
      const key2 = RequestDeduplicator.generateKey('GET', '/api/test', {})
      const key3 = RequestDeduplicator.generateKey('GET', '/api/test', undefined)

      assertEquals(key1, key2)
      assertEquals(key1, key3)
    })

    it('should generate different keys for different parameters', () => {
      const key1 = RequestDeduplicator.generateKey('GET', '/api/test', { id: 1 })
      const key2 = RequestDeduplicator.generateKey('GET', '/api/test', { id: 2 })

      assert(key1 !== key2)
    })
  })

  describe('Metrics Collection', () => {
    it('should track pending requests accurately', async () => {
      // Start with empty metrics
      let metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 0)
      assertEquals(metrics.totalDuplicates, 0)

      const slowRequest = spy(() => {
        return new Promise((resolve) => setTimeout(() => resolve('result'), 50))
      })

      const promise = deduplicator.deduplicate('pending-test', slowRequest)

      // Should have 1 pending request
      metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 1)

      await promise // complete

      // No pending requests after completion
      metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 0)
    })

    it('should track duplicate counts correctly', async () => {
      let callCount = 0
      const mockRequest = spy(() => {
        callCount++
        return new Promise((resolve) => setTimeout(() => resolve(`result-${callCount}`), 10))
      })

      const key = 'duplicate-count-test'

      // Many requests with same key
      const promises = [
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
        deduplicator.deduplicate(key, mockRequest),
      ]

      // Expect duplicates
      const pendingMetrics = deduplicator.getMetrics()
      assertEquals(pendingMetrics.pendingRequests, 1)
      assertEquals(pendingMetrics.totalDuplicates, 3) // 4 total - 1 original = 3 duplicates

      await Promise.all(promises) // complete

      const finalMetrics = deduplicator.getMetrics()
      assertEquals(finalMetrics.pendingRequests, 0)
      assertEquals(finalMetrics.totalDuplicates, 0) // cleared after completion
    })

    it('should return correct max pending requests', () => {
      const metrics = deduplicator.getMetrics()
      assertEquals(metrics.maxPendingRequests, config.maxPendingRequests)
    })
  })

  describe('Cleanup Functionality', () => {
    it('should clear all pending requests', () => {
      const neverResolvingRequest = spy(() => {
        return new Promise(() => {}) // Never resolves
      })

      deduplicator.deduplicate('key-1', neverResolvingRequest)
      deduplicator.deduplicate('key-2', neverResolvingRequest)
      deduplicator.deduplicate('key-3', neverResolvingRequest)

      let metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 3)

      deduplicator.clear()

      metrics = deduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 0)
      assertEquals(metrics.totalDuplicates, 0)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle request function throwing errors', async () => {
      const throwingRequest = spy(() => {
        throw new Error('Synchronous error')
      })

      try {
        await deduplicator.deduplicate('throwing-test', throwingRequest)
        throw new Error('Should have thrown')
      } catch (error) {
        assertInstanceOf(error, Error)
        assert(error.message.includes('Synchronous error'))
      }
    })

    it('should handle complex parameter objects', () => {
      const complexParams = {
        nested: { a: 1, b: { c: 2 } },
        array: [1, 2, 3],
        null_value: null,
        undefined_value: undefined,
      }

      const key = RequestDeduplicator.generateKey('POST', '/api/complex', complexParams)

      assertExists(key)
      assert(key.includes('POST:/api/complex'))
    })

    it('should handle concurrent access safely', async () => {
      const requestCounter = { count: 0 }
      const slowRequest = spy(() => {
        requestCounter.count++
        return new Promise((resolve) => {
          setTimeout(() => resolve(`result-${requestCounter.count}`), 10)
        })
      })

      // Many concurrent requests with same key
      const promises = Array.from({ length: 20 }, () => deduplicator.deduplicate('concurrent-test', slowRequest))

      const results = await Promise.all(promises)

      // Executes only 1
      assertSpyCalls(slowRequest, 1)
      assertEquals(requestCounter.count, 1)

      // All results should be the same
      results.forEach((result) => {
        assertEquals(result, 'result-1')
      })
    })

    it('should handle rapid sequential requests', async () => {
      let execCount = 0
      const fastRequest = spy(() => {
        execCount++
        return Promise.resolve(`fast-${execCount}`)
      })

      const results = []
      for (let i = 0; i < 10; i++) {
        const result = await deduplicator.deduplicate(`rapid-${i}`, fastRequest)
        results.push(result)
      }

      // Independent calls should execute
      assertSpyCalls(fastRequest, 10)
      assertEquals(execCount, 10)

      // Unique results
      assertEquals(results.length, 10)
      results.forEach((result, index) => {
        assertEquals(result, `fast-${index + 1}`)
      })
    })
  })
})

describe('RequestDeduplicatorFactory', () => {
  afterEach(() => {
    restore()
  })

  describe('Factory Creation', () => {
    it('should create deduplicator with default config', () => {
      const deduplicator = RequestDeduplicatorFactory.create({})

      assertExists(deduplicator)

      const metrics = deduplicator.getMetrics()
      assertEquals(metrics.maxPendingRequests, DEFAULT_REQUEST_DEDUPLICATION_CONFIG.maxPendingRequests)
    })

    it('should merge custom config with defaults', () => {
      const customConfig = {
        maxPendingRequests: 50,
        timeoutMs: 5000,
      }

      const deduplicator = RequestDeduplicatorFactory.create(customConfig)

      const metrics = deduplicator.getMetrics()
      assertEquals(metrics.maxPendingRequests, 50)
    })

    it('should handle partial configuration', () => {
      const partialConfig = {
        enabled: false,
      }

      const deduplicator = RequestDeduplicatorFactory.create(partialConfig)

      assertExists(deduplicator)

      // Defaults for undefined properties
      const metrics = deduplicator.getMetrics()
      assertEquals(metrics.maxPendingRequests, DEFAULT_REQUEST_DEDUPLICATION_CONFIG.maxPendingRequests)
    })

    it('should create multiple independent instances', () => {
      const deduplicator1 = RequestDeduplicatorFactory.create({ maxPendingRequests: 10 })
      const deduplicator2 = RequestDeduplicatorFactory.create({ maxPendingRequests: 20 })

      assertEquals(deduplicator1.getMetrics().maxPendingRequests, 10)
      assertEquals(deduplicator2.getMetrics().maxPendingRequests, 20)

      // Independent instances
      assert(deduplicator1 !== deduplicator2)
    })
  })
})

describe('RequestDeduplicator Integration Scenarios', () => {
  let deduplicator: RequestDeduplicator

  beforeEach(() => {
    deduplicator = RequestDeduplicatorFactory.create({
      enabled: true,
      maxPendingRequests: 10,
      timeoutMs: 1000,
    })
  })

  afterEach(() => {
    deduplicator.clear()
    restore()
  })

  describe('Real-world API Scenarios', () => {
    it('should handle typical API request patterns', async () => {
      // Simulate typical API responses
      const apiResponses = new Map([
        ['GET:/api/orders', [{ id: 1, symbol: 'NVDA' }]],
        ['GET:/api/positions', [{ symbol: 'GOOGL', qty: 100 }]],
        ['POST:/api/orders', { id: 2, status: 'created' }],
      ])

      const mockApiCall = spy((method: string, endpoint: string) => {
        const key = `${method}:${endpoint}`
        const response = apiResponses.get(key) || null
        return Promise.resolve(response)
      })

      // Multiple clients requesting the same data
      const promises = [
        deduplicator.deduplicate(
          RequestDeduplicator.generateKey('GET', '/api/orders'),
          () => mockApiCall('GET', '/api/orders'),
        ),
        deduplicator.deduplicate(
          RequestDeduplicator.generateKey('GET', '/api/orders'),
          () => mockApiCall('GET', '/api/orders'),
        ),
        deduplicator.deduplicate(
          RequestDeduplicator.generateKey('GET', '/api/positions'), // unique
          () => mockApiCall('GET', '/api/positions'),
        ),
      ]

      const results = await Promise.all(promises)

      // Should only call API twice (orders deduplicated, positions separate)
      assertSpyCalls(mockApiCall, 2)

      assertEquals(results[0], [{ id: 1, symbol: 'NVDA' }])
      assertEquals(results[1], [{ id: 1, symbol: 'NVDA' }])
      assertEquals(results[2], [{ symbol: 'GOOGL', qty: 100 }])
    })

    it('should handle pagination requests correctly', async () => {
      const pageRequests = [
        { page: 1, limit: 10 },
        { page: 1, limit: 10 }, // duplicate
        { page: 2, limit: 10 }, // different page
        { page: 1, limit: 20 }, // different limit
      ]

      let callCount = 0
      const mockPaginatedCall = spy((params: Record<string, unknown>) => {
        callCount++
        return Promise.resolve({
          data: [`item-${params.page}-${callCount}`],
          page: params.page,
          total: 100,
        })
      })

      const promises = pageRequests.map((params) =>
        deduplicator.deduplicate(
          RequestDeduplicator.generateKey('GET', '/api/data', params),
          () => mockPaginatedCall(params),
        )
      )

      const results = await Promise.all(promises)

      // Should call API 3 times (one duplicate)
      assertSpyCalls(mockPaginatedCall, 3)

      // First two results are identical (deduplicated requests)
      assertEquals(results[0], results[1])

      // Others should be different
      assert(results[0] !== results[2])
      assert(results[0] !== results[3])
    })

    it('should handle mixed success and error scenarios', async () => {
      const scenarios = [
        { key: 'success-1', shouldFail: false },
        { key: 'success-1', shouldFail: false }, // duplicate success
        { key: 'error-1', shouldFail: true },
        { key: 'error-1', shouldFail: true }, // duplicate error
        { key: 'success-2', shouldFail: false },
      ]

      const mockCall = spy((scenario: { key: string; shouldFail: boolean }) => {
        if (scenario.shouldFail) {
          return Promise.reject(new Error(`Error for ${scenario.key}`))
        }
        return Promise.resolve(`Success for ${scenario.key}`)
      })

      const promises = scenarios.map((scenario) => deduplicator.deduplicate(scenario.key, () => mockCall(scenario)))

      const results = await Promise.allSettled(promises)

      assertSpyCalls(mockCall, 3)

      assertEquals(results[0].status, 'fulfilled')
      assertEquals(results[1].status, 'fulfilled')
      assertEquals(
        (results[0] as PromiseFulfilledResult<string>).value,
        (results[1] as PromiseFulfilledResult<string>).value,
      )

      assertEquals(results[2].status, 'rejected')
      assertEquals(results[3].status, 'rejected')
      assertEquals(
        (results[2] as PromiseRejectedResult).reason.message,
        (results[3] as PromiseRejectedResult).reason.message,
      )

      assertEquals(results[4].status, 'fulfilled')
    })
  })

  describe('Performance and Load Testing', () => {
    it('should maintain performance under high load', async () => {
      const highLoadDeduplicator = new RequestDeduplicator({
        enabled: true,
        maxPendingRequests: 50,
        timeoutMs: 1000,
      })

      const startTime = performance.now()

      // High volume of requests
      const promises = Array.from({ length: 100 }, (_, i) => {
        const key = `load-test-${i % 10}` // ensure many duplicates
        return highLoadDeduplicator.deduplicate(key, () => Promise.resolve(`result-${i % 10}`))
      })

      const results = await Promise.all(promises)
      const endTime = performance.now()

      const duration = endTime - startTime

      assert(duration < 1000) // 1s

      assertEquals(results.length, 100)

      // Deduplicated requests
      const metrics = highLoadDeduplicator.getMetrics()
      assertEquals(metrics.pendingRequests, 0)

      highLoadDeduplicator.clear()
    })

    it('should handle burst traffic patterns', async () => {
      const burstSize = 50
      const burstKey = 'burst-test'

      let callCount = 0
      const mockBurstCall = spy(() => {
        callCount++
        return new Promise((resolve) => setTimeout(() => resolve(`burst-${callCount}`), 10))
      })

      const burstPromises = Array.from({ length: burstSize }, () => deduplicator.deduplicate(burstKey, mockBurstCall))

      const results = await Promise.all(burstPromises)

      assertSpyCalls(mockBurstCall, 1)
      assertEquals(callCount, 1)

      results.forEach((result) => {
        assertEquals(result, 'burst-1')
      })
    })
  })

  describe('Memory and Resource Management', () => {
    it('should not leak memory with completed requests', async () => {
      const initialMetrics = deduplicator.getMetrics()

      for (let i = 0; i < 100; i++) {
        await deduplicator.deduplicate(`memory-test-${i}`, () => Promise.resolve(`result-${i}`))
      }

      const finalMetrics = deduplicator.getMetrics()

      assertEquals(finalMetrics.pendingRequests, 0)
      assertEquals(finalMetrics.totalDuplicates, 0)

      assertEquals(finalMetrics.pendingRequests, initialMetrics.pendingRequests)
    })

    it('should handle cleanup gracefully', () => {
      const neverResolving = () => new Promise(() => {})

      deduplicator.deduplicate('cleanup-1', neverResolving)
      deduplicator.deduplicate('cleanup-2', neverResolving)

      const beforeClear = deduplicator.getMetrics()
      assertEquals(beforeClear.pendingRequests, 2)

      deduplicator.clear()

      const afterClear = deduplicator.getMetrics()
      assertEquals(afterClear.pendingRequests, 0)
    })
  })
})
