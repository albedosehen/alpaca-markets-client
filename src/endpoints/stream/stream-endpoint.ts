import { AlpacaMarketErrorContext } from '../../errors/errors.ts'
import { WS_CONNECTION_STATE, WS_MESSAGE_TYPE } from '../../types/websocket.ts'
import type {
  SubscriptionConfig,
  WebSocketConfig,
  WebSocketEventHandlers,
  WebSocketMessage,
  WebSocketMetrics,
  WSConnectionState,
} from '../../types/websocket.ts'
import type { AlpacaClientConfig } from '../../client/alpaca.types.ts'

/**
 * Alpaca WebSocket client for real-time market data and trading updates
 *
 * This client handles WebSocket connections, subscriptions, and message processing
 * for Alpaca's market data and trading updates.
 * It supports automatic reconnection, message queuing, and metrics tracking.
 * It is designed to be used with Alpaca's Market Data API and Trading API.
 *
 * @param {AlpacaClientConfig} config - Alpaca client configuration
 * @param {WebSocketConfig} wsConfig - WebSocket configuration options
 * @param {WebSocketEventHandlers} eventHandlers - Handlers for WebSocket events
 * @returns {AlpacaMarketStreamEndpoint} - An instance of the AlpacaMarketStreamingEndpoint class
 * @throws {AlpacaMarketErrorContext} - Throws errors for network issues, validation errors, and timeouts
 *
 * @example Basic usage:
 * ```typescript
 * const alpacaConfig: AlpacaClientConfig = {
 *  apiKey: 'your-api-key',
 *  secretKey: 'your-secret-key'
 * }
 * const wsConfig: WebSocketConfig = {
 *  url: 'wss://stream.alpaca.markets/v2/iex',
 *  reconnectInterval: 1000
 * }
 * const eventHandlers: WebSocketEventHandlers = {
 *  onMessage: (msg) => console.log('WebSocket message received:', msg),
 *  onError: (error) => console.error('WebSocket error:', error),
 *  onClose: () => console.log('WebSocket connection closed')
 * }
 * const streamingClient = new AlpacaMarketStreamingEndpoint(alpacaConfig, wsConfig, eventHandlers)
 * ```
 */
export class AlpacaMarketStreamEndpoint {
  private ws?: WebSocket
  private state: WSConnectionState = WS_CONNECTION_STATE.Disconnected
  private subscriptions = new Map<string, SubscriptionConfig>()
  private messageQueue: WebSocketMessage[] = []
  private reconnectAttempts = 0
  private reconnectTimer?: number
  private pingTimer?: number
  private connectionTimer?: number
  private readonly debug: boolean
  private metrics = {
    connectTime: undefined as number | undefined,
    lastMessageTime: undefined as number | undefined,
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
  }

