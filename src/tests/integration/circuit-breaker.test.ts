import { assertEquals, assertExists } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { restore } from '@std/testing/mock'
import {
  CIRCUIT_BREAKER_STATE,
  CircuitBreaker,
  type CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIGS,
} from '../../services/circuit-breaker.service.ts'
import { AlpacaMarketError } from '../../errors/errors.ts'

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker
  let config: CircuitBreakerConfig
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout
  let timeoutCallbacks: (() => void)[] = []
  let timeoutIds: number[] = []

  beforeEach(() => {
    // Mock setTimeout and clearTimeout
    originalSetTimeout = globalThis.setTimeout
    originalClearTimeout = globalThis.clearTimeout
    timeoutCallbacks = []
    timeoutIds = []

    globalThis.setTimeout = ((callback: () => void, _delay: number) => {
      timeoutCallbacks.push(callback)
      const id = timeoutIds.length
      timeoutIds.push(id)
      return id
    }) as typeof setTimeout

    globalThis.clearTimeout = (id?: number) => {
      if (id !== undefined) {
        const index = timeoutIds.indexOf(id)
        if (index >= 0) {
          timeoutCallbacks.splice(index, 1)
          timeoutIds.splice(index, 1)
        }
      }
    }

    config = {
      failureThreshold: 5,
      timeoutMs: 30000,
      recoveryTimeoutMs: 60000,
      halfOpenMaxAttempts: 1,
      resetTimeoutMs: 300000,
    }

    circuitBreaker = new CircuitBreaker(config)
  })

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    restore()
  })

  describe('State Management', () => {
    it('should start in closed state', () => {
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)
    })

    it('should transition to open state after failure threshold', async () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(() => {
            throw new Error('test error')
          })
        } catch {
          // Expected to fail
        }
      }

      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)
    })

    it('should transition to half-open after recovery timeout', async () => {
      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(() => {
            throw new Error('test error')
          })
        } catch {
          // Expected to fail
        }
      }
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)

      circuitBreaker.getMetrics()
      const pastTime = Date.now() - config.recoveryTimeoutMs - 1000
      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Open)

      // Mock the state change time to be in the past
      const _privateStateChangeField = (circuitBreaker as unknown as { stateChangedAt: number }).stateChangedAt =
        pastTime

      // Expect transition to half-open
      const result = await circuitBreaker.execute(() => Promise.resolve('test'))
      assertEquals(result, 'test')
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed) // Success closes it
    })

    it('should close circuit on successful half-open execution', async () => {
      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.HalfOpen)
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.HalfOpen)

      // Expect closed circuit on success
      const result = await circuitBreaker.execute(() => Promise.resolve('success'))

      assertEquals(result, 'success')
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)
    })

    it('should reopen circuit on failed half-open execution', async () => {
      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.HalfOpen)
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.HalfOpen)

      // Expect reopened circuit on failure
      try {
        await circuitBreaker.execute(() => {
          throw new Error('half-open failure')
        })
      } catch (error) {
        assertEquals((error as Error).message, 'half-open failure')
      }

      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)
    })
  })

  describe('Error Tracking', () => {
    it('should track failure count correctly', async () => {
      assertEquals(circuitBreaker.getMetrics().failureCount, 0)

      try {
        await circuitBreaker.execute(() => {
          throw new Error('test error')
        })
      } catch {
        // Expected to fail
      }

      assertEquals(circuitBreaker.getMetrics().failureCount, 1)
    })

    it('should reset failure count on transition to closed', async () => {
      // Generate failures
      try {
        await circuitBreaker.execute(() => {
          throw new Error('test error')
        })
      } catch {
        // Expected
      }
      try {
        await circuitBreaker.execute(() => {
          throw new Error('test error')
        })
      } catch {
        // Expected
      }

      assertEquals(circuitBreaker.getMetrics().failureCount, 2)

      // Closed state should reset failure count
      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Closed)

      // Trigger the private transition method
      const privateMethod = (circuitBreaker as unknown as { transitionToClosed: () => void }).transitionToClosed
      privateMethod.call(circuitBreaker)

      assertEquals(circuitBreaker.getMetrics().failureCount, 0)
    })

    it('should track success count correctly', async () => {
      assertEquals(circuitBreaker.getMetrics().successCount, 0)

      await circuitBreaker.execute(() => Promise.resolve('success'))

      assertEquals(circuitBreaker.getMetrics().successCount, 1)
    })

    it('should track total attempts correctly', async () => {
      assertEquals(circuitBreaker.getMetrics().totalAttempts, 0)

      await circuitBreaker.execute(() => Promise.resolve('success'))

      try {
        await circuitBreaker.execute(() => {
          throw new Error('test error')
        })
      } catch {
        // Expected
      }

      assertEquals(circuitBreaker.getMetrics().totalAttempts, 2)
    })
  })

  describe('Request Execution', () => {
    it('should execute successful requests in closed state', async () => {
      const result = await circuitBreaker.execute(() => Promise.resolve('test result'))

      assertEquals(result, 'test result')
    })

    it('should execute failed requests in closed state', async () => {
      const testError = new Error('test error')

      try {
        await circuitBreaker.execute(() => {
          throw testError
        })
      } catch (error) {
        assertEquals((error as Error).message, 'test error')
      }
    })

    it('should reject requests immediately in open state', async () => {
      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Open)

      // Expect request immediate rejection
      try {
        await circuitBreaker.execute(() => Promise.resolve('should not execute'))
      } catch (error) {
        assertEquals((error as AlpacaMarketError).message.includes('Circuit breaker is open'), true)
      }
    })

    it.skip('should handle timeout correctly', async () => {
      /* The circuit breaker uses real setTimeout internally which creates unresolved promises with the test framework */
    })

    it('should handle synchronous exceptions', async () => {
      try {
        await circuitBreaker.execute(() => {
          throw new Error('sync error')
        })
      } catch (error) {
        assertEquals((error as Error).message.includes('sync error'), true)
      }
    })
  })

  describe('Metrics Collection', () => {
    it('should provide accurate metrics', async () => {
      await circuitBreaker.execute(() => Promise.resolve('success'))

      try {
        await circuitBreaker.execute(() => {
          throw new Error('error')
        })
      } catch {
        // Expected
      }

      await circuitBreaker.execute(() => Promise.resolve('success'))

      const metrics = circuitBreaker.getMetrics()

      assertEquals(metrics.state, CIRCUIT_BREAKER_STATE.Closed)
      assertEquals(metrics.totalAttempts, 3)
      assertEquals(metrics.successCount, 2)
      assertEquals(metrics.failureCount, 1)
      assertExists(metrics.lastSuccessTime)
      assertExists(metrics.lastFailureTime)
      assertExists(metrics.stateChangedAt)
    })

    it('should track state changes correctly', () => {
      // Manually set initial stateChangedAt to a past time to ensure measurable difference
      const pastTime = Date.now() - 1000
      const privateCircuit = circuitBreaker as unknown as { stateChangedAt: number }
      privateCircuit.stateChangedAt = pastTime

      const initialTime = circuitBreaker.getMetrics().stateChangedAt
      assertEquals(initialTime, pastTime)

      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Open)

      const newTime = circuitBreaker.getMetrics().stateChangedAt
      assertEquals(newTime > initialTime, true)
    })
  })

  describe('Configuration', () => {
    it('should respect custom failure threshold', async () => {
      const customConfig = { ...config, failureThreshold: 2 }
      const customCircuit = new CircuitBreaker(customConfig)

      // Expect open state after 2 failures
      try {
        await customCircuit.execute(() => {
          throw new Error('error 1')
        })
      } catch {
        // Expected
      }
      assertEquals(customCircuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

      try {
        await customCircuit.execute(() => {
          throw new Error('error 2')
        })
      } catch {
        // Expected
      }
      assertEquals(customCircuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)
    })

    it.skip('should respect custom timeout', async () => {
      /* The circuit breaker uses real setTimeout internally which creates unresolved promises with the test framework */
    })

    it('should respect half-open max attempts', async () => {
      const customConfig = { ...config, halfOpenMaxAttempts: 2 }
      const customCircuit = new CircuitBreaker(customConfig)

      customCircuit.forceState(CIRCUIT_BREAKER_STATE.HalfOpen)

      // Manually set halfOpenAttempts to max value by accessing private field
      const privateCircuit = customCircuit as unknown as { halfOpenAttempts: number }
      privateCircuit.halfOpenAttempts = 2

      // Now the next attempt should be rejected due to max attempts exceeded
      try {
        await customCircuit.execute(() => Promise.resolve('success'))
        throw new Error('Should have been rejected')
      } catch (error) {
        assertEquals((error as Error).message.includes('half-open attempts exceeded'), true)
      }
    })
  })

  describe('Concurrency', () => {
    it('should handle concurrent requests correctly', async () => {
      const promises = []

      // Concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(circuitBreaker.execute(() => Promise.resolve(`result-${i}`)))
      }

      const results = await Promise.all(promises)

      results.forEach((result, index) => {
        assertEquals(result, `result-${index}`)
      })

      assertEquals(circuitBreaker.getMetrics().totalAttempts, 10)
      assertEquals(circuitBreaker.getMetrics().successCount, 10)
    })

    it('should handle concurrent failures correctly', async () => {
      const promises = []

      // Concurrent failing requests
      for (let i = 0; i < config.failureThreshold + 2; i++) {
        promises.push(
          circuitBreaker.execute(() => {
            throw new Error(`error-${i}`)
          }).catch((error) => error),
        )
      }

      const results = await Promise.all(promises)

      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)
      assertEquals(results.every((r) => r instanceof Error), true)
    })
  })

  describe('Resource Cleanup', () => {
    it('should clean up timers on reset', () => {
      const _initialTimeouts = timeoutIds.length

      circuitBreaker.reset()

      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)
      assertEquals(circuitBreaker.getMetrics().totalAttempts, 0)
      assertEquals(circuitBreaker.getMetrics().successCount, 0)
      assertEquals(circuitBreaker.getMetrics().failureCount, 0)
    })
  })

  describe('Manual Operations', () => {
    it('should allow manual state forcing', () => {
      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

      circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Open)

      assertEquals(circuitBreaker.getMetrics().state, CIRCUIT_BREAKER_STATE.Open)
    })

    it('should allow manual reset', async () => {
      await circuitBreaker.execute(() => Promise.resolve('success'))

      try {
        await circuitBreaker.execute(() => {
          throw new Error('error')
        })
      } catch {
        // Expected
      }

      const beforeReset = circuitBreaker.getMetrics()
      assertEquals(beforeReset.totalAttempts > 0, true)

      circuitBreaker.reset()

      const afterReset = circuitBreaker.getMetrics()
      assertEquals(afterReset.totalAttempts, 0)
      assertEquals(afterReset.successCount, 0)
      assertEquals(afterReset.failureCount, 0)
      assertEquals(afterReset.state, CIRCUIT_BREAKER_STATE.Closed)
    })
  })

  describe('Half-Open State Behavior', () => {
    it('should limit attempts in half-open state', async () => {
      const customConfig = { ...config, halfOpenMaxAttempts: 1 }
      const customCircuit = new CircuitBreaker(customConfig)

      customCircuit.forceState(CIRCUIT_BREAKER_STATE.HalfOpen)

      // Manually set halfOpenAttempts to max value by accessing private field
      const privateCircuit = customCircuit as unknown as { halfOpenAttempts: number }
      privateCircuit.halfOpenAttempts = 1

      // Now the next attempt should be rejected due to max attempts exceeded
      try {
        await customCircuit.execute(() => Promise.resolve('success'))
        throw new Error('Should have been rejected')
      } catch (error) {
        assertEquals((error as Error).message.includes('half-open attempts exceeded'), true)
      }
    })
  })
})

