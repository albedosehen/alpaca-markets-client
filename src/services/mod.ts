/** Service Module Exports */
export {
  Cache,
  type CacheConfig,
  type CacheError,
  type CacheFactory,
  type CacheManager,
  type CacheMetrics,
} from './cache.service.ts'

export {
  CIRCUIT_BREAKER_STATE,
  type CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
  type CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIGS,
} from './circuit-breaker.service.ts'

export {
  ConnectionPool,
  type ConnectionPoolConfig,
  ConnectionPoolFactory,
  type ConnectionPoolMetrics,
  DEFAULT_CONNECTION_POOL_CONFIG,
} from './connection-pool.service.ts'

export { MappingService, type MappingServiceConfig } from './mapping.service.ts'

export { MetadataCache, type MetadataCacheConfig } from './metadata-cache.service.ts'

export { DEFAULT_RATE_LIMITERS, type RateLimitConfig, RateLimiter } from './rate-limiter.service.ts'

export {
  DEFAULT_REQUEST_DEDUPLICATION_CONFIG,
  type RequestDeduplicationConfig,
  RequestDeduplicator,
  RequestDeduplicatorFactory,
} from './request-deduplication.service.ts'

export {
  DEFAULT_RETRY_MANAGER,
  MARKET_DATA_RETRY_MANAGER,
  type RetryConfig,
  type RetryContext,
  RetryManager,
  TRADING_RETRY_MANAGER,
} from './retry.service.ts'