  constructor(
    private readonly config: AlpacaClientConfig,
    private readonly wsConfig: WebSocketConfig,
    private readonly eventHandlers: WebSocketEventHandlers,
  ) {
    this.debug = config.debug ?? false
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    try {
      await this.establishConnection()
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket connect',
          metadata: { wsConfig: this.wsConfig },
        },
        'network',
      )
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    try {
      this.clearTimers()
      this.setState(WS_CONNECTION_STATE.Disconnected)

      if (this.ws) {
        this.ws.close(1000, 'Client disconnect')
      }

      this.setState(WS_CONNECTION_STATE.Disconnected)
      console.info('WebSocket disconnected')
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket disconnect',
          metadata: { state: this.state },
        },
        'network',
      )
    }
  }

  /**
   * Subscribe to market data or trading updates
   */
  async subscribe(config: SubscriptionConfig): Promise<void> {
    try {
      const subscriptionId = this.generateSubscriptionId(config)
      this.subscriptions.set(subscriptionId, config)

      if (this.state === WS_CONNECTION_STATE.Connected) {
        await this.sendSubscription(config)
      } else {
        if (this.debug) {
          console.debug('Subscription queued', { config, subscriptionId })
        }
      }
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket subscribe',
          metadata: { config, subscriptionId: this.generateSubscriptionId(config) },
        },
        'validation',
      )
    }
  }

  /**
   * Unsubscribe from market data or trading updates
   */
  async unsubscribe(config: SubscriptionConfig): Promise<void> {
    try {
      const subscriptionId = this.generateSubscriptionId(config)
      this.subscriptions.delete(subscriptionId)

      if (this.state === WS_CONNECTION_STATE.Connected) {
        await this.sendUnsubscription(config)
      } else {
        if (this.debug) {
          console.debug('Unsubscription queued', { config, subscriptionId })
        }
      }
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket unsubscribe',
          metadata: { config, subscriptionId: this.generateSubscriptionId(config) },
        },
        'validation',
      )
    }
  }

  /**
   * Get current WebSocket metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      state: this.state,
      connectTime: this.metrics.connectTime,
      lastMessageTime: this.metrics.lastMessageTime,
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived,
      reconnectAttempts: this.metrics.reconnectAttempts,
      subscriptionsCount: this.subscriptions.size,
      queueSize: this.messageQueue.length,
    }
  }

  /**
   * Get current connection state
   */
  getState(): WSConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WS_CONNECTION_STATE.Connected
  }

  /**
   * Dispose WebSocket client and cleanup resources
   */
  dispose(): void {
    this.clearTimers()
    if (this.ws) {
      this.ws.close(1000, 'Client dispose')
    }
    this.subscriptions.clear()
    this.messageQueue.length = 0
    this.setState(WS_CONNECTION_STATE.Disconnected)
    if (this.debug) {
      console.debug('WebSocket client disposed')
    }
  }

  /**
   * Establish WebSocket connection
   */
  private establishConnection(): Promise<void> {
    this.setState(WS_CONNECTION_STATE.Connecting)
    console.info('Establishing WebSocket connection')

    const wsUrl = this.buildWebSocketUrl()
    this.ws = new WebSocket(wsUrl)

    // Set connection timeout
    this.connectionTimer = setTimeout(() => {
      if (this.state === WS_CONNECTION_STATE.Connecting) {
        this.ws?.close()
        throw AlpacaMarketErrorContext.timeoutError('WebSocket connection timeout', this.wsConfig.connectionTimeoutMs)
      }
    }, this.wsConfig.connectionTimeoutMs)

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(AlpacaMarketErrorContext.enrichError(
          new Error('Failed to create WebSocket'),
          { operation: 'WebSocket creation' },
          'network',
        ))
        return
      }

      this.ws.onopen = () => {
        this.clearConnectionTimer()
        this.setState(WS_CONNECTION_STATE.Connected)
        this.metrics.connectTime = Date.now()
        this.reconnectAttempts = 0
        this.startPingTimer()
        this.reestablishSubscriptions()
        this.eventHandlers.onConnect?.()
        console.info('WebSocket connected')
        resolve()
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      this.ws.onclose = (event) => {
        this.clearTimers()
        this.setState(WS_CONNECTION_STATE.Disconnected)

        const reason = `Code: ${event.code}, Reason: ${event.reason}`
        console.info('WebSocket closed', { code: event.code, reason: event.reason })
        this.eventHandlers.onDisconnect?.(reason)

        if (
          this.wsConfig.autoReconnect && !event.wasClean && this.reconnectAttempts < this.wsConfig.maxReconnectAttempts
        ) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = (event) => {
        const error = AlpacaMarketErrorContext.enrichError(
          new Error('WebSocket error'),
          {
            operation: 'WebSocket connection',
            metadata: { event, state: this.state },
          },
          'network',
        )
        console.error('WebSocket error', { error })
        this.eventHandlers.onError?.(error)

        if (this.state === WS_CONNECTION_STATE.Connecting) {
          reject(error)
        }
      }
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const rawMessage = JSON.parse(data)
      const message: WebSocketMessage = {
        type: rawMessage.T || rawMessage.type || WS_MESSAGE_TYPE.Trade,
        data: rawMessage,
        timestamp: Date.now(),
        symbol: rawMessage.S || rawMessage.symbol,
      }

      this.metrics.messagesReceived++
      this.metrics.lastMessageTime = message.timestamp

      // Queue message if handler is busy or queue size limit not reached
      if (this.messageQueue.length < this.wsConfig.maxQueueSize) {
        this.messageQueue.push(message)
        this.processMessageQueue()
      } else {
        console.warn('Message queue full, dropping message', { message })
      }
    } catch (error) {
      const parseError = AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket message parsing',
          metadata: { rawData: data },
        },
        'validation',
      )
      console.error('Message parse error', { error: parseError })
      this.eventHandlers.onError?.(parseError)
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        try {
          this.eventHandlers.onMessage?.(message)
        } catch (error) {
          console.error('Message handler error', { message, error })
        }
      }
    }
  }

  /**
   * Send subscription message
   */
  private async sendSubscription(config: SubscriptionConfig): Promise<void> {
    const message = {
      action: 'subscribe',
      [config.type]: config.symbols,
      ...(config.fields && { fields: config.fields }),
    }

    await this.sendMessage(message)
  }

  /**
   * Send unsubscription message
   */
  private async sendUnsubscription(config: SubscriptionConfig): Promise<void> {
    const message = {
      action: 'unsubscribe',
      [config.type]: config.symbols,
    }

    await this.sendMessage(message)
  }

  /**
   * Send message to WebSocket
   */
  private async sendMessage(message: unknown): Promise<void> {
    try {
      if (!this.ws || this.state !== WS_CONNECTION_STATE.Connected) {
        throw AlpacaMarketErrorContext.enrichError(
          new Error('WebSocket not connected'),
          {
            operation: 'WebSocket send message',
            metadata: { state: this.state, messageType: typeof message },
          },
          'network',
        )
      }

      const messageStr = JSON.stringify(message)
      this.ws.send(messageStr)
      this.metrics.messagesSent++
      if (this.debug) {
        console.debug('WebSocket message sent', { message })
      }
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'WebSocket send message',
          metadata: { state: this.state, messageType: typeof message },
        },
        'network',
      )
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++
    this.metrics.reconnectAttempts++

    const delay = this.wsConfig.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1)

    console.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    })

    this.reconnectTimer = setTimeout(() => {
      this.eventHandlers.onReconnect?.(this.reconnectAttempts)
      this.establishConnection().catch((error) => {
        console.error('Reconnection failed', { error })
        this.eventHandlers.onError?.(error)
      })
    }, delay)
  }

  /**
   * Reestablish all subscriptions after reconnection
   */
  private reestablishSubscriptions(): void {
    for (const config of this.subscriptions.values()) {
      this.sendSubscription(config).catch((error) => {
        console.error('Failed to reestablish subscription', { config, error })
      })
    }
  }

  /**
   * Start ping timer to keep connection alive
   */
  private startPingTimer(): void {
    if (this.wsConfig.pingIntervalMs > 0) {
      this.pingTimer = setInterval(() => {
        if (this.state === WS_CONNECTION_STATE.Connected) {
          this.sendMessage({ action: 'ping' }).catch((error) => {
            console.error('Ping failed', { error })
          })
        }
      }, this.wsConfig.pingIntervalMs)
    }
  }

  /**
   * Set WebSocket state and log transition
   */
  private setState(newState: WSConnectionState): void {
    const oldState = this.state
    this.state = newState
    if (this.debug) {
      console.debug('WebSocket state transition', { from: oldState, to: newState })
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = undefined
    }
    this.clearConnectionTimer()
  }

  /**
   * Clear connection timeout timer
   */
  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer)
      this.connectionTimer = undefined
    }
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(config: SubscriptionConfig): string {
    return `${config.type}:${config.symbols.join(',')}`
  }

  /**
   * Build WebSocket URL based on configuration
   */
  private buildWebSocketUrl(): string {
    const baseUrl = this.config.environment === 'live'
      ? 'wss://stream.data.alpaca.markets/v2/iex'
      : 'wss://stream.data.alpaca.markets/v2/iex'

    return `${baseUrl}?apikey=${this.config.apiKey}&apisecret=${this.config.secretKey}`
  }
}
