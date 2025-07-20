import type { AlpacaClientConfig as AlpacaMarketClientConfig, AlpacaEnvironment } from './alpaca.types.ts'
import { createTradingClient } from '../endpoints/trade/trade-endpoint-helpers.ts'
import { AlpacaTradeEndpoint } from '../endpoints/trade/trade-endpoint.ts'
import { MarketDataEndpoint } from '../endpoints/market/market-endpoint.ts'
import { AlpacaMarketStreamEndpoint } from '../endpoints/stream/stream-endpoint.ts'
import { AlpacaStreamFactory } from '../endpoints/stream/stream-endpoint-helpers.ts'
import { type WebSocketEventHandlers } from '../types/websocket.ts'
import { AlpacaMarketError, AlpacaMarketErrorContext } from '../errors/errors.ts'
import { Cache } from '../services/cache.service.ts'
import { CircuitBreaker } from '../services/circuit-breaker.service.ts'
import { RequestDeduplicator } from '../services/request-deduplication.service.ts'
import { ConnectionPool } from '../services/connection-pool.service.ts'
import { MappingService } from '../services/mapping.service.ts'
import { MetadataCache } from '../services/metadata-cache.service.ts'

/**
 * Enhanced Alpaca client with integrated trading, market data, and streaming capabilities
 *
 * This client provides a unified interface for accessing Alpaca's trading and market data APIs,
 * along with advanced features like caching, circuit breaking, request deduplication, and connection pooling
 * to optimize performance and reliability.
 *
 * It supports both paper and live trading environments, and can be extended with additional services
 * such as mapping and metadata caching for enhanced data handling.
 *
 * @param {AlpacaMarketClientConfig} config - Configuration options for the Alpaca client
 * @returns {AlpacaMarketClient} - An instance of the Alpaca market client
 * @throws {AlpacaMarketError} - Throws an error if the configuration is invalid or required features are not enabled
 *
 * @example Basic Usage
 * ```typescript
 * import { AlpacaClient, createDefaultAlpacaConfig } from './alpaca-markets/mod.ts'
 *
 * const config = createDefaultAlpacaConfig({
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key'
 * }, 'paper')
 *
 * const client = new AlpacaClient(config)
 *
 * // Trading API operations
 * const order = await client.trading.createOrder({
 *   symbol: 'NVDA',
 *   qty: '1',
 *   side: 'buy',
 *   type: 'market',
 *   time_in_force: 'day'
 * })
 *
 * // Market Data API operations
 * const bars = await client.marketDataClient.getLatestBars({ symbols: ['NVDA'] })
 *
 * // WebSocket Streaming Client operations
 * await client.connectStream()
 * await client.streaming.subscribe({ type: 'trades', symbols: ['NVDA'] })
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * const advancedConfig = createDefaultAlpacaMarketConfig({
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key'
 * }, 'paper', {
 *   trading: {
 *     enabled: true,
 *     cacheConfig: { enabled: true, defaultTtlMs: 60000 },
 *     circuitBreakerConfig: { failureThreshold: 5, timeoutMs: 15000 }
 *   },
 *   streaming: {
 *     enabled: true,
 *     autoConnect: true,
 *     eventHandlers: {
 *       onMessage: (msg) => console.log('Market update:', msg),
 *       onError: (err) => console.error('Stream error:', err)
 *     }
 *   }
 * })
 *
 * const client = new AlpacaMarketClient(advancedConfig)
 * ```
 *
 * @example High-Frequency Trading Setup
 * ```typescript
 * import { createHighFrequencyTradingClient } from './alpaca-markets/mod.ts'
 *
 * const hftClient = createHighFrequencyTradingClient(
 *   client,
 *   client.getLogger(),
 *   {
 *     cacheConfig: { enabled: true, defaultTtlMs: 30000 },
 *     circuitBreakerConfig: { failureThreshold: 2, timeoutMs: 5000 }
 *   }
 * )
 * ```
 */
export class AlpacaMarketClient {
  private readonly config: AlpacaMarketClientConfig
  private readonly baseUrl: string
  private readonly dataUrl: string

  private tradingEndpoint?: AlpacaTradeEndpoint
  private marketData: MarketDataEndpoint
  private streamingClient?: AlpacaMarketStreamEndpoint
  private globalCache?: Cache<unknown>
  private globalCircuitBreaker?: CircuitBreaker
  private requestDeduplicator?: RequestDeduplicator
  private connectionPool?: ConnectionPool
  private _metadataCache?: MetadataCache
  private _mappingService?: MappingService

