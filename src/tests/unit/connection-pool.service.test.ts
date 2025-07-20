import { assert, assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { restore } from '@std/testing/mock'
import {
  ConnectionPool,
  type ConnectionPoolConfig,
  ConnectionPoolFactory,
  DEFAULT_CONNECTION_POOL_CONFIG,
} from '../../services/connection-pool.service.ts'
import { AlpacaMarketError } from '../../errors/errors.ts'

describe('ConnectionPool', () => {
  let pool: ConnectionPool
  let config: ConnectionPoolConfig

  beforeEach(() => {
    config = {
      enabled: true,
      maxConnections: 3,
      maxIdleTime: 1000, // 1s
      keepAlive: true,
      timeout: 500,
    }

    pool = new ConnectionPool(config)
  })

  afterEach(() => {
    pool.close()
    restore()
  })

  describe('Basic Connection Management', () => {
    it('should create new connections for different base URLs', async () => {
      const conn1 = await pool.getConnection('https://api1.example.com')
      const conn2 = await pool.getConnection('https://api2.example.com')

      assert(conn1.id !== conn2.id)
      assertEquals(conn1.baseUrl, 'https://api1.example.com')
      assertEquals(conn2.baseUrl, 'https://api2.example.com')
      assertEquals(conn1.isActive, true)
      assertEquals(conn2.isActive, true)
    })

    it('should reuse idle connections for same base URL', async () => {
      const baseUrl = 'https://api.example.com'

      const conn1 = await pool.getConnection(baseUrl)

      pool.releaseConnection(conn1.id)

      const conn2 = await pool.getConnection(baseUrl)

      assertEquals(conn1.id, conn2.id)
      assertEquals(conn2.isActive, true)
    })

    it('should create new connection when idle one is not available', async () => {
      const baseUrl = 'https://api.example.com'

      const conn1 = await pool.getConnection(baseUrl)
      const conn2 = await pool.getConnection(baseUrl)

      assert(conn1.id !== conn2.id)
      assertEquals(conn1.baseUrl, conn2.baseUrl)
      assertEquals(conn1.isActive, true)
      assertEquals(conn2.isActive, true)
    })

    it('should handle disabled pooling', async () => {
      const disabledPool = new ConnectionPool({ ...config, enabled: false })

      const conn1 = await disabledPool.getConnection('https://api.example.com')
      const conn2 = await disabledPool.getConnection('https://api.example.com')

      // Should create new connections each time
      assert(conn1.id !== conn2.id)

      disabledPool.close()
    })
  })

  describe('Connection Pool Limits', () => {
    it('should respect maxConnections limit', async () => {
      const baseUrls = [
        'https://api1.example.com',
        'https://api2.example.com',
        'https://api3.example.com',
      ]

      // Fill connection pool
      const connections = []
      for (const url of baseUrls) {
        const conn = await pool.getConnection(url)
        connections.push(conn)
      }

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 3)
      assertEquals(metrics.activeConnections, 3)
    })

    it('should queue requests when pool is full', async () => {
      // Fill pool with active connections
      const activeConnections = []
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await pool.getConnection(`https://api${i}.example.com`)
        activeConnections.push(conn)
      }

      // This request should timeout
      const startTime = Date.now()
      try {
        await pool.getConnection('https://api-new.example.com')
        throw new Error('Should have timed out')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        const duration = Date.now() - startTime
        assert(duration >= config.timeout - 50) // Allowing timing variance
        assert(error.message.includes('timeout'))
      }
    })

    it('should process queued requests when connections are released', async () => {
      const baseUrl = 'https://api.example.com'

      // Fill connection pool
      const connections = []
      for (let i = 0; i < config.maxConnections; i++) {
        const conn = await pool.getConnection(`${baseUrl}${i}`)
        connections.push(conn)
      }

      // Release 1 connection
      pool.releaseConnection(connections[0].id)

      const startTime = Date.now()
      const newConn = await pool.getConnection(`${baseUrl}new`)
      const duration = Date.now() - startTime

      assertExists(newConn)
      assert(duration < config.timeout) // Should beat timeout
    })
  })

  describe('Request Tracking', () => {
    it('should track request counts per connection', async () => {
      const connection = await pool.getConnection('https://api.example.com')

      assertEquals(connection.requestCount, 0)

      pool.recordRequest(connection.id)
      pool.recordRequest(connection.id)
      pool.recordRequest(connection.id)

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalRequests, 3)
    })

    it('should update lastUsed timestamp when releasing connection', async () => {
      const connection = await pool.getConnection('https://api.example.com')
      const initialLastUsed = connection.lastUsed

      await new Promise((resolve) => setTimeout(resolve, 10))
      pool.releaseConnection(connection.id)

      assert(connection.lastUsed > initialLastUsed)
      assertEquals(connection.isActive, false)
    })

    it('should handle invalid connection IDs gracefully', () => {
      pool.recordRequest('non-existent-id')
      pool.releaseConnection('non-existent-id')

      const metrics = pool.getMetrics()
      assertExists(metrics)
    })
  })

  describe('Metrics Collection', () => {
    it('should provide accurate connection metrics', async () => {
      // Start with empty pool
      let metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 0)
      assertEquals(metrics.activeConnections, 0)
      assertEquals(metrics.idleConnections, 0)
      assertEquals(metrics.poolUtilization, 0)

      const conn1 = await pool.getConnection('https://api1.example.com')
      const _conn2 = await pool.getConnection('https://api2.example.com')

      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 2)
      assertEquals(metrics.activeConnections, 2)
      assertEquals(metrics.idleConnections, 0)
      assertEquals(metrics.poolUtilization, 1.0)

      pool.releaseConnection(conn1.id)

      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 2)
      assertEquals(metrics.activeConnections, 1)
      assertEquals(metrics.idleConnections, 1)
      assertEquals(metrics.poolUtilization, 0.5)
    })

    it('should track average requests per connection', async () => {
      const conn1 = await pool.getConnection('https://api1.example.com')
      const conn2 = await pool.getConnection('https://api2.example.com')

      pool.recordRequest(conn1.id)
      pool.recordRequest(conn1.id)
      pool.recordRequest(conn2.id)

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalRequests, 3)
      assertEquals(metrics.averageRequestsPerConnection, 1.5) // (3 requests / 2 connections)
    })

    it('should handle empty pool metrics', () => {
      const metrics = pool.getMetrics()

      assertEquals(metrics.totalConnections, 0)
      assertEquals(metrics.activeConnections, 0)
      assertEquals(metrics.idleConnections, 0)
      assertEquals(metrics.poolUtilization, 0)
      assertEquals(metrics.totalRequests, 0)
      assertEquals(metrics.averageRequestsPerConnection, 0)
    })
  })

  describe('Keep-Alive Configuration', () => {
    it('should report keep-alive status correctly', () => {
      assertEquals(pool.isKeepAliveEnabled(), true)

      const noKeepAlivePool = new ConnectionPool({ ...config, keepAlive: false })

      assertEquals(noKeepAlivePool.isKeepAliveEnabled(), false)
      noKeepAlivePool.close()
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should clear all connections when requested', async () => {
      // Add some connections
      await pool.getConnection('https://api1.example.com')
      await pool.getConnection('https://api2.example.com')

      let metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 2)

      pool.clear()

      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 0)
      assertEquals(metrics.totalRequests, 0)
    })

    it('should cleanup properly on close', async () => {
      await pool.getConnection('https://api.example.com')

      pool.close()

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 0)
    })
  })

  describe('Idle Connection Cleanup', () => {
    it('should clean up idle connections after timeout', async () => {
      // Pool with short idle timeout
      const shortIdlePool = new ConnectionPool({ ...config, maxIdleTime: 50 }) // 50ms

      // Add connection & release it
      const connection = await shortIdlePool.getConnection('https://api.example.com')
      shortIdlePool.releaseConnection(connection.id)

      // Connection should be idle
      let metrics = shortIdlePool.getMetrics()
      assertEquals(metrics.totalConnections, 1)
      assertEquals(metrics.idleConnections, 1)

      // Wait for disposal
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Expect no connections left
      metrics = shortIdlePool.getMetrics()
      assertEquals(metrics.totalConnections, 0)

      shortIdlePool.close()
    })

    it('should not clean up active connections', async () => {
      const _connection = await pool.getConnection('https://api.example.com')

      // Keep active connection
      let metrics = pool.getMetrics()
      assertEquals(metrics.activeConnections, 1)

      // Wait longer than the idle timeout
      await new Promise((resolve) => setTimeout(resolve, config.maxIdleTime + 100))

      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 1)
      assertEquals(metrics.activeConnections, 1)
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in connection creation gracefully', async () => {
      const conn = await pool.getConnection('https://api.example.com')
      assertExists(conn)
    })

    it('should handle queue timeout correctly', async () => {
      const shortTimeoutPool = new ConnectionPool({
        ...config,
        timeout: 50,
        maxConnections: 1,
      })

      // Fill pool with 1 connection
      await shortTimeoutPool.getConnection('https://api1.example.com')

      // Timeout from 2nd connection attempt
      const startTime = Date.now()
      try {
        await shortTimeoutPool.getConnection('https://api2.example.com')
        throw new Error('Should have timed out')
      } catch (error) {
        assertInstanceOf(error, AlpacaMarketError)
        const duration = Date.now() - startTime
        assert(duration >= 45) // Allow some timing variance
        assert(error.message.includes('timeout'))
      }

      shortTimeoutPool.close()
    })

    it('should handle concurrent access safely', async () => {
      const promises = []
      const baseUrl = 'https://api.example.com'

      // Concurrent connection requests
      for (let i = 0; i < 10; i++) {
        promises.push(pool.getConnection(baseUrl))
      }

      const results = await Promise.allSettled(promises)

      // Succeed or fail safely
      results.forEach((result) => {
        if (result.status === 'rejected') {
          assertInstanceOf(result.reason, AlpacaMarketError)
        }
      })

      // Expect pool consistent state
      const metrics = pool.getMetrics()
      assertExists(metrics)
      assert(metrics.totalConnections <= config.maxConnections)
    })
  })
})

