/**
 * Connection pool service for managing HTTP connections
 * Optimizes API requests by reusing connections to reduce overhead and improve performance
 * Supports connection pooling with configurable limits, idle timeouts, and keep-alive options.
 * @module
 */
import { AlpacaMarketError } from '../errors/errors.ts'

/**
 * Configuration for HTTP connection pooling
 */
export interface ConnectionPoolConfig {
  enabled: boolean
  maxConnections: number
  maxIdleTime: number // milliseconds
  keepAlive: boolean
  timeout: number // milliseconds
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolConfig = {
  enabled: true,
  maxConnections: 10,
  maxIdleTime: 30000, // 30 seconds
  keepAlive: true,
  timeout: 15000, // 15 seconds
}

/**
 * Connection pool entry
 */
interface PooledConnection {
  id: string
  baseUrl: string
  lastUsed: number
  isActive: boolean
  requestCount: number
}

/**
 * Connection pool metrics
 */
export interface ConnectionPoolMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  poolUtilization: number
  totalRequests: number
  averageRequestsPerConnection: number
}

/**
 * HTTP connection pool for optimizing API requests
 * Manages reusable connections to reduce overhead and improve performance
 */
export class ConnectionPool {
  private connections = new Map<string, PooledConnection>()
  private requestQueue: Array<{
    resolve: (connection: PooledConnection) => void
    reject: (error: AlpacaMarketError) => void
    baseUrl: string
    timeoutId: number
  }> = []
  private totalRequests = 0
  private cleanupIntervalId?: number

  constructor(private config: ConnectionPoolConfig) {
    // Start cleanup timer if pooling is enabled
    if (this.config.enabled) {
      this.startCleanupTimer()
    }
  }

  /**
   * Get or create a connection for the specified base URL
   */
  async getConnection(baseUrl: string): Promise<PooledConnection> {
    if (!this.config.enabled) {
      // If pooling is disabled, create a simple connection object
      return {
        id: crypto.randomUUID(),
        baseUrl,
        lastUsed: Date.now(),
        isActive: true,
        requestCount: 0,
      }
    }

    return this.findOrCreateConnection(baseUrl)
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string): void {
    const connection = this.findConnectionById(connectionId)
    if (connection) {
      connection.isActive = false
      connection.lastUsed = Date.now()

      // Process any queued requests that can now be satisfied
      this.processQueue()
    }
  }

  /**
   * Record that a request was made using this connection
   */
  recordRequest(connectionId: string): void {
    const connection = this.findConnectionById(connectionId)
    if (connection) {
      connection.requestCount++
      this.totalRequests++
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    const connections = Array.from(this.connections.values())
    const activeConnections = connections.filter((c) => c.isActive).length
    const totalConnections = connections.length
    const idleConnections = totalConnections - activeConnections

    const totalRequestsAcrossConnections = connections.reduce(
      (sum, conn) => sum + conn.requestCount,
      0,
    )

    return {
      totalConnections,
      activeConnections,
      idleConnections,
      poolUtilization: totalConnections > 0 ? activeConnections / totalConnections : 0,
      totalRequests: this.totalRequests,
      averageRequestsPerConnection: totalConnections > 0 ? totalRequestsAcrossConnections / totalConnections : 0,
    }
  }

  /**
   * Clear all connections and reset the pool
   */
  clear(): void {
    this.connections.clear()
    this.requestQueue.length = 0
    this.totalRequests = 0
  }

  /**
   * Check if keep-alive is enabled
   */
  isKeepAliveEnabled(): boolean {
    return this.config.keepAlive
  }

  /**
   * Close the connection pool and cleanup resources
   */
  close(): void {
    this.clear()
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = undefined
    }
  }

