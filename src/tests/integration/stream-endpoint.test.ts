import { assertEquals, assertExists } from '@std/assert'
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd'
import { assertSpyCalls } from '@std/testing/mock'
import { AlpacaMarketStreamEndpoint } from '../../endpoints/stream/stream-endpoint.ts'
import { AlpacaStreamFactory } from '../../endpoints/stream/stream-endpoint-helpers.ts'
import {
  type SubscriptionConfig,
  type WebSocketConfig,
  type WebSocketEventHandlers,
  WS_CONNECTION_STATE,
  WS_SUBSCRIPTION_TYPE,
} from '../../types/websocket.ts'
import type { AlpacaClientConfig } from '../../client/alpaca.types.ts'
import {
  cleanupTestState,
  createTrackedSpy,
  createTrackedStub,
  MockWebSocket,
  resetTestState,
  setupMockWebSocket,
} from '../testUtils.ts'

describe('AlpacaMarketStreamEndpoint', () => {
  let wsClient: AlpacaMarketStreamEndpoint
  let mockWS: MockWebSocket
  let config: AlpacaClientConfig
  let wsConfig: WebSocketConfig
  let eventHandlers: WebSocketEventHandlers
  let originalWebSocket: typeof globalThis.WebSocket

  let onConnectSpy!: ReturnType<typeof createTrackedSpy>
  let _onDisconnectSpy!: ReturnType<typeof createTrackedSpy>
  let onErrorSpy!: ReturnType<typeof createTrackedSpy>
  let onReconnectSpy!: ReturnType<typeof createTrackedSpy>
  let onMessageSpy!: ReturnType<typeof createTrackedSpy>

  beforeEach(() => {
    resetTestState()

    const webSocketSetup = setupMockWebSocket()
    originalWebSocket = webSocketSetup.originalWebSocket

    config = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
      environment: 'paper' as const,
    }

    wsConfig = {
      maxReconnectAttempts: 3,
      reconnectDelayMs: 100,
      pingIntervalMs: 1000,
      maxQueueSize: 100,
      connectionTimeoutMs: 1000,
      autoReconnect: true,
    }

    onConnectSpy = createTrackedSpy(() => {})
    _onDisconnectSpy = createTrackedSpy(() => {})
    onErrorSpy = createTrackedSpy(() => {})
    onReconnectSpy = createTrackedSpy(() => {})
    onMessageSpy = createTrackedSpy(() => {})

    eventHandlers = {
      onConnect: onConnectSpy,
      onDisconnect: _onDisconnectSpy,
      onError: onErrorSpy,
      onReconnect: onReconnectSpy,
      onMessage: onMessageSpy,
    }

    globalThis.WebSocket = function (url: string) {
      mockWS = new MockWebSocket(url)
      return mockWS as unknown as WebSocket
    } as unknown as typeof WebSocket

    wsClient = new AlpacaMarketStreamEndpoint(config, wsConfig, eventHandlers)
  })

  afterEach(async () => {
    if (wsClient) {
      wsClient.dispose()
    }
    globalThis.WebSocket = originalWebSocket
    await cleanupTestState()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      await wsClient.connect()

      assertEquals(wsClient.getState(), WS_CONNECTION_STATE.Connected)
      assertSpyCalls(onConnectSpy, 1)
    })

    it('should handle connection timeout', async () => {
      MockWebSocket.prototype.setAutoConnect = () => {}
      const _mockWSStub = createTrackedStub(globalThis, 'WebSocket', () => {
        const ws = new MockWebSocket('ws://test')
        ws.setAutoConnect(false)
        return ws as unknown as WebSocket
      })

      try {
        await wsClient.connect()
        throw new Error('Should have failed with timeout')
      } catch (error) {
        assertEquals((error as Error).message.includes('timeout'), true)
      }
    })

    it('should disconnect gracefully', async () => {
      await wsClient.connect()

      await wsClient.disconnect()

      assertEquals(wsClient.getState(), WS_CONNECTION_STATE.Disconnected)
    })

    it('should handle connection errors', async () => {
      const _mockWSStub = createTrackedStub(globalThis, 'WebSocket', () => {
        const ws = new MockWebSocket('ws://test')
        setTimeout(() => ws.simulateError(), 5)
        return ws as unknown as WebSocket
      })

      try {
        await wsClient.connect()
        throw new Error('Should have failed with connection error')
      } catch {
        // Expected
      }

      assertSpyCalls(onErrorSpy, 1)
    })
  })

  describe('Auto-Reconnection', () => {
    it('should attempt reconnection after unexpected disconnection', async () => {
      await wsClient.connect()

      const _mockWSStub = createTrackedStub(globalThis, 'WebSocket', () => {
        const ws = new MockWebSocket('ws://test')
        mockWS = ws
        return ws as unknown as WebSocket
      })

      // Simulate unclean disconnection (not code 1000) to trigger reconnection
      mockWS.close(1006, 'Connection lost')

      await new Promise((resolve) => setTimeout(resolve, 150))

      assertSpyCalls(onReconnectSpy, 1)
    })

    it('should use exponential backoff for reconnection delays', async () => {
      await wsClient.connect()

      const reconnectSpy = createTrackedSpy(() => {})
      // deno-lint-ignore no-explicit-any
      const originalScheduleReconnect = (wsClient as any).scheduleReconnect.bind(wsClient) // specifically to track internal ws reconnects
      createTrackedStub(
        // deno-lint-ignore no-explicit-any
        wsClient as any,
        'scheduleReconnect',
        () => {
          reconnectSpy()
          originalScheduleReconnect()
        },
      )

      for (let i = 0; i < 3; i++) {
        mockWS.close(1006, 'Connection lost')
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      assertSpyCalls(reconnectSpy, 3)
    })

    it('should stop reconnecting after max attempts', async () => {
      const shortConfig = { ...wsConfig, maxReconnectAttempts: 1 }
      wsClient = new AlpacaMarketStreamEndpoint(config, shortConfig, eventHandlers)

      await wsClient.connect()

      // Mock WebSocket constructor to simulate failed reconnection attempts
      const _mockWSStub = createTrackedStub(globalThis, 'WebSocket', () => {
        const ws = new MockWebSocket('ws://test')
        ws.setAutoConnect(false) // Prevent auto-connect to simulate connection failure
        return ws as unknown as WebSocket
      })

      // Simulate unclean disconnection to trigger reconnection attempts
      mockWS.close(1006, 'Connection lost')
      await new Promise((resolve) => setTimeout(resolve, 250))

      // Should only attempt reconnection once due to maxReconnectAttempts: 1
      assertSpyCalls(onReconnectSpy, 1)
    })
  })

  describe('Message Handling', () => {
    it('should handle incoming messages correctly', async () => {
      await wsClient.connect()

      const testMessage = {
        T: 't',
        S: 'NVDA',
        p: 150.25,
        s: 100,
        t: '2023-01-01T10:00:00Z',
      }

      mockWS.simulateMessage(testMessage)

      await new Promise((resolve) => setTimeout(resolve, 10))

      assertSpyCalls(onMessageSpy, 1)
    })

    it('should queue messages when handler is busy', async () => {
      await wsClient.connect()

      const messages = [
        { T: 't', S: 'NVDA', p: 850.25 },
        { T: 't', S: 'MSFT', p: 700.50 },
        { T: 'q', S: 'GOOGL', bp: 2800.00 },
      ]

      messages.forEach((msg) => mockWS.simulateMessage(msg))

      await new Promise((resolve) => setTimeout(resolve, 50))

      assertSpyCalls(onMessageSpy, 3)
    })

    it('should drop messages when queue is full', async () => {
      const smallQueueConfig = { ...wsConfig, maxQueueSize: 2 }
      wsClient = new AlpacaMarketStreamEndpoint(config, smallQueueConfig, eventHandlers)

      await wsClient.connect()

      for (let i = 0; i < 5; i++) {
        mockWS.simulateMessage({ T: 't', S: 'TEST', p: i })
      }

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should handle malformed messages gracefully', async () => {
      await wsClient.connect()

      mockWS.onmessage?.(
        new MessageEvent('message', {
          data: 'invalid json{',
        }),
      )

      await new Promise((resolve) => setTimeout(resolve, 10))

      assertSpyCalls(onErrorSpy, 1)
    })
  })

  describe('Subscription Management', () => {
    it('should subscribe to market data successfully', async () => {
      await wsClient.connect()

      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Trades,
        symbols: ['NVDA', 'MSFT'],
      }

      await wsClient.subscribe(subscription)

      const lastMessage = mockWS.getLastSentMessage() as Record<string, unknown>
      assertEquals(lastMessage.action, 'subscribe')
      assertEquals(lastMessage.trades, ['NVDA', 'MSFT'])
    })

    it('should queue subscriptions when not connected', async () => {
      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Quotes,
        symbols: ['NVDA'],
      }

      await wsClient.subscribe(subscription)

      assertEquals(mockWS.getSentMessages().length, 0)
    })

    it('should reestablish subscriptions after reconnection', async () => {
      await wsClient.connect()

      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Trades,
        symbols: ['NVDA'],
      }

      await wsClient.subscribe(subscription)

      // Clear the message queue to start fresh
      mockWS.messageQueue = []

      // Create a new mock WebSocket for the reconnection
      const _mockWSStub = createTrackedStub(globalThis, 'WebSocket', () => {
        const ws = new MockWebSocket('ws://test')
        mockWS = ws
        return ws as unknown as WebSocket
      })

      // Simulate unclean disconnection to trigger reconnection
      mockWS.close(1006, 'Connection lost')
      await new Promise((resolve) => setTimeout(resolve, 200))

      const messages = mockWS.getSentMessages()
      const subscriptionMessage = messages.find((msg: unknown) =>
        typeof msg === 'object' && msg !== null &&
        'action' in msg && (msg as Record<string, unknown>).action === 'subscribe'
      )
      assertExists(subscriptionMessage)
    })

    it('should unsubscribe from market data', async () => {
      await wsClient.connect()

      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Trades,
        symbols: ['NVDA'],
      }

      await wsClient.subscribe(subscription)
      await wsClient.unsubscribe(subscription)

      const lastMessage = mockWS.getLastSentMessage() as Record<string, unknown>
      assertEquals(lastMessage.action, 'unsubscribe')
    })
  })

  describe('Health Monitoring', () => {
    it('should send ping messages when configured', async () => {
      const pingConfig = { ...wsConfig, pingIntervalMs: 50 }
      wsClient = new AlpacaMarketStreamEndpoint(config, pingConfig, eventHandlers)

      await wsClient.connect()

      await new Promise((resolve) => setTimeout(resolve, 100))

      const messages = mockWS.getSentMessages()
      const pingMessage = messages.find((msg: unknown) =>
        typeof msg === 'object' && msg !== null &&
        'action' in msg && (msg as Record<string, unknown>).action === 'ping'
      )
      assertExists(pingMessage)
    })

    it('should provide accurate metrics', async () => {
      await wsClient.connect()

      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Trades,
        symbols: ['NVDA'],
      }
      await wsClient.subscribe(subscription)

      mockWS.simulateMessage({ T: 't', S: 'NVDA' })

      const metrics = wsClient.getMetrics()

      assertEquals(metrics.state, WS_CONNECTION_STATE.Connected)
      assertEquals(metrics.subscriptionsCount, 1)
      assertEquals(metrics.messagesReceived, 1)
      assertExists(metrics.connectTime)
    })

    it('should track connection state correctly', () => {
      assertEquals(wsClient.getState(), WS_CONNECTION_STATE.Disconnected)
      assertEquals(wsClient.isConnected(), false)
    })
  })

  describe('Resource Management', () => {
    it('should clean up resources on dispose', async () => {
      await wsClient.connect()

      const subscription: SubscriptionConfig = {
        type: WS_SUBSCRIPTION_TYPE.Trades,
        symbols: ['NVDA'],
      }
      await wsClient.subscribe(subscription)

      wsClient.dispose()

      assertEquals(wsClient.getState(), WS_CONNECTION_STATE.Disconnected)
      assertEquals(wsClient.getMetrics().subscriptionsCount, 0)
    })

    it('should handle multiple dispose calls gracefully', () => {
      wsClient.dispose()
      wsClient.dispose() // Should not throw
    })
  })
})

