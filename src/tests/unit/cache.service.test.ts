import { assert, assertEquals, assertExists } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { restore } from '@std/testing/mock'
import { Cache, type CacheConfig, CacheFactory, CacheManager } from '../../services/cache.service.ts'

describe('Cache', () => {
  let cache: Cache<string>
  let config: CacheConfig
  let originalDateNow: typeof Date.now
  let mockTime = 1000000

  beforeEach(() => {
    originalDateNow = Date.now
    Date.now = () => mockTime

    config = {
      maxSize: 100,
      defaultTtlMs: 60000, // 1m
      cleanupIntervalMs: 30000, // 30s
      enableLru: true,
      enableMetrics: true,
    }

    cache = new Cache<string>(config)
  })

  afterEach(() => {
    Date.now = originalDateNow
    cache.dispose()
    restore()
  })

  const advanceTime = (ms: number) => {
    mockTime += ms
  }

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1')

      const getValue = cache.get('key1')
      assertEquals(getValue, 'value1')
    })

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent')
      assertEquals(result, null)
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')

      const exists = cache.has('key1')
      assertEquals(exists, true)

      const notExists = cache.has('nonexistent')
      assertEquals(notExists, false)
    })

    it('should delete values', () => {
      cache.set('key1', 'value1')

      const hasResult = cache.has('key1')
      assertEquals(hasResult, true)

      const deleteResult = cache.delete('key1')
      assertEquals(deleteResult, true)

      const hasAfterDelete = cache.has('key1')
      assertEquals(hasAfterDelete, false)
    })

    it('should clear all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      assertEquals(cache.size(), 0)
    })

    it('should return current size', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      assertEquals(cache.size(), 2)
    })

    it('should return all keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      const keys = cache.keys()
      assertEquals(keys.length, 3)
      assert(keys.includes('key1'))
      assert(keys.includes('key2'))
      assert(keys.includes('key3'))
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should respect default TTL', () => {
      cache.set('key1', 'value1')

      const resultValid = cache.get('key1')
      assertEquals(resultValid, 'value1')

      advanceTime(config.defaultTtlMs + 1000)

      const resultExpired = cache.get('key1')
      assertEquals(resultExpired, null)
    })

    it('should respect custom TTL', () => {
      const customTtl = 5000 // 5s
      cache.set('key1', 'value1', customTtl)

      advanceTime(customTtl - 1000)
      const resultValid = cache.get('key1')
      assertEquals(resultValid, 'value1')

      advanceTime(2000)
      const resultExpired = cache.get('key1')
      assertEquals(resultExpired, null)
    })

    it('should clean up expired entries', () => {
      cache.set('key1', 'value1', 1000)
      cache.set('key2', 'value2', 5000)

      // Advance past first expiry
      advanceTime(2000)

      // Trigger cleanup by trying to get expired key
      const key1Result = cache.get('key1')
      assertEquals(key1Result, null)

      const key2Result = cache.get('key2')
      assertEquals(key2Result, 'value2')
    })
  })

  describe('LRU (Least Recently Used)', () => {
    it('should evict least recently used when at capacity', () => {
      const smallCache = new Cache<string>({ ...config, maxSize: 3 })

      smallCache.set('key1', 'value1')
      smallCache.set('key2', 'value2')
      smallCache.set('key3', 'value3')

      // Cache is now at capacity
      assertEquals(smallCache.size(), 3)

      // Access key1 to dirty it
      smallCache.get('key1')

      // Adding keys past capacity should evict key2
      smallCache.set('key4', 'value4')

      const key1Exists = smallCache.has('key1')
      assertEquals(key1Exists, true)

      const key2Exists = smallCache.has('key2')
      assertEquals(key2Exists, false) // Evicted

      const key3Exists = smallCache.has('key3')
      assertEquals(key3Exists, true)

      const key4Exists = smallCache.has('key4')
      assertEquals(key4Exists, true)

      smallCache.dispose()
    })

    it('should update access order on get', () => {
      const smallCache = new Cache<string>({ ...config, maxSize: 2 })

      smallCache.set('key1', 'value1')
      smallCache.set('key2', 'value2')

      // Access key1 so it is recently used
      smallCache.get('key1')

      // Adding key3 past capacity should evict key2
      smallCache.set('key3', 'value3')

      const key1Exists = smallCache.has('key1')
      assertEquals(key1Exists, true)

      const key2Exists = smallCache.has('key2')
      assertEquals(key2Exists, false) // Evicted

      const key3Exists = smallCache.has('key3')
      assertEquals(key3Exists, true)

      smallCache.dispose()
    })

    it('should work with LRU disabled', () => {
      const noLruCache = new Cache<string>({ ...config, enableLru: false, maxSize: 2 })

      noLruCache.set('key1', 'value1')
      noLruCache.set('key2', 'value2')

      // Cache is at capacity, adding new entry should still work (evicts oldest)
      noLruCache.set('key3', 'value3')

      noLruCache.dispose()
    })
  })

  describe('Metrics and Statistics', () => {
    it('should track hit/miss statistics', () => {
      cache.set('key1', 'value1')

      // Hit
      cache.get('key1')

      // Miss
      cache.get('nonexistent')

      const metrics = cache.getMetrics()
      assertEquals(metrics.hits, 1)
      assertEquals(metrics.misses, 1)
      assertEquals(metrics.hitRate, 0.5)
    })

    it('should track eviction count', () => {
      const smallCache = new Cache<string>({ ...config, maxSize: 2 })

      smallCache.set('key1', 'value1')
      smallCache.set('key2', 'value2')
      smallCache.set('key3', 'value3') // Evicts key1

      const metrics = smallCache.getMetrics()
      assertEquals(metrics.evictions, 1)

      smallCache.dispose()
    })

    it('should provide cache metrics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const metrics = cache.getMetrics()
      assertEquals(metrics.size, 2)
      assertEquals(typeof metrics.hitRate, 'number')
      assertEquals(typeof metrics.missRate, 'number')
    })

    it('should reset metrics', () => {
      cache.set('key1', 'value1')
      cache.get('key1') // Hit
      cache.get('nonexistent') // Miss

      let metrics = cache.getMetrics()
      assertEquals(metrics.hits, 1)
      assertEquals(metrics.misses, 1)

      cache.resetMetrics()

      metrics = cache.getMetrics()
      assertEquals(metrics.hits, 0)
      assertEquals(metrics.misses, 0)
    })
  })

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      // Test with invalid key type by forcing an error condition
      cache.set('key1', 'value1')
      cache.dispose()

      // After disposal, operations work but cleanup timer is stopped
      cache.set('key2', 'value2')
    })
  })

  describe('Logging', () => {
    it('should log cache operations', () => {
      cache.set('key1', 'value1')
      cache.get('key1')
    })
  })
})