  constructor(config: AlpacaMarketClientConfig) {
    this.config = config
    this.baseUrl = config.baseUrl || this.getDefaultTradingBaseUrl(config.environment)
    this.dataUrl = config.dataUrl || this.getDefaultMarketDataUrl(config.environment)

    this.initializeAdvancedFeatures()

    this.marketData = new MarketDataEndpoint(this, this._mappingService)
    /*console.debug('AlpacaClient initialized', {
      environment: config.environment,
      baseUrl: this.baseUrl,
      dataUrl: this.dataUrl,
      tradingEnabled: !!this.tradingClient,
      streamingEnabled: !!this.streamingClient,
      cacheEnabled: !!this.globalCache,
      circuitBreakerEnabled: !!this.globalCircuitBreaker,
      requestDeduplicationEnabled: !!this.requestDeduplicator,
      connectionPoolEnabled: !!this.connectionPool,
      mappingEnabled: !!this._mappingService,
      metadataCacheEnabled: !!this._metadataCache,
    })*/
  }

  /**
   * Initialize advanced features based on configuration
   *
   * This method sets up the global cache, circuit breaker, request deduplicator,
   * connection pool, mapping service, and metadata cache if they are enabled in the configuration.
   * It also initializes the trading client and streaming client if they are enabled.
   *
   * @throws {AlpacaMarketError} - Throws an error if required features are
   * @private
   */
  private initializeAdvancedFeatures(): void {
    // Initialize global cache (TODO: Move this to a private initializer private initializeGlobalCache)
    if (this.config.cache?.enabled) {
      this.globalCache = new Cache(
        {
          defaultTtlMs: this.config.cache.defaultTtlMs ?? 300000,
          maxSize: this.config.cache.maxSize ?? 2000,
          enableLru: this.config.cache.enableLru ?? true,
          cleanupIntervalMs: this.config.cache.cleanupIntervalMs ?? 60000,
          enableMetrics: this.config.cache.enableMetrics ?? true,
        },
      )
    }

    // Initialize global circuit breaker (TODO: Move this to a private initializer private initializeGlobalCircuitBreaker)
    if (this.config.circuitBreaker) {
      this.globalCircuitBreaker = new CircuitBreaker(
        this.config.circuitBreaker,
        undefined,
      )
    }

    // Initialize mapping service and metadata cache (TODO: Move this to a private initializer private initializeMappingServiceAndMetadataCache)
    if (this.config.mapping?.enabled) {
      const metadataCacheConfig = {
        ttlMs: this.config.mapping.metadataCacheConfig?.ttlMs ?? 60 * 60 * 1000, // 1 hour
        useFallbackDefaults: this.config.mapping.metadataCacheConfig?.useFallbackDefaults ?? true,
        maxRetries: this.config.mapping.metadataCacheConfig?.maxRetries ?? 3,
      }

      this._metadataCache = new MetadataCache(metadataCacheConfig)

      const mappingServiceConfig = {
        defaultEnhancementConfig: this.config.mapping.serviceConfig?.defaultEnhancementConfig ?? {
          includeExchangeNames: true,
          includeTapeDescriptions: true,
          includeConditionNames: true,
          includeConditionDescriptions: false,
          includeMappingStatus: false,
          logUnmappedCodes: false,
        },
        validateOutput: this.config.mapping.serviceConfig?.validateOutput ?? true,
        cacheEnhancements: this.config.mapping.serviceConfig?.cacheEnhancements ?? false,
      }

      this._mappingService = new MappingService(
        this._metadataCache,
        mappingServiceConfig,
      )
    }

    // Initialize trading client (TODO: Move this to a private initializer private initializeTradingClient)
    if (this.config.trading?.enabled) {
      this.tradingEndpoint = createTradingClient(
        this,
        this.config.trading,
      )
    }

    // Initialize streaming client (TODO: Move this to a private initializer private initializeStreamingClient)
    if (this.config.streaming?.enabled) {
      const defaultHandlers: WebSocketEventHandlers = {
        onConnect: () => console.info('WebSocket connected'),
        onDisconnect: (reason) => console.info('WebSocket disconnected', { reason }),
        onError: (error) => console.error('WebSocket error', { error }),
        onReconnect: (attempt) => console.info('WebSocket reconnecting', { attempt }),
        ...this.config.streaming.eventHandlers,
      }

      this.streamingClient = AlpacaStreamFactory.create(
        this.config,
        defaultHandlers,
        this.config.streaming.websocketConfig,
      )

      // Auto-connect if configured
      if (this.config.streaming.autoConnect) {
        this.streamingClient.connect().catch((error) => {
          console.error('Failed to auto-connect WebSocket', { error })
        })
      }
    }
  }
  /**
   * Get trading client (requires trading to be enabled in config)
   *
   * This method provides access to the trading client for executing trades,
   * managing accounts, and accessing trading-related endpoints.
   */
  get trading(): AlpacaTradeEndpoint {
    if (!this.tradingEndpoint) {
      throw new AlpacaMarketError('Trading client not enabled. Set trading.enabled = true in config.')
    }
    return this.tradingEndpoint
  }

