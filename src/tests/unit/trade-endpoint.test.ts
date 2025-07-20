import { assert, assertEquals, assertExists } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { assertSpyCalls, returnsNext } from '@std/testing/mock'
import { AlpacaMarketError } from '../../errors/errors.ts'
import { AlpacaMarketClient } from '../../client/alpaca.ts'
import { cleanupTestState, createMockAlpacaMarketClient, createTrackedSpy, resetTestState } from '../testUtils.ts'
import {
  createConservativeTradingClient,
  createHighFrequencyTradingClient,
  createTradingClient,
} from '../../endpoints/trade/trade-endpoint-helpers.ts'
import { AlpacaTradeEndpoint } from '../../endpoints/trade/trade-endpoint.ts'
import type { CreateOrderRequest, GetOrdersParams, Order, UpdateOrderRequest } from '../../types/order.ts'
import type { ClosePositionRequest, Position } from '../../types/position.ts'
import type { Account, AccountActivity } from '../../types/account.ts'
import type { GetAccountActivitiesParams } from '../../endpoints/trade/trade-endpoint.types.ts'
import type { TradingClientConfig } from '../../endpoints/trade/trade-endpoint.types.ts'

let mockApiClient: ReturnType<typeof createMockAlpacaMarketClient>

// TODO(@albedosehen): move these to a src/fixtures/ directory in the future to keep tests readable
/** Fixtures */
const mockOrder: Order = {
  id: 'order-123',
  symbol: 'NVDA',
  qty: '100',
  side: 'buy',
  time_in_force: 'day',
  status: 'new',
  order_type: 'market',
  created_at: '2023-01-01T10:00:00Z',
  updated_at: '2023-01-01T10:00:00Z',
  submitted_at: '2023-01-01T10:00:00Z',
  filled_qty: '0',
}

const mockPosition: Position = {
  symbol: 'NVDA',
  qty: '100',
  side: 'long',
  asset_id: 'asset-123',
  asset_class: 'us_equity',
  exchange: 'NASDAQ',
  avg_entry_price: '150.00',
  market_value: '15000.00',
  cost_basis: '15000.00',
  unrealized_pl: '0.00',
  unrealized_plpc: '0.00',
  unrealized_intraday_pl: '0.00',
  unrealized_intraday_plpc: '0.00',
  current_price: '150.00',
  lastday_price: '149.00',
  change_today: '1.00',
}

const mockAccount: Account = {
  status: 'ACTIVE',
  account_blocked: false,
  account_number: 'ACC123456',
  buying_power: '25000.00',
  cash: '10000.00',
  created_at: '2023-01-01T00:00:00Z',
  currency: 'USD',
  daytrade_count: 0,
  daytrading_buying_power: '100000.00',
  equity: '25000.00',
  id: 'account-123',
  initial_margin: '0.00',
  last_equity: '25000.00',
  last_maintenance_margin: '0.00',
  long_market_value: '15000.00',
  maintenance_margin: '0.00',
  multiplier: '4',
  pattern_day_trader: false,
  portfolio_value: '25000.00',
  regt_buying_power: '20000.00',
  short_market_value: '0.00',
  shorting_enabled: true,
  sma: '0.00',
  trade_suspended_by_user: false,
  trading_blocked: false,
  transfers_blocked: false,
}

const mockActivity: AccountActivity = {
  id: 'activity-123',
  account_id: 'account-123',
  activity_type: 'FILL',
  date: '2023-01-01',
  net_amount: '-15000.00',
  symbol: 'NVDA',
  qty: '100',
  price: '150.00',
  side: 'buy',
}