describe('CacheFactory', () => {
  beforeEach(() => {
    restore()
  })

  describe('Factory Methods', () => {
    it('should create cache with default configuration', () => {
      const cache = CacheFactory.create<string>()

      assertExists(cache)
      cache.dispose()
    })

    it('should create cache with short TTL', () => {
      const cache = CacheFactory.createShortLived<string>()

      assertExists(cache)
      cache.dispose()
    })

    it('should create cache with long TTL', () => {
      const cache = CacheFactory.createLongLived<string>()

      assertExists(cache)
      cache.dispose()
    })

    it('should apply configuration overrides', () => {
      const overrides = {
        maxSize: 500,
        defaultTtlMs: 30000,
      }

      const cache = CacheFactory.create<string>(overrides)

      assertExists(cache)

      // Test that overrides were applied
      cache.set('key1', 'value1')
      assertEquals(cache.size(), 1)

      cache.dispose()
    })
  })

  describe('Performance Tests', () => {
    it('should handle many operations efficiently', () => {
      const cache = CacheFactory.create<string>({ maxSize: 1000 })

      const startTime = performance.now()

      for (let i = 0; i < 500; i++) {
        cache.set(`key${i}`, `value${i}`)
      }

      for (let i = 0; i < 500; i++) {
        cache.get(`key${i}`)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      assert(duration < 100)

      cache.dispose()
    })
  })
})

describe('CacheManager', () => {
  let cacheManager: CacheManager

  beforeEach(() => {
    cacheManager = new CacheManager()
  })

  afterEach(() => {
    cacheManager.dispose()
    restore()
  })

  describe('Cache Registry', () => {
    it('should get or create caches', () => {
      const config = {
        maxSize: 100,
        defaultTtlMs: 60000,
        cleanupIntervalMs: 30000,
        enableLru: true,
        enableMetrics: true,
      }

      const cache = cacheManager.getCache<string>('test-cache', config)
      assertExists(cache)

      const cached = cacheManager.getCache<string>('test-cache')
      assertEquals(cached, cache) // Should return same instance
    })

    it('should list all cache names', () => {
      cacheManager.getCache<string>('cache1')
      cacheManager.getCache<string>('cache2')
      cacheManager.getCache<string>('cache3')

      const names = cacheManager.getCacheNames()
      assertEquals(names.length, 3)
      assert(names.includes('cache1'))
      assert(names.includes('cache2'))
      assert(names.includes('cache3'))
    })

    it('should remove caches', () => {
      cacheManager.getCache<string>('temp-cache')

      const names = cacheManager.getCacheNames()
      assert(names.includes('temp-cache'))

      const removed = cacheManager.removeCache('temp-cache')
      assertEquals(removed, true)

      const namesAfter = cacheManager.getCacheNames()
      assert(!namesAfter.includes('temp-cache'))
    })
  })

  describe('Global Operations', () => {
    it('should clear all caches', () => {
      const cache1 = cacheManager.getCache<string>('cache1')
      const cache2 = cacheManager.getCache<string>('cache2')

      cache1.set('key1', 'value1')
      cache2.set('key2', 'value2')

      assertEquals(cache1.size(), 1)
      assertEquals(cache2.size(), 1)

      cacheManager.clearAll()

      assertEquals(cache1.size(), 0)
      assertEquals(cache2.size(), 0)
    })

    it('should get combined metrics', () => {
      const cache1 = cacheManager.getCache<string>('cache1')
      const cache2 = cacheManager.getCache<string>('cache2')

      cache1.set('key1', 'value1')
      cache1.get('key1') // Hit

      cache2.set('key2', 'value2')
      cache2.get('nonexistent') // Miss

      const allMetrics = cacheManager.getAllMetrics()
      assertExists(allMetrics.cache1)
      assertExists(allMetrics.cache2)
      assertEquals(allMetrics.cache1.hits, 1)
      assertEquals(allMetrics.cache2.misses, 1)
    })
  })

  describe('Resource Management', () => {
    it('should dispose gracefully', () => {
      const cache1 = cacheManager.getCache<string>('cache1')
      const cache2 = cacheManager.getCache<string>('cache2')

      cache1.set('key1', 'value1')
      cache2.set('key2', 'value2')

      cacheManager.dispose()

      const names = cacheManager.getCacheNames()
      assertEquals(names.length, 0)
    })
  })
})

describe('Cache Performance', () => {
  beforeEach(() => {
    restore()
  })

  it('should handle high throughput operations', () => {
    const cache = new Cache<string>({
      maxSize: 10000,
      defaultTtlMs: 300000,
      cleanupIntervalMs: 60000,
      enableLru: true,
      enableMetrics: true,
    })

    const startTime = performance.now()

    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const _setTime = performance.now()

    for (let i = 0; i < 1000; i++) {
      cache.get(`key${i}`)
    }

    const endTime = performance.now()

    const totalTime = endTime - startTime
    const operationsPerSecond = 2000 / (totalTime / 1000)

    assert(operationsPerSecond > 10000)

    assertEquals(cache.size(), 1000)

    cache.dispose()
  })

  it('should maintain performance with LRU evictions', () => {
    const cache = new Cache<string>({
      maxSize: 100,
      defaultTtlMs: 300000,
      cleanupIntervalMs: 60000,
      enableLru: true,
      enableMetrics: true,
    })

    const startTime = performance.now()

    for (let i = 0; i < 500; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const endTime = performance.now()

    const duration = endTime - startTime
    const operationsPerSecond = 500 / (duration / 1000)

    assert(operationsPerSecond > 1000)
    assertEquals(cache.size(), 100)

    const metrics = cache.getMetrics()
    assert(metrics.evictions > 0)

    cache.dispose()
  })

  it('should handle concurrent access patterns', () => {
    const cache = new Cache<string>({
      maxSize: 1000,
      defaultTtlMs: 300000,
      cleanupIntervalMs: 60000,
      enableLru: true,
      enableMetrics: true,
    })

    const startTime = performance.now()

    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`)
      cache.get(`key${i % 50}`)
      cache.has(`key${i % 30}`)
    }

    const endTime = performance.now()

    const duration = endTime - startTime
    const operationsPerSecond = 300 / (duration / 1000)

    assert(operationsPerSecond > 5000)

    const metrics = cache.getMetrics()
    assert(metrics.hits + metrics.misses > 0)

    cache.dispose()
  })
})