  /**
   * Get market data endpoints (requires market data to be enabled in config)
   *
   * This method provides access to market data endpoints for retrieving
   * historical bars, quotes, trades, and other market data.
   */
  get marketDataClient(): MarketDataEndpoint {
    return this.marketData
  }

  /**
   * Get mapping service (requires mapping to be enabled in config)
   *
   * This method provides access to the mapping service for enhancing
   * market data with additional metadata such as exchange names, tape descriptions,
   * and condition names.
   */
  get mappingService(): MappingService {
    if (!this._mappingService) {
      throw new AlpacaMarketError('Mapping service not enabled. Set mapping.enabled = true in config.')
    }
    return this._mappingService
  }

  /**
   * Get metadata cache (requires mapping to be enabled in config)
   *
   * This method provides access to the metadata cache for caching
   * metadata such as exchange information, tape descriptions, and condition codes.
   */
  get metadataCache(): MetadataCache {
    if (!this._metadataCache) {
      throw new AlpacaMarketError('Metadata cache not enabled. Set mapping.enabled = true in config.')
    }
    return this._metadataCache
  }

  /**
   * Get WebSocket client (requires streaming to be enabled in config)
   *
   * This method provides access to the WebSocket client for subscribing to real-time
   * market data updates such as trades, quotes, and bars.
   */
  get ws(): AlpacaMarketStreamEndpoint {
    if (!this.streamingClient) {
      throw new AlpacaMarketError('Streaming client not enabled. Set streaming.enabled = true in config.')
    }
    return this.streamingClient
  }

  /**
   * Connect the WebSocket client to the Alpaca Market streaming API
   *
   * This method connects to the Alpaca streaming API to receive real-time updates.
   * It requires the streaming client to be initialized and enabled in the configuration.
   */
  async connectToMarketStream(): Promise<void> {
    if (!this.streamingClient) {
      throw new AlpacaMarketError('Streaming client not enabled')
    }
    return await this.streamingClient.connect()
  }

  /**
   * Disconnect the WebSocket client from the Alpaca Market streaming API
   */
  async disconnectFromMarketStream(): Promise<void> {
    if (!this.streamingClient) {
      return
    }
    return await this.streamingClient.disconnect()
  }

  /**
   * Check if the WebSocket client is connected to Alpaca Market streaming API
   */
  isMarketStreamConnected(): boolean {
    return this.streamingClient?.isConnected() ?? false
  }

  /**
   * Test connectivity to Alpaca Market APIs
   *
   * This method checks if the trading, market data, and streaming APIs are reachable.
   * It returns an object indicating the connectivity status for each API.
   */
  async testClientConnections(): Promise<{ trading: boolean; marketData: boolean; streaming: boolean }> {
    const tradingTest = this.tradingEndpoint
      ? this.tradingEndpoint.getAccount().then(() => true).catch(() => false)
      : Promise.resolve(false)

    const marketDataTest = this.marketData.getLatestBars({ symbols: ['NVDA'] })
      .then(() => true)
      .catch(() => false)

    const streamingTest = Promise.resolve(this.isMarketStreamConnected())

    const [trading, marketData, streaming] = await Promise.all([tradingTest, marketDataTest, streamingTest])

    return {
      trading,
      marketData,
      streaming,
    }
  }

  /**
   * Get comprehensive client health and metrics
   *
   * This method provides detailed health metrics for the Alpaca Market client,
   * including trading, streaming, cache, circuit breaker, request deduplication,
   * connection pool, mapping service, and metadata cache.
   */
  getHealthMetrics() {
    return {
      client: {
        environment: this.config.environment,
        baseUrl: this.baseUrl,
        dataUrl: this.dataUrl,
      },
      trading: this.tradingEndpoint?.getMetrics(),
      streaming: this.streamingClient?.getMetrics(),
      cache: this.globalCache?.getMetrics(),
      circuitBreaker: this.globalCircuitBreaker?.getMetrics(),
      requestDeduplication: this.requestDeduplicator?.getMetrics(),
      connectionPool: this.connectionPool?.getMetrics(),
      mapping: this._mappingService
        ? {
          enhancementCacheStats: this._mappingService.getCacheStats(),
        }
        : undefined,
      metadataCache: this._metadataCache
        ? {
          cacheStats: this._metadataCache.getCacheStats(),
        }
        : undefined,
    }
  }

