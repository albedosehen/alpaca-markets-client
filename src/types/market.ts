/**
 * Market data type options.
 *
 * @property BARS - Represents bar data (OHLCV)
 * @property QUOTES - Represents quote data (bid/ask prices)
 * @property TRADES - Represents trade data (executed trades)
 */
export const MARKET_DATA_TYPE = {
  BARS: 'bars',
  QUOTES: 'quotes',
  TRADES: 'trades',
} as const
export type MarketDataType = typeof MARKET_DATA_TYPE[keyof typeof MARKET_DATA_TYPE]

/**
 * Time frame options for market data queries.
 *
 * @property ONE_MINUTE - 1 minute time frame
 * @property FIVE_MINUTES - 5 minutes time frame
 * @property FIFTEEN_MINUTES - 15 minutes time frame
 * @property THIRTY_MINUTES - 30 minutes time frame
 * @property ONE_HOUR - 1 hour time frame
 * @property ONE_DAY - 1 day time frame
 * @property ONE_WEEK - 1 week time frame
 * @property ONE_MONTH - 1 month time frame
 */
export const TIME_FRAME = {
  ONE_MINUTE: '1Min',
  FIVE_MINUTES: '5Min',
  FIFTEEN_MINUTES: '15Min',
  THIRTY_MINUTES: '30Min',
  ONE_HOUR: '1Hour',
  ONE_DAY: '1Day',
  ONE_WEEK: '1Week',
  ONE_MONTH: '1Month',
} as const
export type TimeFrame = typeof TIME_FRAME[keyof typeof TIME_FRAME]

/**
 * Adjustment types for historical market data.
 *
 * @property RAW - No adjustments applied
 * @property SPLIT - Adjusted for stock splits
 * @property DIVIDEND - Adjusted for dividends
 * @property ALL - Adjusted for both splits and dividends
 */
export const ADJUSTMENT = {
  RAW: 'raw',
  SPLIT: 'split',
  DIVIDEND: 'dividend',
  ALL: 'all',
} as const
export type Adjustment = typeof ADJUSTMENT[keyof typeof ADJUSTMENT]

/**
 * Market data feed types supported by Alpaca Markets API.
 *
 * @property SIP - Securities Information Processor: Official consolidated market data feed from all exchanges
 * @property IEX - Investors Exchange: Real-time market data from IEX exchange only
 * @property OTC - Over-the-Counter: Market data for OTC securities and penny stocks
 */
export const FEED = {
  SIP: 'sip',
  IEX: 'iex',
  OTC: 'otc',
} as const

/**
 * Union type representing the available market data feed options.
 * Used to specify which data source to use when requesting market data from Alpaca.
 */
export type Feed = typeof FEED[keyof typeof FEED]

/**
 * Sort order options for market data queries.
 *
 * @property ASC - Ascending order
 * @property DESC - Descending order
 */
export const SORT = {
  ASC: 'asc',
  DESC: 'desc',
} as const
export type Sort = typeof SORT[keyof typeof SORT]

export type PageToken = string
