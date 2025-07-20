import { AlpacaMarketError, AlpacaMarketErrorContext } from '../errors/errors.ts'

export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableStatusCodes?: number[]
  jitterMs?: number
}

export interface RetryContext {
  attempt: number
  lastError: Error
  totalElapsed: number
}

/**
 * Retry manager to handle API request retries with exponential backoff
 *
 * This class provides a flexible way to retry failed operations with configurable parameters.
 * It supports exponential backoff, jitter, and custom retry logic.
 *
 * @param {RetryConfig} config - Configuration for the retry manager
 * @returns {RetryManager} - Instance of the retry manager
 *
 * @example Basic usage:
 * ```typescript
 * const retryManager = new RetryManager({
 *   maxAttempts: 5,
 *   baseDelayMs: 1000,
 *   maxDelayMs: 10000,
 *   backoffMultiplier: 2,
 * })
 *
 * const result = await retryManager.execute(async () => {
 *   return await apiCall()
 * })
 * ```
 */
export class RetryManager {
  private readonly config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      jitterMs: 100,
      ...config,
    }
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, context: RetryContext) => boolean,
  ): Promise<T> {
    try {
      return await this.executeWithRetry(fn, shouldRetry)
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'retry-execution',
          metadata: {
            maxAttempts: this.config.maxAttempts,
            baseDelayMs: this.config.baseDelayMs,
            backoffMultiplier: this.config.backoffMultiplier,
          },
        },
        'unknown',
      )
    }
  }

  /**
   * Internal retry execution logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, context: RetryContext) => boolean,
  ): Promise<T> {
    const startTime = Date.now()
    let lastError: Error

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        const context: RetryContext = {
          attempt,
          lastError,
          totalElapsed: Date.now() - startTime,
        }

        // Don't retry on the last attempt
        if (attempt === this.config.maxAttempts) {
          break
        }

        // Check if we should retry this error
        if (!this.shouldRetryError(lastError, context, shouldRetry)) {
          break
        }

        // Calculate and apply delay
        const delay = this.calculateDelay(attempt)
        await this.sleep(delay)
      }
    }

    // Enrich the final error with retry context
    throw AlpacaMarketErrorContext.enrichError(
      lastError!,
      {
        operation: 'retry-attempts-exhausted',
        retry: {
          attemptNumber: this.config.maxAttempts,
          maxAttempts: this.config.maxAttempts,
        },
        metadata: {
          totalElapsed: Date.now() - startTime,
          finalAttempt: this.config.maxAttempts,
        },
      },
    )
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryError(
    error: Error,
    context: RetryContext,
    customShouldRetry?: (error: Error, context: RetryContext) => boolean,
  ): boolean {
    // Use custom retry logic if provided
    if (customShouldRetry) {
      return customShouldRetry(error, context)
    }

    // Default retry logic for Alpaca errors
    if (error instanceof AlpacaMarketError) {
      // Retry on network errors or retryable status codes
      if (error.status && this.config.retryableStatusCodes?.includes(error.status)) {
        return true
      }

      // Retry on rate limit errors
      if (error.status === 429) {
        return true
      }
    }

    // Check for status property if it exists (duck typing for HTTP errors)
    const httpError = error as { status?: number }
    if (httpError.status) {
      if (this.config.retryableStatusCodes?.includes(httpError.status)) {
        return true
      }
      if (httpError.status === 429) {
        return true
      }
    }

    // Retry on network errors
    if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
      return true
    }

    // Don't retry by default
    return false
  }

  /**
   * Calculate delay for next retry attempt with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1)
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)

    // Add jitter to prevent thundering herd
    const jitter = this.config.jitterMs ? Math.random() * this.config.jitterMs : 0

    return cappedDelay + jitter
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config }
  }
}

/**
 * Default retry manager for Alpaca API requests
 */
export const DEFAULT_RETRY_MANAGER = new RetryManager({
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  jitterMs: 100,
})

/**
 * Retry manager for market data requests (more aggressive)
 */
export const MARKET_DATA_RETRY_MANAGER = new RetryManager({
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 1.5,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  jitterMs: 50,
})

/**
 * Conservative retry manager for trading operations
 */
export const TRADING_RETRY_MANAGER = new RetryManager({
  maxAttempts: 2,
  baseDelayMs: 2000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  jitterMs: 200,
})