  /**
   * Get default base URL for trading API based on environment
   *
   * @private
   */
  private getDefaultTradingBaseUrl(environment: AlpacaEnvironment): string {
    switch (environment) {
      case 'paper':
        return 'https://paper-api.alpaca.markets'
      case 'live':
        return 'https://api.alpaca.markets'
      default:
        throw new AlpacaMarketError(`Invalid environment: ${environment}`)
    }
  }

  /**
   * Get default data URL for market data API based on environment
   *
   * @private
   */
  private getDefaultMarketDataUrl(_environment: AlpacaEnvironment): string {
    // Market data API is the same for both environments
    return 'https://data.alpaca.markets'
  }

  /**
   * Execute a request to the Alpaca Market API with advanced features
   *
   * This method allows you to make API requests with support for circuit breaking,
   * request deduplication, and connection pooling.
   *
   * @param {string} endpoint - The API endpoint to call
   * @param {Object} options - Request options including method, body, params, and
   * @returns {Promise<T>} - The response data from the API
   * @throws {AlpacaMarketError} - Throws an error if the request fails
   *
   * @example * Make a GET request to the account endpoint
   * const account = await client.request('/v2/account', { method: 'GET' })
   * console.log('Account data:', account) // { id: '...', cash: '1000.00', ... }
   *
   * @example * Make a POST request to create an order
   * const order = await client.request('/v2/orders', {
   *  method: 'POST',
   *  body: {
   *   symbol: 'NVDA',
   *   qty: 1,
   *   side: 'buy',
   *   type: 'market',
   *   time_in_force: 'gtc',
   *  },
   * useDataUrl: false, // Use trading API base URL
   * })
   *
   * @example * Make a request to the market data API
   * const bars = await client.request('/v2/stocks/NVDA/bars', {
   *  method: 'GET',
   *  params: { timeframe: 'day' },
   *  useDataUrl: true, // Use market data API base URL
   * })
   */
  async request<T = unknown>(
    endpoint: string,
    options: {
      method?: string
      body?: unknown
      params?: Record<string, unknown>
      useDataUrl?: boolean
    } = {},
  ): Promise<T> {
    const { method = 'GET', body, params, useDataUrl = false } = options
    const baseUrl = useDataUrl ? this.dataUrl : this.baseUrl

    const executeOptimizedRequest = async (): Promise<T> => {
      if (this.globalCircuitBreaker) {
        return await this.globalCircuitBreaker.execute(async () => {
          try {
            return await this.executeRequest<T>(baseUrl, endpoint, { method, body, params })
          } catch (error) {
            throw AlpacaMarketErrorContext.enrichError(error, { operation: 'request' })
          }
        })
      }

      return await this.executeRequest<T>(baseUrl, endpoint, { method, body, params })
    }

    if (this.requestDeduplicator && method === 'GET' && !body) {
      const requestKey = RequestDeduplicator.generateKey(method, endpoint, params)
      return await this.requestDeduplicator.deduplicate(requestKey, executeOptimizedRequest)
    }

    return await executeOptimizedRequest()
  }

