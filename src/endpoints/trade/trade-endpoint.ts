import { AlpacaMarketError, AlpacaMarketErrorContext } from '../../errors/errors.ts'
import { AlpacaMarketClient } from '../../client/alpaca.ts'
import { Cache } from '../../services/cache.service.ts'
import { CircuitBreaker } from '../../services/circuit-breaker.service.ts'
import { RequestDeduplicator, RequestDeduplicatorFactory } from '../../services/request-deduplication.service.ts'
import { ConnectionPool, ConnectionPoolFactory } from '../../services/connection-pool.service.ts'
import { assertArray, assertString } from '../../validators/asserts.ts'
import { validateAccount, validateAccountActivityArray } from '../../validators/accountValidators.ts'
import { validateOrder, validateOrderArray } from '../../validators/orderValidators.ts'
import { validatePosition, validatePositionArray } from '../../validators/positionValidators.ts'
import type { CreateOrderRequest, GetOrdersParams, Order, UpdateOrderRequest } from '../../types/order.ts'
import type { ClosePositionRequest, Position } from '../../types/position.ts'
import type { Account, AccountActivity } from '../../types/account.ts'
import type { GetAccountActivitiesParams, TradingClientConfig } from './trade-endpoint.types.ts'

/**
 * Alpaca Trading API client
 *
 * Provides methods for managing orders, positions, and account information
 *
 * @param {AlpacaMarketClient} apiClient - The Alpaca API client instance
 * @param {TradingClientConfig} [config] - Optional configuration for the trading client
 * @returns {AlpacaTradeEndpoint} - An instance of the trading client
 * @class AlpacaTradeEndpoint
 *
 * @example Basic usage:
 * ```typescript
 * const apiClient = new AlpacaMarketClient();
 * const tradeClient = new AlpacaTradeEndpoint(apiClient);
 *
 * // Create a new order
 * const order = await tradeClient.createOrder({
 *  symbol: 'NVDA',
 * side: 'buy',
 * type: 'market',
 * quantity: 10,
 * });
 * console.log('Created order:', order);
 * ```
 */
export class AlpacaTradeEndpoint {
  private cache?: Cache<Order | Position | Account | AccountActivity | Order[] | Position[] | AccountActivity[]>
  private circuitBreaker?: CircuitBreaker
  private requestDeduplicator?: RequestDeduplicator
  private connectionPool?: ConnectionPool

  constructor(
    private readonly apiClient: AlpacaMarketClient,
    config?: TradingClientConfig,
  ) {
    if (config?.cacheConfig?.enabled) {
      this.cache = new Cache(
        {
          defaultTtlMs: config.cacheConfig.defaultTtlMs ?? 300000,
          maxSize: config.cacheConfig.maxSize ?? 1000,
          enableLru: true,
          cleanupIntervalMs: 60000,
          enableMetrics: true,
        },
      )
    }

    if (config?.circuitBreakerConfig) {
      this.circuitBreaker = new CircuitBreaker(
        config.circuitBreakerConfig,
      )
    }

    if (config?.requestDeduplicationConfig?.enabled) {
      this.requestDeduplicator = RequestDeduplicatorFactory.create(
        config.requestDeduplicationConfig,
      )
    }

    if (config?.connectionPoolConfig?.enabled) {
      this.connectionPool = ConnectionPoolFactory.create(
        config.connectionPoolConfig,
      )
    }
  }

