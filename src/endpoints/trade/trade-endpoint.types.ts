import type { Sort } from '../../types/market.ts'
import type { CircuitBreakerConfig } from '../../services/circuit-breaker.service.ts'

/**
 * Trading Client configuration options
 */
export interface TradingClientConfig {
  /** Enable debug logging (default: false) */
  debug?: boolean
  cacheConfig?: {
    enabled: boolean
    maxSize?: number
    defaultTtlMs?: number
  }
  circuitBreakerConfig?: CircuitBreakerConfig
  requestDeduplicationConfig?: {
    enabled: boolean
    maxPendingRequests?: number
    timeoutMs?: number
  }
  connectionPoolConfig?: {
    enabled: boolean
    maxConnections?: number
    maxIdleTime?: number
    keepAlive?: boolean
    timeout?: number
  }
}

/**
 * Request interface for getting account activities.
 *
 * This interface defines the parameters for fetching account activities.
 */
export interface GetAccountActivitiesParams extends Record<string, unknown> {
  activity_type?: string
  date?: string
  until?: string
  after?: string
  direction?: Sort
  page_size?: number
  page_token?: string
}
