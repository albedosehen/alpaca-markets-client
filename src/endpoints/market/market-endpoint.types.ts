import type { Adjustment, Feed, PageToken, Sort, TimeFrame } from '../../types/market.ts'

export interface BaseParams {
  symbols: string | string[]
  start?: string | Date
  end?: string | Date
  pageToken?: PageToken
  limit?: number
  asof?: string
}

export interface BarParams extends BaseParams {
  timeframe: TimeFrame
  adjustment?: Adjustment
  feed?: Feed
  sort?: Sort
}

export interface QuoteParams extends BaseParams {
  feed?: Feed
  sort?: Sort
}

export interface TradeParams extends BaseParams {
  feed?: Feed
  sort?: Sort
}

export interface LatestBarParams {
  symbols: string | string[]
  feed?: Feed
}

export interface LatestQuoteParams {
  symbols: string | string[]
  feed?: Feed
}

export interface LatestTradeParams {
  symbols: string | string[]
  feed?: Feed
}

/**
 * Alpaca Market timeframes for Market Data queries.
 *
 * @property ONE_MINUTE - 1 minute intervals
 * @property FIVE_MINUTES - 5 minute intervals
 * @property FIFTEEN_MINUTES - 15 minute intervals
 * @property THIRTY_MINUTES - 30 minute intervals
 * @property ONE_HOUR - 1 hour intervals
 * @property ONE_DAY - 1 day intervals
 * @property ONE_WEEK - 1 week intervals
 * @property ONE_MONTH - 1 month intervals
 */
export const MARKET_DATA_TIMEFRAME = {
  ONE_MINUTE: '1Min',
  FIVE_MINUTES: '5Min',
  FIFTEEN_MINUTES: '15Min',
  THIRTY_MINUTES: '30Min',
  ONE_HOUR: '1Hour',
  ONE_DAY: '1Day',
  ONE_WEEK: '1Week',
  ONE_MONTH: '1Month',
} as const
export type MarketDataTimeFrame = typeof MARKET_DATA_TIMEFRAME[keyof typeof MARKET_DATA_TIMEFRAME]

/**
 * Alpaca feed types for market data.
 *
 * @property SIP - Securities Information Processor: Official consolidated market data feed from all exchanges
 * @property IEX - Investors Exchange: Real-time market data from IEX exchange only
 * @property OTC - Over-the-Counter: Market data for OTC securities and penny stocks
 */
export const MARKET_DATA_FEED = {
  SIP: 'sip',
  IEX: 'iex',
  OTC: 'otc',
} as const
export type MarketDataFeed = typeof MARKET_DATA_FEED[keyof typeof MARKET_DATA_FEED]

/**
 * Adjustment options for historical Market Data queries.
 *
 * @property RAW - No adjustments applied
 * @property SPLIT - Adjusted for stock splits
 * @property DIVIDEND - Adjusted for dividends
 * @property ALL - Adjusted for both splits and dividends
 */
export const MARKET_DATA_ADJUSTMENT = {
  RAW: 'raw',
  SPLIT: 'split',
  DIVIDEND: 'dividend',
  ALL: 'all',
} as const
export type MarketDataAdjustment = typeof MARKET_DATA_ADJUSTMENT[keyof typeof MARKET_DATA_ADJUSTMENT]
