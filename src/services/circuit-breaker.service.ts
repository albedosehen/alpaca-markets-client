import { AlpacaMarketErrorContext } from '../errors/errors.ts'

/**
 * Circuit breaker states for market trading.
 *
 * @property Closed - Circuit breaker is closed
 * @property Open - Circuit breaker is open
 * @property HalfOpen - Circuit breaker is half-open
 */
export const CIRCUIT_BREAKER_STATE = {
  Closed: 'closed',
  Open: 'open',
  HalfOpen: 'half_open',
} as const

/**
 * Type representing the possible states of a circuit breaker.
 */
export type CircuitBreakerState = typeof CIRCUIT_BREAKER_STATE[keyof typeof CIRCUIT_BREAKER_STATE]

/**
 * Logger interface for circuit breaker operations
 */
interface Logger {
  child(context: Record<string, unknown>): Logger
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  timeoutMs: number
  recoveryTimeoutMs: number
  halfOpenMaxAttempts?: number
  resetTimeoutMs?: number
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  totalAttempts: number
  lastFailureTime?: number
  lastSuccessTime?: number
  stateChangedAt: number
}

/**
 * Circuit breaker implementation for managing API request failures
 * Provides protection against cascading failures by limiting the number of requests
 * during periods of high failure rates.
 *
 * @param {CircuitBreakerConfig} config - Configuration for the circuit breaker
 * @param {Logger} [logger] - Optional logger for circuit breaker events
 * @param {string} [name='CircuitBreaker'] - Name for the circuit breaker instance
 * @throws {AlpacaMarketError} - Throws an error if the circuit breaker is open or in an invalid state
 *
 * @example Basic usage:
 * ```typescript
 * const circuitBreaker = new CircuitBreaker({
 *  failureThreshold: 5,
 *  timeoutMs: 10000,
 *  recoveryTimeoutMs: 30000,
 *  halfOpenMaxAttempts: 2,
 *  resetTimeoutMs: 300000,
 * });
 *
 * const result = await circuitBreaker.execute(async () => {
 *  // ...
 * });
 * ```
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CIRCUIT_BREAKER_STATE.Closed
  private failureCount = 0
  private successCount = 0
  private totalAttempts = 0
  private lastFailureTime?: number
  private lastSuccessTime?: number
  private stateChangedAt = Date.now()
  private halfOpenAttempts = 0
  private resetTimeout?: number

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly name: string = 'CircuitBreaker',
  ) {}

  /**
   * Execute a function with circuit breaker protection
   *
   * @param {Function} fn - The function to execute
   * @returns {Promise<T>} - The result of the function execution
   * @throws {AlpacaMarketError} - Throws an error if the circuit breaker is open or if execution fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      await this.checkState()
      const result = await this.executeWithTracking(fn)
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: `circuit-breaker-execute-${this.name}`,
          metadata: {
            circuitBreakerName: this.name,
            state: this.state,
            failureCount: this.failureCount,
            totalAttempts: this.totalAttempts,
          },
        },
        'circuit_breaker',
      )
    }
  }

  /**
   * Check current circuit breaker state and determine if execution should proceed
   *
   * @private
   */
  private async checkState(): Promise<void> {
    const now = Date.now()

    switch (this.state) {
      case CIRCUIT_BREAKER_STATE.Closed:
        return

      case CIRCUIT_BREAKER_STATE.Open:
        if (now - this.stateChangedAt >= this.config.recoveryTimeoutMs) {
          this.transitionToHalfOpen()
          return
        }
        throw AlpacaMarketErrorContext.enrichError(
          `Circuit breaker is open [${this.name}]. Recovery timeout not reached. State: ${this.state}, Failures: ${this.failureCount}, TimeUntilRecovery: ${
            this.config.recoveryTimeoutMs - (now - this.stateChangedAt)
          }ms`,
          {
            operation: `circuit-breaker-state-check-${this.name}`,
            metadata: {
              circuitBreakerName: this.name,
              state: this.state,
              failureCount: this.failureCount,
              timeUntilRecovery: this.config.recoveryTimeoutMs - (now - this.stateChangedAt),
            },
          },
          'circuit_breaker',
        )

      case CIRCUIT_BREAKER_STATE.HalfOpen: {
        const maxAttempts = this.config.halfOpenMaxAttempts || 1
        if (this.halfOpenAttempts >= maxAttempts) {
          throw AlpacaMarketErrorContext.enrichError(
            `Circuit breaker half-open attempts exceeded [${this.name}]. State: ${this.state}, Attempts: ${this.halfOpenAttempts}/${maxAttempts}`,
            {
              operation: `circuit-breaker-half-open-exceeded-${this.name}`,
              metadata: {
                circuitBreakerName: this.name,
                state: this.state,
                halfOpenAttempts: this.halfOpenAttempts,
                maxAttempts,
              },
            },
            'circuit_breaker',
          )
        }
        this.halfOpenAttempts++
        return
      }

      default:
        throw AlpacaMarketErrorContext.enrichError(
          `Unknown circuit breaker state: ${this.state}`,
          {
            operation: `circuit-breaker-unknown-state-${this.name}`,
            metadata: {
              circuitBreakerName: this.name,
              state: this.state,
            },
          },
          'circuit_breaker',
        )
    }
  }

  /**
   * Execute function with tracking and timeout
   *
   * @param {Function} fn - The function to execute
   * @returns {Promise<T>} - The result of the function execution
   * @throws {AlpacaMarketError} - Throws an error if execution fails or times out
   * @private
   */
  private async executeWithTracking<T>(fn: () => Promise<T>): Promise<T> {
    this.totalAttempts++

    let timeoutId: number | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(AlpacaMarketErrorContext.timeoutError(
          `Circuit breaker timeout after ${this.config.timeoutMs}ms`,
          this.config.timeoutMs,
          {
            operation: `circuit-breaker-timeout-${this.name}`,
            metadata: {
              circuitBreakerName: this.name,
              timeoutMs: this.config.timeoutMs,
            },
          },
        ))
      }, this.config.timeoutMs)
    })

    try {
      const result = await Promise.race([
        fn(),
        timeoutPromise,
      ])
      // Clear timeout if function completes before timeout
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      return result
    } catch (error) {
      // Clear timeout on error as well
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: `circuit-breaker-execution-${this.name}`,
          metadata: {
            circuitBreakerName: this.name,
            totalAttempts: this.totalAttempts,
          },
        },
        'circuit_breaker',
      )
    }
  }

  /**
   * Record successful execution
   *
   * @private
   */
  private recordSuccess(): void {
    this.successCount++
    this.lastSuccessTime = Date.now()

    if (this.state === CIRCUIT_BREAKER_STATE.HalfOpen) {
      this.transitionToClosed()
    }

    console.debug('Circuit breaker success recorded', {
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
    })
  }

  /**
   * Record failed execution
   *
   * @private
   */
  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CIRCUIT_BREAKER_STATE.Closed && this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen()
    } else if (this.state === CIRCUIT_BREAKER_STATE.HalfOpen) {
      this.transitionToOpen()
    }

    console.warn('Circuit breaker failure recorded', {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.config.failureThreshold,
    })
  }

  /**
   * Transition to CLOSED state
   *
   * Resets failure count and half-open attempts
   *
   * @private
   */
  private transitionToClosed(): void {
    const previousState = this.state
    this.state = CIRCUIT_BREAKER_STATE.Closed
    this.failureCount = 0
    this.halfOpenAttempts = 0
    this.stateChangedAt = Date.now()

    this.scheduleReset()

    console.info('Circuit breaker transitioned to CLOSED', {
      previousState,
      newState: this.state,
      successCount: this.successCount,
    })
  }

  /**
   * Transition to OPEN state
   *
   * Resets half-open attempts and logs the transition
   *
   * @private
   */
  private transitionToOpen(): void {
    const previousState = this.state
    this.state = CIRCUIT_BREAKER_STATE.Open
    this.halfOpenAttempts = 0
    this.stateChangedAt = Date.now()

    console.error('Circuit breaker transitioned to OPEN', {
      previousState,
      newState: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.config.failureThreshold,
      recoveryTimeoutMs: this.config.recoveryTimeoutMs,
    })
  }

  /**
   * Transition to HALF_OPEN state
   *
   * Resets half-open attempts and logs the transition
   *
   * @private
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state
    this.state = CIRCUIT_BREAKER_STATE.HalfOpen
    this.halfOpenAttempts = 0
    this.stateChangedAt = Date.now()

    console.info('Circuit breaker transitioned to HALF_OPEN', {
      previousState,
      newState: this.state,
      maxAttempts: this.config.halfOpenMaxAttempts || 1,
    })
  }

  /**
   * Schedule periodic reset of metrics
   *
   * If resetTimeoutMs is not set, no periodic reset will be scheduled
   *
   * @private
   */
  private scheduleReset(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout)
    }

    if (this.config.resetTimeoutMs) {
      this.resetTimeout = setTimeout(() => {
        this.resetMetrics()
      }, this.config.resetTimeoutMs)
    }
  }

  /**
   * Reset circuit breaker metrics
   *
   * Resets success count, total attempts, and failure count if circuit is closed
   *
   * @private
   */
  private resetMetrics(): void {
    this.successCount = 0
    this.totalAttempts = 0
    // Don't reset failure count if circuit is open
    if (this.state === CIRCUIT_BREAKER_STATE.Closed) {
      this.failureCount = 0
    }

    console.debug('Circuit breaker metrics reset', {
      state: this.state,
    })
  }

  /**
   * Get current circuit breaker metrics
   *
   * Returns an object containing the current state, failure count, success count,
   * total attempts, last failure time, last success time, and state changed timestamp
   *
   * @return {CircuitBreakerMetrics} - Current circuit breaker metrics
   * @throws {AlpacaMarketError} - Throws an error if the circuit breaker is in an invalid state
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalAttempts: this.totalAttempts,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
    }
  }

  /**
   * Force circuit breaker to specific state (for testing)
   *
   * This method allows you to manually set the circuit breaker state
   * to simulate different scenarios. Use with caution as it can disrupt normal operation.
   *
   * @param {CircuitBreakerState} state - The state to force the circuit breaker into
   * @throws {AlpacaMarketError} - Throws an error if the provided state is invalid
   * @example Basic Usage:
   * ```typescript
   * circuitBreaker.forceState(CIRCUIT_BREAKER_STATE.Open);
   * ```
   */
  forceState(state: CircuitBreakerState): void {
    const previousState = this.state
    this.state = state
    this.stateChangedAt = Date.now()

    console.warn('Circuit breaker state forced', {
      previousState,
      newState: state,
    })
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CIRCUIT_BREAKER_STATE.Closed
    this.failureCount = 0
    this.successCount = 0
    this.totalAttempts = 0
    this.halfOpenAttempts = 0
    this.lastFailureTime = undefined
    this.lastSuccessTime = undefined
    this.stateChangedAt = Date.now()

    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout)
      this.resetTimeout = undefined
    }

    console.info('Circuit breaker reset to initial state')
  }
}

/**
 * Default circuit breaker configurations
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIGS = {
  // Trading operations - conservative settings
  trading: {
    failureThreshold: 3,
    timeoutMs: 10000, // 10 seconds
    recoveryTimeoutMs: 30000, // 30 seconds
    halfOpenMaxAttempts: 1,
    resetTimeoutMs: 300000, // 5 minutes
  },

  // Market data - more aggressive settings
  marketData: {
    failureThreshold: 5,
    timeoutMs: 5000, // 5 seconds
    recoveryTimeoutMs: 15000, // 15 seconds
    halfOpenMaxAttempts: 2,
    resetTimeoutMs: 180000, // 3 minutes
  },

  // WebSocket connections - quick recovery
  websocket: {
    failureThreshold: 2,
    timeoutMs: 15000, // 15 seconds
    recoveryTimeoutMs: 10000, // 10 seconds
    halfOpenMaxAttempts: 1,
    resetTimeoutMs: 120000, // 2 minutes
  },
} as const
