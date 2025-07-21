/**
 * Cache service for in-memory caching with TTL, LRU eviction, and metrics
 * Provides a flexible caching solution with support for time-to-live, eviction policies,
 * and metrics collection.
 * @module
 */
interface CacheEntry<T> {
  readonly value: T
  readonly expiresAt: number
  readonly createdAt: number
  readonly accessCount: number
  readonly lastAccessed: number
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in milliseconds */
  readonly defaultTtlMs: number
  /** Maximum number of entries */
  readonly maxSize: number
  /** Enable LRU eviction when max size reached */
  readonly enableLru: boolean
  /** Cleanup interval in milliseconds */
  readonly cleanupIntervalMs: number
  /** Enable cache metrics collection */
  readonly enableMetrics: boolean
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  readonly hits: number
  readonly misses: number
  readonly evictions: number
  readonly size: number
  readonly hitRate: number
  readonly missRate: number
}

/**
 * Cache error types
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'CacheError'
  }
}

/**
 * In-memory cache with TTL, LRU eviction, and metrics
 *
 * This cache supports:
 * - Time-to-live (TTL) for entries
 * - Least Recently Used (LRU) eviction policy
 * - Automatic cleanup of expired entries
 * - Metrics collection for hits, misses, and evictions
 *
 * @param {T} T - Type of cached values
 * @param {CacheConfig} config - Configuration options for the cache
 * @returns {Cache<T>} - An instance of the cache
 * @throws {CacheError} - Throws on errors during cache operations
 * @class Cache
 *
 * @example Basic usage:
 * ```typescript
 * const cache = new Cache<string>({
 *   defaultTtlMs: 300000,
 *   maxSize: 1000,
 *   enableLru: true,
 *   cleanupIntervalMs: 60000,
 *   enableMetrics: true
 * });
 *
 * cache.set('myKey', 'myValue', 60000); // Set with 1 minute TTL
 * console.log(cache.get('myKey')); // 'myValue'
 * ```
 */
export class Cache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>()
  private readonly accessOrder = new Set<string>()
  private cleanupTimer?: number
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  }

  constructor(private readonly config: CacheConfig) {
    this.startCleanupTimer()
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    try {
      const entry = this.cache.get(key)

      if (!entry) {
        this.metrics.misses++
        console.debug('Cache miss', { key })
        return null
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        this.metrics.misses++
        console.debug('Cache expired', { key, expiresAt: entry.expiresAt })
        return null
      }

      // Update access tracking
      const updatedEntry: CacheEntry<T> = {
        ...entry,
        accessCount: entry.accessCount + 1,
        lastAccessed: Date.now(),
      }
      this.cache.set(key, updatedEntry)

      // Update LRU order
      if (this.config.enableLru) {
        this.accessOrder.delete(key)
        this.accessOrder.add(key)
      }

      this.metrics.hits++
      console.debug('Cache hit', { key, accessCount: updatedEntry.accessCount })
      return entry.value
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to get cache entry: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_GET_ERROR',
        { key, error },
      )
      console.error('Cache get error', { key, error: cacheError })
      throw cacheError
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    try {
      const now = Date.now()
      const effectiveTtl = ttlMs ?? this.config.defaultTtlMs
      const expiresAt = now + effectiveTtl

      const entry: CacheEntry<T> = {
        value,
        expiresAt,
        createdAt: now,
        accessCount: 0,
        lastAccessed: now,
      }

      // Check if we need to evict entries
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        this.evictLru()
      }

      this.cache.set(key, entry)

      // Update LRU order
      if (this.config.enableLru) {
        this.accessOrder.delete(key)
        this.accessOrder.add(key)
      }

      console.debug('Cache set', { key, ttlMs: effectiveTtl, expiresAt })
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to set cache entry: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_SET_ERROR',
        { key, ttlMs, error },
      )
      console.error('Cache set error', { key, error: cacheError })
      throw cacheError
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    try {
      const existed = this.cache.delete(key)
      this.accessOrder.delete(key)

      if (existed) {
        console.debug('Cache entry deleted', { key })
      }

      return existed
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to delete cache entry: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_DELETE_ERROR',
        { key, error },
      )
      console.error('Cache delete error', { key, error: cacheError })
      throw cacheError
    }
  }

  /**
   * Check if key exists in cache and is not expired
   */
  has(key: string): boolean {
    try {
      const entry = this.cache.get(key)
      if (!entry) {
        return false
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        return false
      }

      return true
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to check cache entry: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_HAS_ERROR',
        { key, error },
      )
      console.error('Cache has error', { key, error: cacheError })
      throw cacheError
    }
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    try {
      const size = this.cache.size
      this.cache.clear()
      this.accessOrder.clear()
      console.debug('Cache cleared', { entriesRemoved: size })
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_CLEAR_ERROR',
        { error },
      )
      console.error('Cache clear error', { error: cacheError })
      throw cacheError
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      size: this.cache.size,
      hitRate: totalRequests > 0 ? this.metrics.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.metrics.misses / totalRequests : 0,
    }
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
    }
    console.debug('Cache metrics reset')
  }

  /**
   * Dispose cache and cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.cache.clear()
    this.accessOrder.clear()
    console.debug('Cache disposed')
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired()
      }, this.config.cleanupIntervalMs)
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.debug('Cleaned up expired cache entries', { cleaned })
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLru(): void {
    try {
      if (!this.config.enableLru || this.accessOrder.size === 0) {
        // If LRU is disabled, evict oldest entry by creation time
        let oldestKey: string | null = null
        let oldestTime = Number.MAX_SAFE_INTEGER

        for (const [key, entry] of this.cache.entries()) {
          if (entry.createdAt < oldestTime) {
            oldestTime = entry.createdAt
            oldestKey = key
          }
        }

        if (oldestKey) {
          this.cache.delete(oldestKey)
          this.accessOrder.delete(oldestKey)
          this.metrics.evictions++
          console.debug('Evicted oldest cache entry', { key: oldestKey })
        }
      } else {
        // Evict least recently used entry
        const lruKey = this.accessOrder.values().next().value
        if (lruKey) {
          this.cache.delete(lruKey)
          this.accessOrder.delete(lruKey)
          this.metrics.evictions++
          console.debug('Evicted LRU cache entry', { key: lruKey })
        }
      }
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to evict cache entry: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_EVICT_ERROR',
        { error },
      )
      console.error('Cache evict error', { error: cacheError })
      throw cacheError
    }
  }
}

/**
 * Cache factory with default configuration
 */
