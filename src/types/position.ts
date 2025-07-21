/**
 * Position Types for Alpaca Markets Client
 * Provides types and interfaces for trading positions, including position classes,
 * position sides, and position data.
 * @module
 */
import type { Serialized } from '../utils/serializer.ts'

/**
 * Position classes for different asset types.
 *
 * @property US_EQUITY - US equity positions
 * @property CRYPTO - Cryptocurrency positions
 */
export const POSITION_CLASS = {
  US_EQUITY: 'us_equity',
  CRYPTO: 'crypto',
} as const
export type PositionClass = typeof POSITION_CLASS[keyof typeof POSITION_CLASS]

/**
 * Position side options for long and short positions.
 *
 * @property Long - Long position
 * @property Short - Short position
 */
export const POSITION_SIDE = {
  Long: 'long',
  Short: 'short',
} as const
export type PositionSide = typeof POSITION_SIDE[keyof typeof POSITION_SIDE]

/**
 * Base interface for a trading position.
 */
interface PositionBase {
  /** Trading symbol */
  symbol: string
  /** Asset ID */
  asset_id: string
  /** Exchange */
  exchange: string
  /** Asset class */
  asset_class: PositionClass
  /** Whether asset is marginable */
  asset_marginable?: boolean
  /** Quantity owned */
  qty: string
  /** Average entry price */
  avg_entry_price: string
  /** Position side */
  side: PositionSide
  /** Current market value */
  market_value: string
  /** Total cost basis */
  cost_basis: string
  /** Unrealized profit/loss */
  unrealized_pl: string
  /** Unrealized profit/loss percentage */
  unrealized_plpc: string
  /** Unrealized intraday profit/loss */
  unrealized_intraday_pl: string
  /** Unrealized intraday profit/loss percentage */
  unrealized_intraday_plpc: string
  /** Current price */
  current_price: string
  /** Previous day close price */
  lastday_price: string
  /** Price change today */
  change_today: string
  /** Quantity available for trading */
  qty_available?: string
}

/**
 * Type for a position response from Alpaca Market API.
 */
export type Position = Serialized<PositionBase>

/**
 * Request interface for closing a position.
 */
export interface ClosePositionRequest {
  /** Quantity to close */
  qty?: string
  /** Percentage of the position to close */
  percentage?: string
}