  /**
   * Execute operation with circuit breaker protection
   *
   * @private
   */
  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    // TODO(@albedosehen): Implement circuit breaker logic when ready
    return operation()
  }

  /**
   * Creates a new order in Alpaca's trading system.
   *
   * @param {CreateOrderRequest} orderRequest - The order request data
   * @returns {Promise<Order>} - The created order
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the order data is invalid
   */
  async createOrder(orderRequest: CreateOrderRequest): Promise<Order> {
    console.info('Creating order', { symbol: orderRequest.symbol, side: orderRequest.side })

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Order>('/v2/orders', {
          method: 'POST',
          body: orderRequest,
        })

        let order: Order
        try {
          order = validateOrder(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate order response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'createOrder',
              metadata: { symbol: orderRequest.symbol, side: orderRequest.side },
            },
          )
        }
        if (this.cache) {
          const cacheKey = `order:${order.id}`
          this.cache.set(cacheKey, order, 60000) // Cache for 1 minute
        }

        return order as Order
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'createOrder',
          metadata: { symbol: orderRequest.symbol, side: orderRequest.side },
        })
      }
    })
  }

  /**
   * Update an existing order in Alpaca's trading system.
   *
   * @param {string} orderId - The ID of the order to update
   * @param {UpdateOrderRequest} updateRequest - The update request data
   * @returns {Promise<Order>} - The updated order
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the update data is invalid
   */
  async updateOrder(orderId: string, updateRequest: UpdateOrderRequest): Promise<Order> {
    console.info('Updating order', { orderId })
    assertString(orderId, 'orderId')

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Order>(`/v2/orders/${orderId}`, {
          method: 'PATCH',
          body: updateRequest,
        })

        let order: Order
        try {
          order = validateOrder(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate updated order response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'updateOrder',
              metadata: { orderId },
            },
          )
        }
        if (this.cache) {
          const cacheKey = `order:${order.id}`
          this.cache.set(cacheKey, order, 60000) // Cache for 1 minute
        }

        return order as Order
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'updateOrder',
          metadata: { orderId },
        })
      }
    })
  }

  /**
   * Get orders with optional filtering
   *
   * @param {GetOrdersParams} [params] - Optional parameters for filtering orders
   * @returns {Promise<Order[]>} - List of orders matching the criteria
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the parameters are invalid
   */
  async getOrders(params?: GetOrdersParams): Promise<Order[]> {
    console.info('Getting orders', { params })

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Order[]>('/v2/orders', {
          method: 'GET',
          params,
        })

        if (!Array.isArray(response)) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Expected array of orders', {
              category: 'validation',
              responseBody: JSON.stringify(response),
            }),
            {
              operation: 'getOrders',
              metadata: { params },
            },
          )
        }

        assertArray(response, 'orders response')

        let orders: Order[]
        try {
          orders = validateOrderArray(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate orders response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'getOrders',
              metadata: { params },
            },
          )
        }

        if (this.cache) {
          orders.forEach((order: Order) => {
            const cacheKey = `order:${order.id}`
            this.cache!.set(cacheKey, order, 60000) // Cache for 1 minute
          })
        }

        return orders as Order[]
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'getOrders',
          metadata: { params },
        })
      }
    })
  }

  /**
   * Cancel an order in Alpaca's trading system.
   *
   * @param {string} orderId - The ID of the order to cancel
   * @returns {Promise<Order>} - The cancelled order
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the order ID is invalid
   */
  async cancelOrder(orderId: string): Promise<Order> {
    console.info('Cancelling order', { orderId })
    assertString(orderId, 'orderId')

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Order>(`/v2/orders/${orderId}`, {
          method: 'DELETE',
        })

        let order: Order
        try {
          order = validateOrder(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate cancelled order response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'cancelOrder',
              metadata: { orderId },
            },
          )
        }
        if (this.cache) {
          const cacheKey = `order:${order.id}`
          this.cache.delete(cacheKey) // Remove from cache since it's cancelled
        }

        return order as Order
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'cancelOrder',
          metadata: { orderId },
        })
      }
    })
  }

  /**
   * Get all trade positions in Alpaca's trading system.
   *
   * @param {GetOrdersParams} [params] - Optional parameters for filtering positions
   * @return {Promise<Position[]>} - List of positions matching the criteria
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the parameters are invalid
   */
  async getPositions(): Promise<Position[]> {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Position[]>('/v2/positions', { method: 'GET' })

        if (!Array.isArray(response)) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Expected array of positions', {
              category: 'validation',
              responseBody: JSON.stringify(response),
            }),
            {
              operation: 'getPositions',
              metadata: {},
            },
          )
        }

        assertArray(response, 'positions response')

        let positions: Position[]
        try {
          positions = validatePositionArray(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate positions response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'getPositions',
              metadata: {},
            },
          )
        }

        if (this.cache) {
          positions.forEach((position: Position) => {
            const cacheKey = `position:${position.symbol}`
            this.cache!.set(cacheKey, position, 30000) // Cache for 30 seconds
          })
        }

        return positions as Position[]
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'getPositions',
          metadata: {},
        })
      }
    })
  }

  /**
   * Get a specific position by symbol in Alpaca's trading system.
   *
   * @param {string} symbol - The symbol of the position to retrieve
   * @return {Promise<Position>} - The position for the given symbol
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the symbol is invalid
   */
  async getPosition(symbol: string): Promise<Position> {
    console.info('Getting position', { symbol })
    assertString(symbol, 'symbol')

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Position>(`/v2/positions/${symbol}`, {
          method: 'GET',
        })

        let position: Position
        try {
          position = validatePosition(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate position response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'getPosition',
              metadata: { symbol },
            },
          )
        }
        if (this.cache) {
          const cacheKey = `position:${position.symbol}`
          this.cache.set(cacheKey, position, 30000) // Cache for 30 seconds
        }

        return position as Position
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'getPosition',
          metadata: { symbol },
        })
      }
    })
  }

  /**
   * Close a position (liquidate) in Alpaca's trading system.
   *
   * @param {string} symbol - The symbol of the position to close
   * @param {ClosePositionRequest} [closeRequest] - Optional request data for closing the position
   * @return {Promise<Order>} - The order created to close the position
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the symbol is invalid or close request data is invalid
   */
  async closePosition(symbol: string, closeRequest?: ClosePositionRequest): Promise<Order> {
    console.info('Closing position', { symbol, closeRequest })
    assertString(symbol, 'symbol')

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Order>(`/v2/positions/${symbol}`, {
          method: 'DELETE',
          body: closeRequest,
        })

        let order: Order
        try {
          order = validateOrder(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate close position response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'closePosition',
              metadata: { symbol, closeRequest },
            },
          )
        }
        if (this.cache) {
          // Remove position from cache and cache the closing order
          this.cache.delete(`position:${symbol}`)
          this.cache.set(`order:${order.id}`, order, 60000)
        }

        return order as Order
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'closePosition',
          metadata: { symbol, closeRequest },
        })
      }
    })
  }

  /**
   * Get account information in Alpaca's trading system.
   *
   * @returns {Promise<Account>} - The account information
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the account data is invalid
   */
  async getAccount(): Promise<Account> {
    console.info('Getting account information')

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<Account>('/v2/account', {
          method: 'GET',
        })

        let account: Account
        try {
          account = validateAccount(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate account response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'getAccount',
              metadata: {},
            },
          )
        }
        if (this.cache) {
          this.cache.set('account', account, 60000) // Cache for 1 minute
        }

        return account as Account
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'getAccount',
          metadata: {},
        })
      }
    })
  }

  /**
   * Get account activities in Alpaca's trading system.
   *
   * @param {GetAccountActivitiesParams} [params] - Optional parameters for filtering activities
   * @returns {Promise<AccountActivity[]>} - List of account activities matching the criteria
   * @throws {AlpacaMarketError} If validation fails or API request fails
   * @throws {AlpacaMarketErrorContext} If an error occurs during the operation
   * @throws {ValidationError} If the parameters are invalid
   */
  async getAccountActivities(params?: GetAccountActivitiesParams): Promise<AccountActivity[]> {
    console.info('Getting account activities', { params })

    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.apiClient.request<AccountActivity[]>('/v2/account/activities', {
          method: 'GET',
          params,
        })

        if (!Array.isArray(response)) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Expected array of activities', {
              category: 'validation',
              responseBody: JSON.stringify(response),
            }),
            {
              operation: 'getAccountActivities',
              metadata: { params },
            },
          )
        }

        assertArray(response, 'account activities response')

        let activities: AccountActivity[]
        try {
          activities = validateAccountActivityArray(response)
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(
            new AlpacaMarketError('Failed to validate account activities response', {
              category: 'validation',
              responseBody: error instanceof Error ? error.message : String(error),
            }),
            {
              operation: 'getAccountActivities',
              metadata: { params },
            },
          )
        }
        if (this.cache) {
          const cacheKey = `activities:${JSON.stringify(params)}`
          this.cache.set(cacheKey, activities, 300000) // Cache for 5 minutes
        }

        return activities as AccountActivity[]
      } catch (error) {
        throw AlpacaMarketErrorContext.enrichError(error, {
          operation: 'getAccountActivities',
          metadata: { params },
        })
      }
    })
  }

  /**
   * Clean up resources and close all connections.
   */
  destroy(): void {
    console.info('Destroying trading client')
    this.cache?.dispose()
    this.circuitBreaker?.reset()
    this.requestDeduplicator?.clear()
    this.connectionPool?.close()
  }

  /**
   * Get Alpaca Trading Client metrics
   */
  getMetrics() {
    return {
      cache: this.cache?.getMetrics(),
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      requestDeduplication: this.requestDeduplicator?.getMetrics(),
      connectionPool: this.connectionPool?.getMetrics(),
    }
  }
}