export class CacheFactory {
  /**
   * Create cache with default configuration
   */
  static create<T>(overrides?: Partial<CacheConfig>): Cache<T> {
    const defaultConfig: CacheConfig = {
      defaultTtlMs: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      enableLru: true,
      cleanupIntervalMs: 60 * 1000, // 1 minute
      enableMetrics: true,
    }

    const config = { ...defaultConfig, ...overrides }
    return new Cache<T>(config)
  }

  /**
   * Create cache with short TTL for frequently changing data
   */
  static createShortLived<T>(overrides?: Partial<CacheConfig>): Cache<T> {
    return CacheFactory.create<T>({
      defaultTtlMs: 30 * 1000, // 30 seconds
      maxSize: 500,
      cleanupIntervalMs: 10 * 1000, // 10 seconds
      ...overrides,
    })
  }

  /**
   * Create cache with long TTL for stable data
   */
  static createLongLived<T>(overrides?: Partial<CacheConfig>): Cache<T> {
    return CacheFactory.create<T>({
      defaultTtlMs: 60 * 60 * 1000, // 1 hour
      maxSize: 2000,
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      ...overrides,
    })
  }
}

/**
 * Cache manager for multiple named caches
 */
export class CacheManager {
  private readonly caches = new Map<string, Cache<unknown>>()

  constructor() {}

  /**
   * Get or create cache
   */
  getCache<T>(name: string, config?: Partial<CacheConfig>): Cache<T> {
    let cache = this.caches.get(name) as Cache<T>
    if (!cache) {
      cache = CacheFactory.create<T>(config)
      this.caches.set(name, cache as Cache<unknown>)
      console.debug('Created new cache', { name, config })
    }
    return cache
  }

  /**
   * Remove cache
   */
  removeCache(name: string): boolean {
    const cache = this.caches.get(name)
    if (cache) {
      cache.dispose()
      this.caches.delete(name)
      console.debug('Removed cache', { name })
      return true
    }
    return false
  }

  /**
   * Get all cache names
   */
  getCacheNames(): string[] {
    return Array.from(this.caches.keys())
  }

  /**
   * Get metrics for all caches
   */
  getAllMetrics(): Record<string, CacheMetrics> {
    const metrics: Record<string, CacheMetrics> = {}
    for (const [name, cache] of this.caches.entries()) {
      metrics[name] = cache.getMetrics()
    }
    return metrics
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    try {
      for (const cache of this.caches.values()) {
        cache.clear()
      }
      console.debug('Cleared all caches')
    } catch (error) {
      const cacheError = new CacheError(
        `Failed to clear all caches: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_CLEAR_ALL_ERROR',
        { error },
      )
      throw cacheError
    }
  }

  /**
   * Dispose all caches
   */
  dispose(): void {
    for (const cache of this.caches.values()) {
      cache.dispose()
    }
    this.caches.clear()
    console.debug('Cache manager disposed')
  }
}
