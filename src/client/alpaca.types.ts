import type { CircuitBreakerConfig } from '../services/circuit-breaker.service.ts'
import type { WebSocketConfig, WebSocketEventHandlers } from '../types/websocket.ts'
import type { RequestDeduplicationConfig } from '../services/request-deduplication.service.ts'
import type { ConnectionPoolConfig } from '../services/connection-pool.service.ts'
import type { MappingServiceConfig } from '../services/mapping.service.ts'
import type { MetadataCacheConfig } from '../services/metadata-cache.service.ts'

/**
 * Alpaca client configuration interface
 */
export interface AlpacaClientConfig {
  /** API key for authentication */
  apiKey: string
  /** Secret key for authentication */
  secretKey: string
  /** Alpaca environment (paper or live) */
  environment: AlpacaEnvironment
  /** Base URL for API requests */
  baseUrl?: string
  /** Data URL for market data requests */
  dataUrl?: string
  /** Streaming URL for WebSocket connections */
  timeout?: number
  /** Timeout for API requests in milliseconds */
  maxRetries?: number
  /** Maximum number of retries for API requests */
  rateLimitBuffer?: number
  /** Trading client configuration */
  trading?: AlpacaTradingClientConfig
  /** WebSocket streaming configuration */
  streaming?: AlpacaStreamingConfig
  /** Cache configuration */
  cache?: AlpacaCacheConfig
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig
  /** Request deduplication configuration */
  requestDeduplication?: RequestDeduplicationConfig
  /** Connection pool configuration */
  connectionPool?: ConnectionPoolConfig
  /** Mapping configuration */
  mapping?: AlpacaMappingConfig
}

/**
 * Trading client configuration interface
 */
export interface AlpacaTradingClientConfig {
  /** Whether the trading client is enabled */
  enabled: boolean
  /** Cache configuration for trading data */
  cacheConfig?: {
    /** Whether caching is enabled */
    enabled: boolean
    /** Maximum cache size */
    maxSize?: number
    /** Default time-to-live for cache entries */
    defaultTtlMs?: number
  }
  /** Circuit breaker configuration */
  circuitBreakerConfig?: CircuitBreakerConfig
}

/**
 * WebSocket streaming configuration interface
 */
export interface AlpacaStreamingConfig {
  /** Whether WebSocket streaming is enabled */
  enabled: boolean
  /** Whether to automatically connect to the WebSocket */
  autoConnect?: boolean
  /** WebSocket event handlers */
  eventHandlers?: WebSocketEventHandlers
  /** WebSocket configuration */
  websocketConfig?: Partial<WebSocketConfig>
}

/**
 * Cache configuration interface
 */
export interface AlpacaCacheConfig {
  /** Whether caching is enabled */
  enabled: boolean
  /** Maximum cache size */
  maxSize?: number
  /** Default time-to-live for cache entries */
  defaultTtlMs?: number
  /** Interval for cache cleanup in milliseconds */
  cleanupIntervalMs?: number
  /** Whether to enable LRU (Least Recently Used) eviction */
  enableLru?: boolean
  /** Whether to enable metrics collection for cache performance */
  enableMetrics?: boolean
}

/**
 * Mapping configuration interface
 */
export interface AlpacaMappingConfig {
  /** Whether mapping services are enabled */
  enabled: boolean
  /** Configuration for mapping services */
  serviceConfig?: Partial<MappingServiceConfig>
  /** Metadata cache configuration */
  metadataCacheConfig?: Partial<MetadataCacheConfig>
}

/**
 * Alpaca environment constants
 *
 * Represents the environment in which the Alpaca client operates
 *
 * @property PAPER - Represents the paper trading environment
 * @property LIVE - Represents the live trading environment
 */
export const ALPACA_ENVIRONMENT = {
  PAPER: 'paper',
  LIVE: 'live',
} as const
export type AlpacaEnvironment = typeof ALPACA_ENVIRONMENT[keyof typeof ALPACA_ENVIRONMENT]

/**
 * Auth Credentials interface
 * Represents the credentials required for Alpaca API Secrets
 */
export interface AlpacaAuthCredentials {
  /** API key for authentication */
  apiKey: string
  /** Secret key for authentication */
  secretKey: string
}

/**
 * Creates a default Alpaca client configuration
 *
 * @param credentials - The authentication credentials
 * @param overrides - Optional overrides for the default configuration
 * @param environment - The Alpaca environment (default is PAPER)
 * @returns A complete Alpaca client configuration object
 * @throws {Error} If required fields are missing in credentials
 *
 * @example
 * const config = createDefaultAlpacaConfig({
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key',
 *   environment: ALPACA_ENVIRONMENT.PAPER,
 * });
 * // Instantiate a paper trading client config
 */
export const createDefaultAlpacaConfig = (
  credentials: AlpacaAuthCredentials,
  overrides?: Partial<AlpacaClientConfig>,
  environment: AlpacaEnvironment = ALPACA_ENVIRONMENT.PAPER,
): AlpacaClientConfig => {
  const baseConfig: AlpacaClientConfig = {
    ...credentials,
    environment,
    timeout: 30000,
    maxRetries: 3,
    rateLimitBuffer: 100,

    trading: {
      enabled: true,
      cacheConfig: {
        enabled: true,
        maxSize: 1000,
        defaultTtlMs: 300000, // 5 minutes
      },
      circuitBreakerConfig: {
        failureThreshold: 3,
        timeoutMs: 10000,
        recoveryTimeoutMs: 30000,
        halfOpenMaxAttempts: 1,
        resetTimeoutMs: 300000,
      },
    },

    streaming: {
      enabled: false, // Opt-in
      autoConnect: false,
      websocketConfig: {
        maxReconnectAttempts: 5,
        reconnectDelayMs: 1000,
        pingIntervalMs: 30000,
        maxQueueSize: 1000,
        connectionTimeoutMs: 10000,
        autoReconnect: true,
      },
    },

    cache: {
      enabled: true,
      maxSize: 2000,
      defaultTtlMs: 300000, // 5 minutes
      cleanupIntervalMs: 60000,
      enableLru: true,
      enableMetrics: true,
    },

    circuitBreaker: {
      failureThreshold: 5,
      timeoutMs: 15000,
      recoveryTimeoutMs: 60000,
      halfOpenMaxAttempts: 1,
      resetTimeoutMs: 600000,
    },

    requestDeduplication: {
      enabled: true,
      maxPendingRequests: 100,
      timeoutMs: 30000,
    },

    connectionPool: {
      enabled: true,
      maxConnections: 10,
      maxIdleTime: 30000,
      keepAlive: true,
      timeout: 15000,
    },

    mapping: {
      enabled: true,
      serviceConfig: {
        validateOutput: true,
        cacheEnhancements: false,
      },
      metadataCacheConfig: {
        ttlMs: 60 * 60 * 1000, // 1 hour
        useFallbackDefaults: true,
        maxRetries: 3,
      },
    },
  }

  return { ...baseConfig, ...overrides }
}