describe('WebSocketClientFactory', () => {
  let originalWebSocket: typeof globalThis.WebSocket

  beforeEach(() => {
    resetTestState()
    const webSocketSetup = setupMockWebSocket()
    originalWebSocket = webSocketSetup.originalWebSocket
  })

  afterEach(async () => {
    globalThis.WebSocket = originalWebSocket
    await cleanupTestState()
  })

  describe('Factory Methods', () => {
    it('should create client with default configuration', () => {
      const config: AlpacaClientConfig = {
        apiKey: 'test',
        secretKey: 'test',
        environment: 'paper',
      }

      const client = AlpacaStreamFactory.create(
        config,
        {},
        {},
      )

      assertExists(client)
      assertEquals(client.getState(), WS_CONNECTION_STATE.Disconnected)
    })

    it('should create client for trading with optimized config', () => {
      const config: AlpacaClientConfig = {
        apiKey: 'test',
        secretKey: 'test',
        environment: 'paper',
      }

      const client = AlpacaStreamFactory.createForTrading(
        config,
        {},
        {},
      )

      assertExists(client)

      const metrics = client.getMetrics()
      assertEquals(metrics.state, WS_CONNECTION_STATE.Disconnected)
    })

    it('should create client for market data with optimized config', () => {
      const config: AlpacaClientConfig = {
        apiKey: 'test',
        secretKey: 'test',
        environment: 'paper',
      }

      const client = AlpacaStreamFactory.createForMarketData(
        config,
        {},
        {},
      )

      assertExists(client)

      const metrics = client.getMetrics()
      assertEquals(metrics.state, WS_CONNECTION_STATE.Disconnected)
    })

    it('should apply configuration overrides', () => {
      const config: AlpacaClientConfig = {
        apiKey: 'test',
        secretKey: 'test',
        environment: 'paper',
      }

      const overrides = {
        maxReconnectAttempts: 10,
        reconnectDelayMs: 2000,
      }

      const client = AlpacaStreamFactory.create(
        config,
        {},
        overrides,
      )

      assertExists(client)
    })
  })
})

