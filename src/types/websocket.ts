/**
 * WebSocket Types for Alpaca API
 * Provides types and constants for WebSocket connections, messages, and subscriptions.
 * @module
 */

/**
 * WebSocket message constants for Alpaca API.
 *
 * @property Authentication - Authentication message
 * @property Listen - Subscribe to a channel
 * @property Unlisten - Unsubscribe from a channel
 * @property Error - Error message
 * @property Success - Success message
 * @property Subscription - Subscription confirmation
 * @property Trade - Trade data message
 * @property Quote - Quote data message
 * @property Bar - Bar data message
 * @property Status - Status message
 * @property Luld - Limit Up/Limit Down message
 * @property CancelError - Cancel error message
 * @property Correction - Correction message
 */
export const WS_MESSAGE_TYPE = {
  Authentication: 'authentication',
  Listen: 'listen',
  Unlisten: 'unlisten',
  Error: 'error',
  Success: 'success',
  Subscription: 'subscription',
  Trade: 't',
  Quote: 'q',
  Bar: 'b',
  Status: 's',
  Luld: 'l',
  CancelError: 'c',
  Correction: 'x',
} as const

/** WebSocket message type for Alpaca API */
export type WSMessageType = typeof WS_MESSAGE_TYPE[keyof typeof WS_MESSAGE_TYPE]

/**
 * WebSocket connection states for Alpaca API.
 *
 * @property Disconnected - Not connected to WebSocket
 * @property Connecting - Attempting to connect to WebSocket
 * @property Connected - Successfully connected to WebSocket
 * @property Authenticated - Successfully authenticated on WebSocket
 * @property Reconnecting - Reconnecting to WebSocket after disconnection
 * @property Error - Error occurred during WebSocket connection
 */
export const WS_CONNECTION_STATE = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Connected: 'connected',
  Authenticated: 'authenticated',
  Reconnecting: 'reconnecting',
  Error: 'error',
} as const

/** WebSocket connection state for Alpaca API */
export type WSConnectionState = typeof WS_CONNECTION_STATE[keyof typeof WS_CONNECTION_STATE]

/**
 * WebSocket subscription types for Alpaca API.
 *
 * @property Trades - Subscribe to trade updates
 * @property Quotes - Subscribe to quote updates
 * @property Bars - Subscribe to bar updates
 * @property Status - Subscribe to status updates
 * @property Luld - Subscribe to Limit Up/Limit Down updates
 * @property CancelError - Subscribe to cancel error updates
 * @property Correction - Subscribe to correction updates
 * @property OrderUpdates - Subscribe to order updates
 * @property AccountUpdates - Subscribe to account updates
 */
export const WS_SUBSCRIPTION_TYPE = {
  Trades: 'trades',
  Quotes: 'quotes',
  Bars: 'bars',
  Status: 'status',
  Luld: 'luld',
  CancelError: 'cancelErrors',
  Correction: 'corrections',
  OrderUpdates: 'trade_updates',
  AccountUpdates: 'account_updates',
} as const

/** WebSocket subscription type for Alpaca API */
export type WSSubscriptionType = typeof WS_SUBSCRIPTION_TYPE[keyof typeof WS_SUBSCRIPTION_TYPE]

/**
 * WebSocket connection configuration
 *
 * This interface defines the configuration options for establishing a WebSocket connection.
 */
export interface WebSocketConfig {
  /** Reconnection attempt limit */
  readonly maxReconnectAttempts: number
  /** Reconnection delay in milliseconds */
  readonly reconnectDelayMs: number
  /** Ping interval in milliseconds */
  readonly pingIntervalMs: number
  /** Message queue size limit */
  readonly maxQueueSize: number
  /** Connection timeout in milliseconds */
  readonly connectionTimeoutMs: number
  /** Enable automatic reconnection */
  readonly autoReconnect: boolean
}

/**
 * WebSocket message interface
 *
 * This interface defines the structure of messages sent and received over the WebSocket connection.
 */
export interface WebSocketMessage {
  readonly type: WSMessageType
  readonly data: unknown
  readonly timestamp: number
  readonly symbol?: string
}

/**
 * Subscription configuration
 *
 * This interface defines the configuration for subscribing to WebSocket channels.
 */
export interface SubscriptionConfig {
  readonly type: WSSubscriptionType
  readonly symbols: readonly string[]
  readonly fields?: readonly string[]
}

/**
 * WebSocket event handlers
 *
 * This interface defines the event handlers for WebSocket events such as message reception, connection, disconnection, and errors.
 */
export interface WebSocketEventHandlers<TError = Error> {
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onError?: (error: TError) => void
  onReconnect?: (attempt: number) => void
}

/**
 * WebSocket connection metrics
 *
 * This interface defines the metrics collected during the WebSocket connection lifecycle, such as connection state, message counts, and timing information.
 */
export interface WebSocketMetrics {
  readonly state: WSConnectionState
  readonly connectTime?: number
  readonly lastMessageTime?: number
  readonly messagesSent: number
  readonly messagesReceived: number
  readonly reconnectAttempts: number
  readonly subscriptionsCount: number
  readonly queueSize: number
}
