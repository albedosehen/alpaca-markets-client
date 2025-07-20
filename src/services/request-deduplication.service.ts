import { AlpacaMarketErrorContext } from '../errors/errors.ts'

/**
 * Configuration for request deduplication
 */
export interface RequestDeduplicationConfig {
  enabled: boolean
  maxPendingRequests: number
  timeoutMs: number
}

/**
 * Default request deduplication configuration
 */
export const DEFAULT_REQUEST_DEDUPLICATION_CONFIG: RequestDeduplicationConfig = {
  enabled: true,
  maxPendingRequests: 100,
  timeoutMs: 30000, // 30 seconds
}

/**
 * Request deduplication utility to prevent duplicate API calls
 * Ensures that identical requests are only executed once and results are shared
 *
 * This is useful for reducing load on the API and preventing unnecessary duplicate requests
 * especially in high-throughput scenarios.
 *
 * @param {RequestDeduplicationConfig} config - Configuration for deduplication
 * @returns {RequestDeduplicator} - Instance of the request deduplicator
 *
 * @example Basic usage:
 * ```typescript
 * const deduplicator = new RequestDeduplicator({
 *  enabled: true,
 *  maxPendingRequests: 50,
 *  timeoutMs: 10000,
 * })
 *
 * const result = await deduplicator.deduplicate('unique-key', async () => {
 *   return await apiCall()
 * })
 * ```
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<unknown>>()
  private requestCounts = new Map<string, number>()
  private timeouts = new Map<string, number>()

  constructor(private config: RequestDeduplicationConfig) {}

  /**
   * Execute a request with deduplication
   * If an identical request is already in progress, returns the existing promise
   */
  async deduplicate<T>(
    requestKey: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    if (!this.config.enabled) {
      return await requestFn()
    }

    // Check if we're at the limit of pending requests
    if (this.pendingRequests.size >= this.config.maxPendingRequests) {
      throw AlpacaMarketErrorContext.enrichError(
        'Too many pending requests',
        {
          operation: 'request-deduplication-limit',
          metadata: {
            requestKey,
            pendingCount: this.pendingRequests.size,
            maxPending: this.config.maxPendingRequests,
          },
        },
        'rate_limit',
      )
    }

    // Check if request is already pending
    if (this.pendingRequests.has(requestKey)) {
      const count = this.requestCounts.get(requestKey) || 0
      this.requestCounts.set(requestKey, count + 1)

      return await this.pendingRequests.get(requestKey)! as T
    }

    // Execute new request
    const requestPromise = requestFn()
      .finally(() => {
        // Clean up after request completes
        this.pendingRequests.delete(requestKey)
        this.requestCounts.delete(requestKey)

        // Clear the timeout if it exists
        const timeoutId = this.timeouts.get(requestKey)
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
          this.timeouts.delete(requestKey)
        }
      })

    // Store the promise for deduplication
    this.pendingRequests.set(requestKey, requestPromise)
    this.requestCounts.set(requestKey, 1)

    // Set up timeout cleanup
    const timeoutId = setTimeout(() => {
      if (this.pendingRequests.has(requestKey)) {
        this.pendingRequests.delete(requestKey)
        this.requestCounts.delete(requestKey)
        this.timeouts.delete(requestKey)
      }
    }, this.config.timeoutMs)

    this.timeouts.set(requestKey, timeoutId)

    // Return the promise directly - errors should be passed through unchanged
    return await requestPromise
  }

  /**
   * Generate a standardized request key for deduplication
   */
  static generateKey(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): string {
    const baseKey = `${method}:${endpoint}`

    if (!params || Object.keys(params).length === 0) {
      return baseKey
    }

    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {} as Record<string, unknown>)

    const paramString = JSON.stringify(sortedParams)
    return `${baseKey}:${paramString}`
  }

  /**
   * Get current deduplication metrics
   */
  getMetrics(): {
    pendingRequests: number
    maxPendingRequests: number
    totalDuplicates: number
  } {
    const totalDuplicates = Array.from(this.requestCounts.values())
      .reduce((sum, count) => sum + Math.max(0, count - 1), 0)

    return {
      pendingRequests: this.pendingRequests.size,
      maxPendingRequests: this.config.maxPendingRequests,
      totalDuplicates,
    }
  }

  /**
   * Clear all pending requests (for cleanup)
   */
  clear(): void {
    // Clear all timeouts first
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId)
    }

    this.pendingRequests.clear()
    this.requestCounts.clear()
    this.timeouts.clear()
  }
}

/**
 * Factory for creating request deduplicator instances
 */
export const RequestDeduplicatorFactory = {
  create: (
    config: Partial<RequestDeduplicationConfig>,
  ): RequestDeduplicator => {
    const finalConfig = {
      ...DEFAULT_REQUEST_DEDUPLICATION_CONFIG,
      ...config,
    }

    return new RequestDeduplicator(finalConfig)
  },
}