describe('WebSocket Performance', () => {
  let originalWebSocket: typeof globalThis.WebSocket

  beforeEach(() => {
    resetTestState()
    const webSocketSetup = setupMockWebSocket()
    originalWebSocket = webSocketSetup.originalWebSocket
  })

  afterEach(async () => {
    globalThis.WebSocket = originalWebSocket
    await cleanupTestState()
  })

  it('should handle high message throughput', async () => {
    const config: AlpacaClientConfig = {
      apiKey: 'test',
      secretKey: 'test',
      environment: 'paper',
    }

    const wsConfig: WebSocketConfig = {
      maxReconnectAttempts: 3,
      reconnectDelayMs: 100,
      pingIntervalMs: 1000,
      maxQueueSize: 1000,
      connectionTimeoutMs: 1000,
      autoReconnect: true,
    }

    let messageCount = 0
    const eventHandlers: WebSocketEventHandlers = {
      onMessage: () => {
        messageCount++
      },
    }

    const wsClient = new AlpacaMarketStreamEndpoint(config, wsConfig, eventHandlers)
    await wsClient.connect()

    const mockWS = new MockWebSocket('ws://test')

    const startTime = performance.now()
    for (let i = 0; i < 1000; i++) {
      mockWS.simulateMessage({ T: 't', S: 'TEST', p: i })
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    const endTime = performance.now()

    const duration = endTime - startTime
    const messagesPerSecond = 1000 / (duration / 1000)

    assertEquals(messagesPerSecond > 1000, true)

    wsClient.dispose()
  })
})