  /**
   * Find or create a connection for the base URL
   */
  private async findOrCreateConnection(baseUrl: string): Promise<PooledConnection> {
    // Look for an available idle connection for this base URL
    const availableConnection = this.findIdleConnection(baseUrl)
    if (availableConnection) {
      availableConnection.isActive = true
      availableConnection.lastUsed = Date.now()
      return availableConnection
    }

    // Check if we can create a new connection
    if (this.connections.size < this.config.maxConnections) {
      const newConnection = this.createConnection(baseUrl)
      return newConnection
    }

    // If at limit, try to repurpose an idle connection from a different baseUrl
    const anyIdleConnection = Array.from(this.connections.values()).find((conn) => !conn.isActive)
    if (anyIdleConnection) {
      // Remove the old connection and create a new one for this baseUrl
      this.connections.delete(anyIdleConnection.id)
      const newConnection = this.createConnection(baseUrl)
      return newConnection
    }

    // Pool is full, queue the request
    return new Promise<PooledConnection>((resolve, reject) => {
      let resolved = false

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          const index = this.requestQueue.findIndex((req) => req.timeoutId === timeoutId)
          if (index >= 0) {
            this.requestQueue.splice(index, 1)
          }
          reject(new AlpacaMarketError('Connection pool timeout', { category: 'timeout' }))
        }
      }, this.config.timeout)

      this.requestQueue.push({
        resolve: (connection: PooledConnection) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            resolve(connection)
          }
        },
        reject: (error: AlpacaMarketError) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            reject(error)
          }
        },
        baseUrl,
        timeoutId,
      })
    })
  }

  /**
   * Find an idle connection for the specified base URL
   */
  private findIdleConnection(baseUrl: string): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.baseUrl === baseUrl && !connection.isActive) {
        return connection
      }
    }
    return null
  }

  /**
   * Find a connection by ID
   */
  private findConnectionById(connectionId: string): PooledConnection | null {
    return this.connections.get(connectionId) || null
  }

  /**
   * Create a new connection
   */
  private createConnection(baseUrl: string): PooledConnection {
    const connection: PooledConnection = {
      id: crypto.randomUUID(),
      baseUrl,
      lastUsed: Date.now(),
      isActive: true,
      requestCount: 0,
    }

    this.connections.set(connection.id, connection)
    return connection
  }

  /**
   * Process queued requests that can be satisfied
   */
  private async processQueue(): Promise<void> {
    // Process all queued requests that can be satisfied when a connection is released
    while (this.requestQueue.length > 0) {
      // Check if we can satisfy any queued request
      // We can satisfy a request if:
      // 1. There's an idle connection for that baseUrl, OR
      // 2. We have room to create a new connection (under maxConnections limit)
      const queueIndex = this.requestQueue.findIndex((req) => {
        const availableConnection = this.findIdleConnection(req.baseUrl)
        const canCreateNew = this.connections.size < this.config.maxConnections
        return availableConnection || canCreateNew
      })

      // If no request can be satisfied, stop processing
      if (queueIndex < 0) {
        break
      }

      // Remove and process the queued request
      const queuedRequest = this.requestQueue.splice(queueIndex, 1)[0]
      clearTimeout(queuedRequest.timeoutId)

      try {
        const connection = await this.findOrCreateConnection(queuedRequest.baseUrl)
        queuedRequest.resolve(connection)
      } catch (error) {
        queuedRequest.reject(
          error instanceof AlpacaMarketError
            ? error
            : new AlpacaMarketError(`Connection pool error: ${error}`, { category: 'network' }),
        )
        break // Stop processing on error to prevent cascading failures
      }
    }
  }

  /**
   * Start the cleanup timer to remove idle connections
   */
  private startCleanupTimer(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupIdleConnections()
    }, this.config.maxIdleTime / 2) // Check twice as often as the idle timeout
  }

  /**
   * Remove connections that have been idle too long
   */
  private cleanupIdleConnections(): void {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [id, connection] of this.connections.entries()) {
      if (
        !connection.isActive &&
        (now - connection.lastUsed) > this.config.maxIdleTime
      ) {
        connectionsToRemove.push(id)
      }
    }

    if (connectionsToRemove.length > 0) {
      connectionsToRemove.forEach((id) => {
        this.connections.delete(id)
      })
    }
  }
}

/**
 * Factory for creating connection pool instances
 */
export const ConnectionPoolFactory = {
  create: (
    config: Partial<ConnectionPoolConfig>,
  ): ConnectionPool => {
    const finalConfig = {
      ...DEFAULT_CONNECTION_POOL_CONFIG,
      ...config,
    }

    return new ConnectionPool(finalConfig)
  },
}