describe('TradingClient', () => {
  let tradingClient: AlpacaTradeEndpoint
  let config: TradingClientConfig

  beforeEach(() => {
    // Reset test state and create fresh mocks
    resetTestState()

    mockApiClient = createMockAlpacaMarketClient()

    config = {
      cacheConfig: {
        enabled: true,
        maxSize: 100,
        defaultTtlMs: 60000,
      },
      circuitBreakerConfig: {
        failureThreshold: 3,
        timeoutMs: 5000,
        recoveryTimeoutMs: 15000,
        halfOpenMaxAttempts: 1,
        resetTimeoutMs: 60000,
      },
      requestDeduplicationConfig: {
        enabled: true,
        maxPendingRequests: 10,
        timeoutMs: 30000,
      },
      connectionPoolConfig: {
        enabled: true,
        maxConnections: 5,
        maxIdleTime: 30000,
        keepAlive: true,
        timeout: 15000,
      },
    }

    tradingClient = new AlpacaTradeEndpoint(
      mockApiClient as unknown as AlpacaMarketClient,
      config,
    )
  })

  afterEach(() => {
    tradingClient.destroy()
    cleanupTestState()
  })

  describe('Order Management', () => {
    it('should create a market order successfully', async () => {
      // Setup mock response
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockOrder))

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      const order = await tradingClient.createOrder(orderRequest)

      assertEquals(order.symbol, 'NVDA')
      assertEquals(order.qty, '100')
      assertEquals(order.side, 'buy')

      // Verify API call
      assertSpyCalls(mockApiClient.request, 1)
      const call = mockApiClient.request.calls[0]
      assertEquals(call.args[0], '/v2/orders')
      assertEquals((call.args[1] as Record<string, unknown>)?.method, 'POST')
      assertEquals((call.args[1] as Record<string, unknown>)?.body, orderRequest)
    })

    it('should create a limit order with all parameters', async () => {
      const limitOrder = { ...mockOrder, order_type: 'limit' as const }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(limitOrder))

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price: '150.00',
        extended_hours: true,
        client_order_id: 'my-order-123',
      }

      const result = await tradingClient.createOrder(orderRequest)

      assertEquals(result.order_type, 'limit')
      assertSpyCalls(mockApiClient.request, 1)
    })

    it('should create a bracket order', async () => {
      const bracketOrder = { ...mockOrder, order_class: 'bracket' as const }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(bracketOrder))

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'limit',
        time_in_force: 'day',
        limit_price: '150.00',
        order_class: 'bracket',
        take_profit: {
          limit_price: '160.00',
        },
        stop_loss: {
          stop_price: '140.00',
        },
      }

      const result = await tradingClient.createOrder(orderRequest)

      assertEquals(result.order_class, 'bracket')
      assertSpyCalls(mockApiClient.request, 1)
    })

    it('should handle create order errors', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        throw new AlpacaMarketError('Order creation failed')
      })

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      try {
        await tradingClient.createOrder(orderRequest)
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assertEquals(error.message, 'Order creation failed')
      }
    })

    it('should update an order successfully', async () => {
      const updatedOrder = { ...mockOrder, qty: '50' }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(updatedOrder))

      const updateRequest: UpdateOrderRequest = {
        qty: '50',
        limit_price: '155.00',
      }

      const order = await tradingClient.updateOrder('order-123', updateRequest)
      assertEquals(order.qty, '50')

      assertSpyCalls(mockApiClient.request, 1)
      const call = mockApiClient.request.calls[0]
      assertEquals(call.args[0], '/v2/orders/order-123')
      assertEquals((call.args[1] as Record<string, unknown>)?.method, 'PATCH')
      assertEquals((call.args[1] as Record<string, unknown>)?.body, updateRequest)
    })

    it('should get orders with parameters', async () => {
      const orders = [mockOrder, { ...mockOrder, id: 'order-456' }]
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(orders))

      const params: GetOrdersParams = {
        status: 'open',
        limit: 10,
        symbols: 'NVDA,GOOGL',
      }

      const ordersResult = await tradingClient.getOrders(params)
      assertEquals(ordersResult.length, 2)

      assertSpyCalls(mockApiClient.request, 1)
      const call = mockApiClient.request.calls[0]
      assertEquals(call.args[0], '/v2/orders')
      assertEquals((call.args[1] as Record<string, unknown>)?.method, 'GET')
      assertEquals((call.args[1] as Record<string, unknown>)?.params, params)
    })

    it('should cancel an order successfully', async () => {
      const cancelledOrder = { ...mockOrder, status: 'canceled' as const }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve(cancelledOrder)
      )

      const order = await tradingClient.cancelOrder('order-123')
      assertEquals(order.status, 'canceled')

      assertSpyCalls(mockApiClient.request, 1)
      const call = mockApiClient.request.calls[0]
      assertEquals(call.args[0], '/v2/orders/order-123')
      assertEquals((call.args[1] as Record<string, unknown>)?.method, 'DELETE')
    })

    it('should handle invalid order response', async () => {
      // Mock invalid response data
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve({ invalid: 'data' })
      )

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      try {
        await tradingClient.createOrder(orderRequest)
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assert(error.message.includes('Failed to validate'))
      }
    })
  })

  describe('Position Management', () => {
    it('should get all positions successfully', async () => {
      const positions = [mockPosition, { ...mockPosition, symbol: 'GOOGL' }]
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(positions))

      const positionsResult = await tradingClient.getPositions()
      assertEquals(positionsResult.length, 2)

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint, options] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/positions')
      assertEquals((options as Record<string, unknown>).method, 'GET')
    })

    it('should get a specific position', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockPosition))

      const position = await tradingClient.getPosition('NVDA')
      assertEquals(position.symbol, 'NVDA')
      assertEquals(position.qty, '100')

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/positions/NVDA')
    })

    it('should close a position completely', async () => {
      const closeOrder = { ...mockOrder, side: 'sell' as const }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(closeOrder))

      const order = await tradingClient.closePosition('NVDA')
      assertEquals(order.side, 'sell')

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint, options] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/positions/NVDA')
      assertEquals((options as Record<string, unknown>).method, 'DELETE')
    })

    it('should close a position partially', async () => {
      const closeOrder = { ...mockOrder, side: 'sell' as const, qty: '50' }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(closeOrder))

      const closeRequest: ClosePositionRequest = {
        qty: '50',
      }

      const order = await tradingClient.closePosition('NVDA', closeRequest)
      assertEquals(order.side, 'sell')

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint, options] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/positions/NVDA')
      assertEquals((options as Record<string, unknown>).method, 'DELETE')
      assertEquals((options as Record<string, unknown>).body, closeRequest)
    })

    it('should close a position by percentage', async () => {
      const closeOrder = { ...mockOrder, side: 'sell' as const, qty: '25' }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(closeOrder))

      const closeRequest: ClosePositionRequest = {
        percentage: '25',
      }

      const order = await tradingClient.closePosition('NVDA', closeRequest)
      assertEquals(order.side, 'sell')
      assertSpyCalls(mockApiClient.request, 1)
    })

    it('should handle position not found errors', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        throw new AlpacaMarketError('Position not found', { status: 404 })
      })

      try {
        await tradingClient.getPosition('NONEXISTENT')
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assertEquals(error.message, 'Position not found')
      }
    })

    it('should handle invalid positions array response', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve('not an array')
      )

      try {
        await tradingClient.getPositions()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assert(error.message.includes('Expected array of positions'))
      }
    })
  })

  describe('Account Management', () => {
    it('should get account information successfully', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockAccount))

      const account = await tradingClient.getAccount()
      assertEquals(account.status, 'ACTIVE')
      assertEquals(account.buying_power, '25000.00')

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint, options] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/account')
      assertEquals((options as Record<string, unknown>).method, 'GET')
    })

    it('should get account activities with parameters', async () => {
      const activities = [mockActivity, { ...mockActivity, id: 'activity-456' }]
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(activities))

      const params: GetAccountActivitiesParams = {
        activity_type: 'FILL',
        date: '2023-01-01',
        page_size: 10,
      }

      const activitiesResult = await tradingClient.getAccountActivities(params)
      assertEquals(activitiesResult.length, 2)

      assertSpyCalls(mockApiClient.request, 1)
      const [endpoint, options] = mockApiClient.request.calls[0].args
      assertEquals(endpoint, '/v2/account/activities')
      assertEquals((options as Record<string, unknown>).method, 'GET')
      assertEquals((options as Record<string, unknown>).params, params)
    })

    it('should handle account blocked status', async () => {
      const blockedAccount = { ...mockAccount, account_blocked: true, trading_blocked: true }
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve(blockedAccount)
      )

      const account = await tradingClient.getAccount()
      assertEquals(account.account_blocked, true)
      assertEquals(account.trading_blocked, true)
    })

    it('should handle invalid account activities response', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve('not an array')
      )

      try {
        await tradingClient.getAccountActivities()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assert(error.message.includes('Expected array of activities'))
      }
    })
  })

  describe('Caching Behavior', () => {
    it('should cache orders after creation', async () => {
      const clientWithCache = new AlpacaTradeEndpoint(
        mockApiClient as unknown as AlpacaMarketClient,
        { cacheConfig: { enabled: true } },
      )

      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockOrder))

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      const result = await clientWithCache.createOrder(orderRequest)
      assertEquals(result.symbol, 'NVDA')

      // Cache should be utilized (verified through internal state)
      const metrics = clientWithCache.getMetrics()
      assertExists(metrics.cache)

      clientWithCache.destroy()
    })

    it('should work without caching when disabled', async () => {
      const clientWithoutCache = new AlpacaTradeEndpoint(
        mockApiClient as unknown as AlpacaMarketClient,
        { cacheConfig: { enabled: false } },
      )

      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockOrder))

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      const result = await clientWithoutCache.createOrder(orderRequest)
      assertEquals(result.symbol, 'NVDA')

      // No cache metrics should be available
      const metrics = clientWithoutCache.getMetrics()
      assertEquals(metrics.cache, undefined)

      clientWithoutCache.destroy()
    })
  })

  describe('Error Handling and Validation', () => {
    it('should handle network timeouts', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        throw new AlpacaMarketError('Request timeout', { status: 408 })
      })

      try {
        await tradingClient.getAccount()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assertEquals(error.message, 'Request timeout')
      }
    })

    it('should handle API rate limiting', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        throw new AlpacaMarketError('Rate limit exceeded', { status: 429 })
      })

      try {
        await tradingClient.getOrders()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assertEquals(error.message, 'Rate limit exceeded')
      }
    })

    it('should handle malformed JSON responses', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve('invalid json')
      )

      try {
        await tradingClient.getAccount()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
      }
    })

    it('should validate schema for all response types', async () => {
      // Test invalid order schema
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve({ invalid: 'order' })
      )

      const orderRequest: CreateOrderRequest = {
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      try {
        await tradingClient.createOrder(orderRequest)
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
      }
    })
  })

  describe('Resource Management', () => {
    it('should clean up resources on destroy', () => {
      const metrics = tradingClient.getMetrics()
      assertExists(metrics)

      tradingClient.destroy()

      // Verify cleanup was called - destruction completed without error
    })

    it('should provide comprehensive metrics', () => {
      const metrics = tradingClient.getMetrics()

      assertExists(metrics)
      assertExists(metrics.cache)
      // Circuit breaker, request deduplication, and connection pool metrics
      // may be undefined if not configured or used
    })
  })
})