  /**
   * Internal request execution with proper error handling and connection pooling
   *
   * This method handles the actual HTTP request execution,
   * including connection pooling and error handling.
   *
   * @param {string} baseUrl - The base URL for the API
   * @param {string} endpoint - The API endpoint to call
   * @param {Object} options - Request options including method, body, and params
   * @private
   */
  private async executeRequest<T>(
    baseUrl: string,
    endpoint: string,
    options: {
      method: string
      body?: unknown
      params?: Record<string, unknown>
    },
  ): Promise<T> {
    const { method, body, params } = options
    const url = new URL(endpoint, baseUrl)

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const headers: Record<string, string> = {
      'APCA-API-KEY-ID': this.config.apiKey,
      'APCA-API-SECRET-KEY': this.config.secretKey,
      'Content-Type': 'application/json',
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    }

    // Add connection pooling headers if using keep-alive
    if (this.connectionPool?.isKeepAliveEnabled()) {
      headers['Connection'] = 'keep-alive'
    }

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body)
    }

    console.debug('Executing request', {
      method,
      url: url.toString(),
      hasBody: !!body,
    })

    /** Get a connection from the pool if available */
    const getConnection = async (): Promise<{ id: string } | null> => {
      if (!this.connectionPool) {
        return null
      }

      try {
        const conn = await this.connectionPool.getConnection(baseUrl)
        return { id: conn.id }
      } catch (error) {
        console.warn('Failed to get connection from pool', {
          error: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    }

    /** Execute the HTTP request with connection management */
    const executeHttpRequest = async (connection: { id: string } | null): Promise<T> => {
      try {
        const response = await fetch(url.toString(), requestOptions)

        if (connection && this.connectionPool) {
          this.connectionPool.recordRequest(connection.id)
          this.connectionPool.releaseConnection(connection.id)
        }

        if (!response.ok) {
          const errorBody = await response.text()
          throw new AlpacaMarketError(
            `HTTP ${response.status}: ${response.statusText}`,
            {
              status: response.status,
              url: url.toString(),
              responseBody: errorBody,
            },
          )
        }

        const result = await response.json()

        /*console.debug('Request completed successfully', {
          method,
          url: url.toString(),
          status: response.status,
          connectionId: connection?.id,
        })*/

        return result as T
      } catch (error) {
        // Release connection on error
        if (connection && this.connectionPool) {
          this.connectionPool.releaseConnection(connection.id)
        }
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'executeRequest',
          metadata: { method, url: url.toString() },
        })
      }
    }

    /** Chain connection acquisition and request execution */
    const connection = await getConnection()
    return await executeHttpRequest(connection)
  }

  /**
   * Get the Client configuration
   */
  getConfig(): AlpacaMarketClientConfig {
    return { ...this.config }
  }

  /**
   * Returns a basic logger with context sharing and child logging capabilities
   *
   * Logging methods include:
   * - debug: For detailed debugging information
   * - info: For general informational messages
   * - warn: For warning messages that may indicate potential issues
   * - error: For error messages that indicate failures or exceptions
   * - child: For creating child loggers with additional context
   */
  getLogger() {
    // TODO(@albedosehen): Move all of this into a utility module and expose the interface for the user in case they do not bring their own logger
    interface AlpacaMarketLogger {
      debug: (message: string, context?: Record<string, unknown>) => void
      info: (message: string, context?: Record<string, unknown>) => void
      warn: (message: string, context?: Record<string, unknown>) => void
      error: (message: string, context?: Record<string, unknown>) => void
      child: (context: Record<string, unknown>) => AlpacaMarketLogger
    }

    const createLogger = (prefix: string, baseContext: Record<string, unknown> = {}): AlpacaMarketLogger => ({
      debug: (message: string, context?: Record<string, unknown>) =>
        console.debug(`${prefix} ${message}`, { ...baseContext, ...(context || {}) }),
      info: (message: string, context?: Record<string, unknown>) =>
        console.info(`${prefix} ${message}`, { ...baseContext, ...(context || {}) }),
      warn: (message: string, context?: Record<string, unknown>) =>
        console.warn(`${prefix} ${message}`, { ...baseContext, ...(context || {}) }),
      error: (message: string, context?: Record<string, unknown>) =>
        console.error(`${prefix} ${message}`, { ...baseContext, ...(context || {}) }),
      child: (childContext: Record<string, unknown>) => createLogger(prefix, { ...baseContext, ...childContext }),
    })

    return createLogger('[AlpacaClient]')
  }

  /**
   * Primary cleanup method to release all resources and connections
   *
   * This method should be called when the AlpacaMarketClient is no longer needed.
   * It will clean up all resources, including all clients and their connections, and any other resources.
   */
  async dispose(): Promise<void> {
    console.info('Disposing AlpacaClient')

    const cleanupTasks: Promise<void>[] = []

    if (this.tradingEndpoint) {
      this.tradingEndpoint.destroy()
    }

    if (this.streamingClient) {
      cleanupTasks.push(this.streamingClient.disconnect())
      this.streamingClient.dispose()
    }

    if (this.globalCache) {
      this.globalCache.dispose()
    }

    if (this.globalCircuitBreaker) {
      this.globalCircuitBreaker.reset()
    }

    if (this.requestDeduplicator) {
      this.requestDeduplicator.clear()
    }

    if (this.connectionPool) {
      this.connectionPool.close()
    }

    if (this._mappingService) {
      this._mappingService.clearCache()
    }

    if (this._metadataCache) {
      this._metadataCache.clearCache()
    }

    if (cleanupTasks.length > 0) {
      await Promise.all(cleanupTasks)
    }
  }

  /**
   * Reset all AlpacaMarketClient components
   *
   * This method resets the client state, clears caches, and reinitializes advanced features.
   * It is useful for scenarios where the client needs to be reset without full disposal.
   */
  async reset(): Promise<void> {
    await this.dispose()
    this.initializeAdvancedFeatures()
  }
}
