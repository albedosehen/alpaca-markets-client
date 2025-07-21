/**
 * Types and interfaces for Market Endpoint
 * Defines types and interfaces for market data queries,
 * including parameters for bars, quotes, trades, and latest data retrieval.
 * @module
 */

import type { Adjustment, Feed, PageToken, Sort, TimeFrame } from '../../types/market.ts'

/**
 * Base parameters for market data queries.
 * @property symbols - A single symbol or an array of symbols to query.
 * @property start - Start date for the query, can be a string or Date object.
 * @property end - End date for the query, can be a string or Date object.
 * @property pageToken - Token for pagination.
 * @property limit - Maximum number of results to return.
 * @property asof - A specific date to retrieve data as of that date.
 */
export interface BaseParams {
  symbols: string | string[]
  start?: string | Date
  end?: string | Date
  pageToken?: PageToken
  limit?: number
  asof?: string
}

/**
 * Parameters for bar data queries.
 * Extends BaseParams with additional fields specific to bar data.
 * @property timeframe - The time frame for the bars (e.g., 1 minute, 5 minutes).
 * @property adjustment - Type of adjustment to apply to the data (e.g., split, dividend).
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 * @property sort - Sorting order for the results.
 */
export interface BarParams extends BaseParams {
  timeframe: TimeFrame
  adjustment?: Adjustment
  feed?: Feed
  sort?: Sort
}

/**
 * Parameters for quote data queries.
 * Extends BaseParams with additional fields specific to quote data.
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 * @property sort - Sorting order for the results.
 */
export interface QuoteParams extends BaseParams {
  feed?: Feed
  sort?: Sort
}

/**
 * Parameters for trade data queries.
 * Extends BaseParams with additional fields specific to trade data.
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 * @property sort - Sorting order for the results.
 */
export interface TradeParams extends BaseParams {
  feed?: Feed
  sort?: Sort
}

/**
 * Parameters for retrieving the latest bar data.
 * @property symbols - A single symbol or an array of symbols to query.
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 */
export interface LatestBarParams {
  symbols: string | string[]
  feed?: Feed
}

/**
 * Parameters for retrieving the latest quote data.
 * @property symbols - A single symbol or an array of symbols to query.
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 */
export interface LatestQuoteParams {
  symbols: string | string[]
  feed?: Feed
}

/**
 * Parameters for retrieving the latest trade data.
 * @property symbols - A single symbol or an array of symbols to query.
 * @property feed - The market data feed to use (e.g., SIP, IEX).
 */
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

/** Market data time frame type for Market Data Endpoint */
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

/** Market data feed type for Market Data Endpoint */
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

/** Market data adjustment type for Market Data Endpoint */
export type MarketDataAdjustment = typeof MARKET_DATA_ADJUSTMENT[keyof typeof MARKET_DATA_ADJUSTMENT]
