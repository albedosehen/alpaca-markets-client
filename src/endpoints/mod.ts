/**
 * Alpaca Markets API Endpoints
 */

/** Market Data Endpoint */
export { MarketDataEndpoint } from './market/market-endpoint.ts'
export {
  type BarParams,
  type BaseParams,
  type LatestBarParams,
  type LatestQuoteParams,
  type LatestTradeParams,
  MARKET_DATA_ADJUSTMENT,
  MARKET_DATA_FEED,
  MARKET_DATA_TIMEFRAME,
  type MarketDataAdjustment,
  type MarketDataFeed,
  type MarketDataTimeFrame,
  type QuoteParams,
  type TradeParams,
} from './market/market-endpoint.types.ts'
export {
  mapBarRawToBar,
  mapQuotesRawToQuotesEnhanced,
  mapTradesRawToTradesEnhanced,
} from './market/market-endpoint-helpers.ts'

/** Metadata Endpoint */
export { MetadataEndpoint } from './metadata/metadata-endpoint.ts'
export { type ConditionsParams } from './metadata/metadata-endpoint.types.ts'

/** Trading Endpoint */
export { AlpacaTradeEndpoint } from './trade/trade-endpoint.ts'
export {
  createConservativeTradingClient,
  createHighFrequencyTradingClient,
  createTradingClient,
} from './trade/trade-endpoint-helpers.ts'
export { type GetAccountActivitiesParams, type TradingClientConfig } from './trade/trade-endpoint.types.ts'

/** Stream Endpoint */
export { AlpacaMarketStreamEndpoint } from './stream/stream-endpoint.ts'
export { AlpacaStreamFactory } from './stream/stream-endpoint-helpers.ts'