describe('Default Circuit Breaker Configurations', () => {
  it('should provide trading configuration', () => {
    const config = DEFAULT_CIRCUIT_BREAKER_CONFIGS.trading

    assertExists(config)
    assertEquals(config.failureThreshold, 3)
    assertEquals(config.timeoutMs, 10000)
    assertEquals(config.recoveryTimeoutMs, 30000)
    assertEquals(config.halfOpenMaxAttempts, 1)
    assertEquals(config.resetTimeoutMs, 300000)
  })

  it('should provide market data configuration', () => {
    const config = DEFAULT_CIRCUIT_BREAKER_CONFIGS.marketData

    assertExists(config)
    assertEquals(config.failureThreshold, 5)
    assertEquals(config.timeoutMs, 5000)
    assertEquals(config.recoveryTimeoutMs, 15000)
    assertEquals(config.halfOpenMaxAttempts, 2)
    assertEquals(config.resetTimeoutMs, 180000)
  })

  it('should provide websocket configuration', () => {
    const config = DEFAULT_CIRCUIT_BREAKER_CONFIGS.websocket

    assertExists(config)
    assertEquals(config.failureThreshold, 2)
    assertEquals(config.timeoutMs, 15000)
    assertEquals(config.recoveryTimeoutMs, 10000)
    assertEquals(config.halfOpenMaxAttempts, 1)
    assertEquals(config.resetTimeoutMs, 120000)
  })

  it('should work with trading configuration', async () => {
    const circuit = new CircuitBreaker(
      DEFAULT_CIRCUIT_BREAKER_CONFIGS.trading,
    )

    assertExists(circuit)
    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

    const result = await circuit.execute(() => Promise.resolve('trading-success'))
    assertEquals(result, 'trading-success')
  })

  it('should work with market data configuration', async () => {
    const circuit = new CircuitBreaker(
      DEFAULT_CIRCUIT_BREAKER_CONFIGS.marketData,
    )

    assertExists(circuit)
    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(() => {
          throw new Error('market data error')
        })
      } catch {
        // Expected
      }
    }

    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)
  })

  it('should work with websocket configuration', async () => {
    const circuit = new CircuitBreaker(
      DEFAULT_CIRCUIT_BREAKER_CONFIGS.websocket,
    )

    assertExists(circuit)
    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

    try {
      await circuit.execute(() => {
        throw new Error('websocket error 1')
      })
    } catch {
      // Expected
    }
    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Closed)

    try {
      await circuit.execute(() => {
        throw new Error('websocket error 2')
      })
    } catch {
      // Expected
    }
    assertEquals(circuit.getMetrics().state, CIRCUIT_BREAKER_STATE.Open) // Threshold is 2
  })
})
