/**
 * Types and interfaces for Trade Endpoint
 * Provides types for trading operations, account activities, and trading client configuration.
 * @module
 */
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
 * Trade endpoint metrics interface
 *
 * This interface defines the structure of metrics returned by getMetrics()
 */
export interface TradeEndpointMetrics {
  readonly cache?: unknown
  readonly circuitBreaker?: unknown
  readonly requestDeduplication?: unknown
  readonly connectionPool?: unknown
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
