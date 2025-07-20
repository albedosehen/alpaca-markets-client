import type { WebSocketConfig, WebSocketEventHandlers } from '../../types/websocket.ts'
import type { AlpacaClientConfig } from '../../client/alpaca.types.ts'
import { AlpacaMarketStreamEndpoint } from './stream-endpoint.ts'

/**
 * WebSocket client factory with default configuration
 *
 * This factory provides methods to create WebSocket clients for different purposes,
 * such as trading updates or market data. It allows customization of WebSocket settings
 * while providing sensible defaults for common use cases.
 *
 * @param {AlpacaClientConfig} config - Alpaca client configuration
 * @param {WebSocketEventHandlers} eventHandlers - Handlers for WebSocket events
 * @param {Partial<WebSocketConfig>} overrides - Optional overrides for WebSocket configuration
 * @returns {AlpacaMarketStreamEndpoint} - An instance of the AlpacaMarket
 * @class AlpacaStreamFactory
 *
 * @example Basic usage:
 * ```typescript
 * const alpacaConfig: AlpacaClientConfig = {
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key'
 * }
 *
 * const eventHandlers: WebSocketEventHandlers = {
 *  onMessage: (msg) => console.log('WebSocket message received:', msg),
 * onError: (error) => console.error('WebSocket error:', error),
 * onClose: () => console.log('WebSocket connection closed')
 * }
 *
 * const streamingClient = AlpacaStreamFactory.create(
 *  alpacaConfig,
 * eventHandlers,
 * { maxReconnectAttempts: 3, reconnectDelayMs: 2000 }
 * )
 * ```
 */
export class AlpacaStreamFactory {
  /**
   * Create WebSocket client with default configuration
   */
  static create(
    config: AlpacaClientConfig,
    eventHandlers: WebSocketEventHandlers,
    overrides?: Partial<WebSocketConfig>,
  ): AlpacaMarketStreamEndpoint {
    const defaultConfig: WebSocketConfig = {
      maxReconnectAttempts: 5,
      reconnectDelayMs: 1000,
      pingIntervalMs: 30000,
      maxQueueSize: 1000,
      connectionTimeoutMs: 10000,
      autoReconnect: true,
    }

    const wsConfig = { ...defaultConfig, ...overrides }
    return new AlpacaMarketStreamEndpoint(config, wsConfig, eventHandlers)
  }

  /**
   * Create WebSocket client for trading updates
   */
  static createForTrading(
    config: AlpacaClientConfig,
    eventHandlers: WebSocketEventHandlers,
    overrides?: Partial<WebSocketConfig>,
  ): AlpacaMarketStreamEndpoint {
    return AlpacaStreamFactory.create(config, eventHandlers, {
      maxQueueSize: 500,
      pingIntervalMs: 60000,
      ...overrides,
    })
  }

  /**
   * Create WebSocket client for market data
   */
  static createForMarketData(
    config: AlpacaClientConfig,
    eventHandlers: WebSocketEventHandlers,
    overrides?: Partial<WebSocketConfig>,
  ): AlpacaMarketStreamEndpoint {
    return AlpacaStreamFactory.create(config, eventHandlers, {
      maxQueueSize: 2000,
      pingIntervalMs: 30000,
      ...overrides,
    })
  }
}