describe('ConnectionPoolFactory', () => {
  afterEach(() => {
    restore()
  })

  describe('Factory Creation', () => {
    it('should create pool with default configuration', () => {
      const pool = ConnectionPoolFactory.create({})

      assertExists(pool)
      assertEquals(pool.isKeepAliveEnabled(), DEFAULT_CONNECTION_POOL_CONFIG.keepAlive)

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 0)

      pool.close()
    })

    it('should merge custom config with defaults', () => {
      const customConfig = {
        maxConnections: 20,
        keepAlive: false,
      }

      const pool = ConnectionPoolFactory.create(customConfig)

      assertEquals(pool.isKeepAliveEnabled(), false)
      pool.close()
    })

    it('should handle partial configuration override', () => {
      const partialConfig = {
        enabled: false,
        timeout: 5000,
      }

      const pool = ConnectionPoolFactory.create(partialConfig)

      assertExists(pool)
      assertEquals(pool.isKeepAliveEnabled(), DEFAULT_CONNECTION_POOL_CONFIG.keepAlive)

      pool.close()
    })

    it('should create independent pool instances', () => {
      const pool1 = ConnectionPoolFactory.create({ maxConnections: 5 })
      const pool2 = ConnectionPoolFactory.create({ maxConnections: 10 })

      assert(pool1 !== pool2)

      pool1.close()
      pool2.close()
    })
  })
})

