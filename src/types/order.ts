import type { Sort } from './market.ts'

/**
 * Time in force options for order execution.
 *
 * May not encompass all possible values.
 *
 * @property Day - Order is valid for the day
 * @property GTC - Good 'Til Canceled, order remains active until filled or canceled
 * @property IOC - Immediate Or Cancel, order must be filled immediately, any unfilled portion is canceled
 * @property FOK - Fill Or Kill, order must be filled immediately or canceled
 * @property OPG - At the Opening, order is executed at market open
 * @property CLS - At the Close, order is executed at market close
 */
export const TIME_IN_FORCE = {
  Day: 'day',
  GTC: 'gtc', // Good Till Canceled
  IOC: 'ioc', // Immediate or Cancel
  FOK: 'fok', // Fill or Kill
  OPG: 'opg', // At the Opening
  CLS: 'cls', // At the Close
} as const
export type TimeInForce = typeof TIME_IN_FORCE[keyof typeof TIME_IN_FORCE]

/**
 * Order class types for grouping related orders.
 *
 * @property SIMPLE - Simple order
 * @property BRACKET - Bracket order with take profit and stop loss
 * @property OCO - One Cancels Other, two orders where if one is filled, the other is canceled
 * @property OTO - One Triggers Other, a primary order that triggers secondary orders
 */
export const ORDER_CLASS = {
  SIMPLE: 'simple',
  BRACKET: 'bracket',
  OCO: 'oco',
  OTO: 'oto',
} as const
export type OrderClass = typeof ORDER_CLASS[keyof typeof ORDER_CLASS]
/**
 * Sort order options for market data queries.
 *
 * @property Buy - Buy order
 * @property Sell - Sell order
 */
export const ORDER_SIDE = {
  Buy: 'buy',
  Sell: 'sell',
} as const
export type OrderSide = typeof ORDER_SIDE[keyof typeof ORDER_SIDE]

/**
 * Order type values for specifying order behavior.
 *
 * @property Market - Market order
 * @property Limit - Limit order
 * @property Stop - Stop order
 * @property StopLimit - Stop limit order
 * @property TrailingStop - Trailing stop order
 */
export const ORDER_TYPE = {
  Market: 'market',
  Limit: 'limit',
  Stop: 'stop',
  StopLimit: 'stop_limit',
  TrailingStop: 'trailing_stop',
} as const
export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE]

/**
 * Order status values for tracking order lifecycle.
 *
 * May not encompass all possible values.
 *
 * @property New - Order is new
 * @property PartiallyFilled - Order is partially filled
 * @property Filled - Order is fully filled
 * @property DoneForDay - Order is done for the day
 * @property Canceled - Order is canceled
 * @property Expired - Order has expired
 * @property Replaced - Order has been replaced by another order
 * @property PendingCancel - Order is pending cancellation
 * @property PendingReplace - Order is pending replacement
 * @property PendingReview - Order is pending review
 * @property Accepted - Order is accepted
 * @property PendingNew - Order is pending new
 * @property AcceptedForBidding - Order is accepted for bidding
 * @property Stopped - Order is stopped
 * @property Rejected - Order is rejected
 * @property Suspended - Order is suspended
 * @property Calculated - Order is calculated
 */
export const ORDER_STATUS = {
  New: 'new',
  PartiallyFilled: 'partially_filled',
  Filled: 'filled',
  DoneForDay: 'done_for_day',
  Canceled: 'canceled',
  Expired: 'expired',
  Replaced: 'replaced',
  PendingCancel: 'pending_cancel',
  PendingReplace: 'pending_replace',
  PendingReview: 'pending_review',
  Accepted: 'accepted',
  PendingNew: 'pending_new',
  AcceptedForBidding: 'accepted_for_bidding',
  Stopped: 'stopped',
  Rejected: 'rejected',
  Suspended: 'suspended',
  Calculated: 'calculated',
} as const
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

/**
 * Base interface for an order.
 *
 * This interface defines the common properties for all order types in Alpaca Market's trading API.
 */
interface OrderBase {
  /** Unique identifier for the order */
  id: string
  /** Symbol for the asset being traded */
  symbol: string
  /** Quantity of the asset to be traded */
  qty: string
  /** Side of the order (buy/sell) */
  side: OrderSide
  /** Time in force for the order */
  time_in_force: TimeInForce
  /** Status of the order */
  status: OrderStatus
  /** The type of the order (market, limit, etc.) */
  order_type: OrderType
  /** Created at timestamp (ISO 8601 format) */
  created_at: string
  /** Updated at timestamp (ISO 8601 format) */
  updated_at: string
  /** Submitted at timestamp (ISO 8601 format) */
  submitted_at: string
  /** Filled at timestamp (ISO 8601 format) */
  filled_at?: string
  /** Expired at timestamp (ISO 8601 format) */
  expired_at?: string
  /** Canceled at timestamp (ISO 8601 format) */
  canceled_at?: string
  /** Failed at timestamp (ISO 8601 format) */
  failed_at?: string
  /** Replaced at timestamp (ISO 8601 format) */
  replaced_at?: string
  /** Filled quantity */
  filled_qty: string
  /** Filled average price */
  filled_avg_price?: string
  /** Order class (simple, bracket, etc.) */
  order_class?: OrderClass
  /** The legs of the order (for multi-leg orders) */
  legs?: OrderBase[]
  /** Trailing percent */
  trail_percent?: string
  /** Trailing price */
  trail_price?: string
  /** High water mark (for trailing stop orders) */
  hwm?: string
}
export type Order = OrderBase

/**
 * Request interface for creating a new order.
 *
 * This interface defines the required and optional fields for creating an order in Alpaca's trading API.
 */
export interface CreateOrderRequest {
  symbol: string
  qty: string
  side: OrderSide
  type: OrderType
  time_in_force: TimeInForce
  limit_price?: string
  stop_price?: string
  trail_percent?: string
  trail_price?: string
  extended_hours?: boolean
  client_order_id?: string
  order_class?: OrderClass
  take_profit?: {
    limit_price: string
  }
  stop_loss?: {
    stop_price: string
    limit_price?: string
  }
}

/**
 * Request interface for updating an existing order.
 *
 * This interface defines the fields that can be updated for an existing order in Alpaca's trading API.
 */
export interface UpdateOrderRequest {
  qty?: string
  time_in_force?: TimeInForce
  limit_price?: string
  stop_price?: string
  trail?: string
  client_order_id?: string
}

/**
 * Parameters for retrieving orders.
 *
 * This interface defines the query parameters that can be used to filter and sort orders when retrieving them from Alpaca's trading API.
 */
export interface GetOrdersParams extends Record<string, unknown> {
  status?: 'open' | 'closed' | 'all'
  limit?: number
  after?: string
  until?: string
  direction?: Sort
  nested?: boolean
  symbols?: string
}