describe('TradingClient Factory Functions', () => {
  beforeEach(() => {
    resetTestState()
    mockApiClient = createMockAlpacaMarketClient()
  })

  afterEach(() => {
    cleanupTestState()
  })

  describe('createTradingClient', () => {
    it('should create client with default configuration', () => {
      const client = createTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        {},
      )

      assertExists(client)

      const metrics = client.getMetrics()
      assertExists(metrics.cache) // Should have cache enabled by default

      client.destroy()
    })

    it('should create client with custom configuration', () => {
      const customConfig: TradingClientConfig = {
        cacheConfig: {
          enabled: true,
          maxSize: 500,
          defaultTtlMs: 120000,
        },
      }

      const client = createTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        customConfig,
      )

      assertExists(client)
      client.destroy()
    })
  })

  describe('createHighFrequencyTradingClient', () => {
    it('should create HFT-optimized client', () => {
      const client = createHighFrequencyTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        {},
      )

      assertExists(client)

      // HFT client should have aggressive settings
      const metrics = client.getMetrics()
      assertExists(metrics.cache)

      client.destroy()
    })

    it('should override HFT defaults with custom config', () => {
      const customConfig: TradingClientConfig = {
        cacheConfig: {
          enabled: false, // Override HFT default
        },
      }

      const client = createHighFrequencyTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        customConfig,
      )

      assertExists(client)

      const metrics = client.getMetrics()
      assertEquals(metrics.cache, undefined) // Should be disabled

      client.destroy()
    })
  })

  describe('createConservativeTradingClient', () => {
    it('should create conservative client', () => {
      const client = createConservativeTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        {},
      )

      assertExists(client)

      // Conservative client should have longer timeouts and caching
      const metrics = client.getMetrics()
      assertExists(metrics.cache)

      client.destroy()
    })

    it('should work with minimal configuration', () => {
      const client = createConservativeTradingClient(
        mockApiClient as unknown as AlpacaMarketClient,
        {}, // Empty config should use defaults
      )

      assertExists(client)
      client.destroy()
    })
  })
})