describe('ConnectionPool Integration Scenarios', () => {
  let pool: ConnectionPool

  beforeEach(() => {
    pool = ConnectionPoolFactory.create({
      enabled: true,
      maxConnections: 5,
      maxIdleTime: 1000,
      keepAlive: true,
      timeout: 1000,
    })
  })

  afterEach(() => {
    pool.close()
    restore()
  })

  describe('Real-world Usage Patterns', () => {
    it('should handle typical API client usage', async () => {
      const apiClients = [
        'https://api.alpaca.markets',
        'https://data.alpaca.markets',
        'https://paper-api.alpaca.markets',
      ]

      // Multiple concurrent client requests
      const connections = []
      for (const baseUrl of apiClients) {
        const conn = await pool.getConnection(baseUrl)
        connections.push(conn)

        pool.recordRequest(conn.id)
        pool.recordRequest(conn.id)
      }

      const metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 3)
      assertEquals(metrics.activeConnections, 3)
      assertEquals(metrics.totalRequests, 6)
      assertEquals(metrics.averageRequestsPerConnection, 2)

      connections.forEach((conn) => pool.releaseConnection(conn.id))

      const finalMetrics = pool.getMetrics()
      assertEquals(finalMetrics.activeConnections, 0)
      assertEquals(finalMetrics.idleConnections, 3)
    })

    it('should handle burst traffic efficiently', async () => {
      const baseUrl = 'https://api.example.com'
      const burstSize = 20

      // Concurrent burst of requests
      const promises = Array.from({ length: burstSize }, () => pool.getConnection(baseUrl))

      const results = await Promise.allSettled(promises)

      const successfulConnections = results.filter((r) => r.status === 'fulfilled')

      // Expect clean reuse of connections
      assert(successfulConnections.length > 0)

      // Pool should not exceed max connections
      const metrics = pool.getMetrics()
      assert(metrics.totalConnections <= 5)
    })

    it('should handle mixed workload patterns', async () => {
      const baseUrls = [
        'https://trading.api.com',
        'https://market-data.api.com',
        'https://account.api.com',
      ]

      const initialConnections = []
      for (const url of baseUrls) {
        try {
          const conn = await pool.getConnection(url)
          initialConnections.push(conn)
        } catch (error) {
          // Handle potential timeout errors gracefully
          assertInstanceOf(error, AlpacaMarketError)
        }
      }

      // Record activity and release some
      initialConnections.forEach((conn, index) => {
        pool.recordRequest(conn.id)
        if (index % 2 === 0) {
          pool.releaseConnection(conn.id)
        }
      })

      // New requests (should reuse some connections)
      const phase3Results = await Promise.allSettled([
        pool.getConnection(baseUrls[0]), // -> should reuse
        pool.getConnection('https://new.api.com'), // -> new connection
      ])

      // All requests succeeded or failed gracefully
      phase3Results.forEach((result) => {
        if (result.status === 'rejected') {
          assertInstanceOf(result.reason, AlpacaMarketError)
        }
      })

      const finalMetrics = pool.getMetrics()
      assertExists(finalMetrics)
      assert(finalMetrics.totalRequests >= 3)
    })
  })

  describe('Performance and Scalability', () => {
    it('should maintain performance under load', async () => {
      const startTime = performance.now()
      const numRequests = 100

      // Create many requests
      const promises = Array.from(
        { length: numRequests },
        (_, i) => pool.getConnection(`https://api${i % 5}.example.com`),
      )

      const results = await Promise.allSettled(promises)
      const endTime = performance.now()

      const duration = endTime - startTime
      const operationsPerSecond = numRequests / (duration / 1000)

      // Handle 2 operations/second at least
      assert(operationsPerSecond > 2)

      const successful = results.filter((r) => r.status === 'fulfilled').length
      assert(successful > 0)
    })

    it('should efficiently reuse connections', async () => {
      const baseUrl = 'https://api.example.com'

      // Create, use, & release many times
      for (let i = 0; i < 10; i++) {
        try {
          const conn = await pool.getConnection(baseUrl)
          pool.recordRequest(conn.id)
          pool.releaseConnection(conn.id)
        } catch (error) {
          // Timeout gracefully
          assertInstanceOf(error, AlpacaMarketError)
        }
      }

      // Minimal connections should be created
      const metrics = pool.getMetrics()
      assert(metrics.totalConnections <= 2) // reuse of connections
      assert(metrics.totalRequests > 0)
    })

    it('should handle rapid connection churn', async () => {
      const operations = []

      // Rapidly create & release connections
      for (let i = 0; i < 50; i++) {
        operations.push(async () => {
          try {
            const conn = await pool.getConnection(`https://api${i % 3}.example.com`)
            pool.recordRequest(conn.id)

            // randomly release connections
            if (Math.random() > 0.5) {
              pool.releaseConnection(conn.id)
            }
          } catch (error) {
            // Timeout gracefully
            assertInstanceOf(error, AlpacaMarketError)
          }
        })
      }

      await Promise.all(operations.map((op) => op()))

      // Pool remains consistent
      const metrics = pool.getMetrics()
      assertExists(metrics)
      assert(metrics.totalConnections <= 5)
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle disabled pool correctly', async () => {
      const disabledPool = ConnectionPoolFactory.create({ enabled: false })

      // Works without pooling
      const conn1 = await disabledPool.getConnection('https://api.example.com')
      const conn2 = await disabledPool.getConnection('https://api.example.com')

      // Creates a new connection each time
      assert(conn1.id !== conn2.id)

      disabledPool.close()
    })

    it('should recover from clear operations', async () => {
      await pool.getConnection('https://api1.example.com')
      await pool.getConnection('https://api2.example.com')

      let metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 2)

      // Clear and verify empty
      pool.clear()
      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 0)

      // Create new connections
      const conn = await pool.getConnection('https://api.example.com')
      assertExists(conn)

      metrics = pool.getMetrics()
      assertEquals(metrics.totalConnections, 1)
    })

    it('should handle extreme configuration values', async () => {
      const extremePool = ConnectionPoolFactory.create({
        maxConnections: 1,
        maxIdleTime: 10, // 10ms
        timeout: 10, // 10ms
      })

      // Still receive connections
      const conn = await extremePool.getConnection('https://api.example.com')
      assertExists(conn)

      extremePool.close()
    })
  })
})
