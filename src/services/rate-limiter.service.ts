/**
 * Rate limiter service for controlling API request rates
 * Implements a simple token bucket algorithm to limit the number of requests
 * within a specified time window. It allows for a buffer to prevent immediate rate limit hits.
 * @module
 */
import { AlpacaMarketErrorContext } from '../errors/errors.ts'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  bufferMs?: number
}

/**
 * Rate limiter to control API request rates
 *
 * This class implements a simple token bucket algorithm to limit the number of requests
 * within a specified time window. It allows for a buffer to prevent immediate rate limit hits.
 * It can be used to wrap API calls to ensure they comply with rate limits.
 *
 * @param {RateLimitConfig} config - Configuration for the rate limiter
 * @returns {RateLimiter} - Instance of the rate limiter
 *
 * @example Basic usage:
 * ```typescript
 * const rateLimiter = new RateLimiter({
 *   maxRequests: 5,
 *   windowMs: 1000,
 *   bufferMs: 100,
 * })
 * ```
 */
export class RateLimiter {
  private requests: number[] = []
  private readonly config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      bufferMs: 100, // Default 100ms buffer
      ...config,
    }
  }

  /**
   * Check if a request can be made without exceeding rate limits
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests()
    return this.requests.length < this.config.maxRequests
  }

  /**
   * Record a new request timestamp
   */
  recordRequest(): void {
    this.requests.push(Date.now())
  }

  /**
   * Wait for rate limit window to allow next request
   */
  async waitForNextWindow(): Promise<void> {
    try {
      this.cleanupOldRequests()

      if (this.canMakeRequest()) {
        return
      }

      // Calculate time to wait until oldest request expires
      const oldestRequest = this.requests[0]
      const waitTime = this.config.windowMs - (Date.now() - oldestRequest) + (this.config.bufferMs || 0)

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'rate-limiter-wait',
          metadata: {
            windowMs: this.config.windowMs,
            bufferMs: this.config.bufferMs,
            currentRequests: this.requests.length,
            maxRequests: this.config.maxRequests,
          },
        },
        'rate_limit',
      )
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      await this.waitForNextWindow()
      this.recordRequest()
      return await fn()
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'rate-limiter-execute',
          metadata: {
            windowMs: this.config.windowMs,
            maxRequests: this.config.maxRequests,
            currentRequests: this.requests.length,
          },
        },
        'rate_limit',
      )
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsInWindow: number
    maxRequests: number
    canMakeRequest: boolean
    timeUntilReset: number
  } {
    this.cleanupOldRequests()

    const timeUntilReset = this.requests.length > 0
      ? Math.max(0, this.config.windowMs - (Date.now() - this.requests[0]))
      : 0

    return {
      requestsInWindow: this.requests.length,
      maxRequests: this.config.maxRequests,
      canMakeRequest: this.canMakeRequest(),
      timeUntilReset,
    }
  }

  /**
   * Remove requests outside the current window
   *
   * @private
   */
  private cleanupOldRequests(): void {
    const now = Date.now()
    const cutoff = now - this.config.windowMs
    this.requests = this.requests.filter((timestamp) => timestamp > cutoff)
  }

  /**
   * Reset all recorded requests
   */
  reset(): void {
    this.requests = []
  }
}

/**
 * Default rate limiters for Alpaca API endpoints
 */
export const DEFAULT_RATE_LIMITERS: {
  readonly marketData: RateLimiter
  readonly trading: RateLimiter
} = {
  // Market data: 200 requests per minute
  marketData: new RateLimiter({
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
    bufferMs: 100,
  }),

  // Trading API: 200 requests per minute
  trading: new RateLimiter({
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
    bufferMs: 100,
  }),
} as const