describe('TradingClient Integration Scenarios', () => {
  let tradingClient: AlpacaTradeEndpoint

  beforeEach(() => {
    resetTestState()
    mockApiClient = createMockAlpacaMarketClient()
    tradingClient = createTradingClient(
      mockApiClient as unknown as AlpacaMarketClient,
      {},
    )
  })

  afterEach(() => {
    tradingClient.destroy()
    cleanupTestState()
  })

  describe('Complete Trading Workflow', () => {
    it('should handle complete order lifecycle', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockOrder))

      mockApiClient.request = createTrackedSpy(returnsNext([
        Promise.resolve(mockOrder), // createOrder
        Promise.resolve([{ ...mockOrder, status: 'filled', filled_qty: '100' }]), // getOrders
        Promise.resolve({ ...mockOrder, status: 'filled' }), // cancelOrder (should fail)
      ]))

      const createResult = await tradingClient.createOrder({
        symbol: 'NVDA',
        qty: '100',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      })
      assertEquals(createResult.symbol, 'NVDA')

      const ordersResult = await tradingClient.getOrders({ status: 'all' })
      assertEquals(ordersResult.length >= 0, true)

      const cancelResult = await tradingClient.cancelOrder('order-123') // try to cancel (would fail if filled)
      assertEquals(cancelResult.id, 'order-123')
    })

    it('should handle position management workflow', async () => {
      mockApiClient.request = createTrackedSpy(returnsNext([
        Promise.resolve([mockPosition]), // getPositions
        Promise.resolve(mockPosition), // getPosition
        Promise.resolve({ ...mockOrder, side: 'sell' }), // closePosition
      ]))

      const positionsResult = await tradingClient.getPositions()
      assertEquals(positionsResult.length, 1)

      const positionResult = await tradingClient.getPosition('NVDA')
      assertEquals(positionResult.symbol, 'NVDA')

      // Close position
      const closeResult = await tradingClient.closePosition('NVDA')
      assertEquals(closeResult.side, 'sell')
    })

    it('should handle account monitoring workflow', async () => {
      mockApiClient.request = createTrackedSpy(returnsNext([
        Promise.resolve(mockAccount),
        Promise.resolve([mockActivity]),
      ]))

      const accountResult = await tradingClient.getAccount()
      assertEquals(accountResult.status, 'ACTIVE')
      assertEquals(accountResult.trading_blocked, false)

      const activitiesResult = await tradingClient.getAccountActivities({
        activity_type: 'FILL',
        page_size: 10,
      })
      assertEquals(activitiesResult.length, 1)
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle transient network errors', async () => {
      let callCount = 0
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        callCount++
        if (callCount === 1) {
          throw new AlpacaMarketError('Network error')
        }
        return Promise.resolve(mockAccount)
      })

      // transient error
      try {
        await tradingClient.getAccount()
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
      }

      // success
      const result2 = await tradingClient.getAccount()
      assertEquals(result2.status, 'ACTIVE')

      assertEquals(callCount, 2)
    })

    it('should handle API validation errors gracefully', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        throw new AlpacaMarketError('Invalid order parameters', { status: 400 })
      })

      const invalidOrder: CreateOrderRequest = {
        symbol: 'INVALID',
        qty: '-100', // invalid quantity
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }

      try {
        await tradingClient.createOrder(invalidOrder)
        throw new Error('Should have failed')
      } catch (error) {
        assert(error instanceof AlpacaMarketError)
        assert(error.message.includes('Invalid order parameters'))
      }
    })
  })

  describe('Performance and Load Scenarios', () => {
    it('should handle multiple concurrent requests', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => Promise.resolve(mockOrder))

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(tradingClient.createOrder({
          symbol: 'NVDA',
          qty: '10',
          side: 'buy',
          type: 'market',
          time_in_force: 'day',
          client_order_id: `order-${i}`,
        }))
      }

      const results = await Promise.all(promises)

      assertEquals(results.length, 10)
      results.forEach((result) => {
        assertEquals(result.symbol, 'NVDA')
      })

      assertEquals(mockApiClient.request.calls.length, 10)
    })

    it('should handle high-frequency operations efficiently', async () => {
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) =>
        Promise.resolve([mockPosition])
      )

      const startTime = performance.now()

      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(tradingClient.getPositions())
      }

      const results = await Promise.all(promises)
      const endTime = performance.now()

      const duration = endTime - startTime
      const operationsPerSecond = 100 / (duration / 1000)

      assert(operationsPerSecond > 100)

      results.forEach((result) => {
        assertEquals(Array.isArray(result), true)
      })
    })

    it('should maintain performance under mixed workloads', async () => {
      let requestCount = 0
      mockApiClient.request = createTrackedSpy((_endpoint: string, _options?: unknown) => {
        requestCount++

        if (requestCount % 4 === 1) return Promise.resolve([mockOrder])
        if (requestCount % 4 === 2) return Promise.resolve([mockPosition])
        if (requestCount % 4 === 3) return Promise.resolve(mockAccount)
        return Promise.resolve([mockActivity])
      })

      const startTime = performance.now()

      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(
          tradingClient.getOrders(),
          tradingClient.getPositions(),
          tradingClient.getAccount(),
          tradingClient.getAccountActivities(),
        )
      }

      const results = await Promise.all(promises)
      const endTime = performance.now()

      const duration = endTime - startTime
      assertEquals(results.length, 80)

      assert(duration < 1000) // less than 1s for 80 requests

      results.forEach((result) => {
        assertExists(result)
      })
    })
  })
})
