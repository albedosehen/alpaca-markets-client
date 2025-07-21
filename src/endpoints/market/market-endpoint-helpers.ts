/**
 * Helpers for Market Endpoint
 * Provides factory functions to create market data clients with default configurations
 * for bars, quotes, and trades, allowing customization of query parameters.
 * @module
 */
import type { MappingService } from '../../services/mapping.service.ts'
import type { QuoteEnhanced } from '../../types/quote.ts'
import type { Bar, BarRaw } from '../../types/bar.ts'
import type { QuoteResponse } from '../../types/quote.ts'
import type { TradeEnhanced, TradeEnhancementConfig, TradeRaw } from '../../types/trade.ts'

/**
 * Maps the API Bar data to the Bar type.
 *
 * @param {BarRaw} rawBar - The raw bar data from the API.
 * @param {string} symbol - The symbol for the bar.
 * @returns {Bar} - The mapped Bar object.
 */
export function mapBarRawToBar(rawBar: BarRaw, symbol: string): Bar {
  return {
    timestamp: new Date(rawBar.t),
    open: rawBar.o,
    high: rawBar.h,
    low: rawBar.l,
    close: rawBar.c,
    volume: rawBar.v,
    tradeCount: rawBar.n,
    vwap: rawBar.vw,
    symbol,
  }
}

/**
 * Maps the raw quotes data to the QuoteEnhanced type.
 *
 * @param {Record<string, QuoteResponse[]>} rawQuotes - The raw quotes data from the API.
 * @param {MappingService} [mappingService] - Optional mapping service for enhancing quotes.
 * @returns {Promise<Record<string, QuoteEnhanced[]>>} - The mapped quotes data.
 */
export async function mapQuotesRawToQuotesEnhanced(
  rawQuotes: Record<string, QuoteResponse[]>,
  mappingService?: MappingService,
): Promise<Record<string, QuoteEnhanced[]>> {
  const result: Record<string, QuoteEnhanced[]> = {}

  for (const [symbol, quotes] of Object.entries(rawQuotes)) {
    result[symbol] = []
    for (const rawQuote of quotes) {
      const basicQuote = {
        timestamp: new Date(rawQuote.t),
        askExchange: rawQuote.ax,
        askPrice: rawQuote.ap,
        askSize: rawQuote.as,
        bidExchange: rawQuote.bx,
        bidPrice: rawQuote.bp,
        bidSize: rawQuote.bs,
        conditions: rawQuote.c,
        symbol,
      }

      if (mappingService) {
        try {
          const enhanced = await mappingService.enhanceQuote(basicQuote)
          result[symbol].push(enhanced)
        } catch {
          // Fallback to basic quote with no enhancements
          result[symbol].push({
            ...basicQuote,
            askExchangeName: undefined,
            bidExchangeName: undefined,
            conditionNames: undefined,
            conditionDescriptions: undefined,
            hasMappings: false,
          })
        }
      } else {
        result[symbol].push({
          ...basicQuote,
          askExchangeName: undefined,
          bidExchangeName: undefined,
          conditionNames: undefined,
          conditionDescriptions: undefined,
          hasMappings: false,
        })
      }
    }
  }

  return result
}

/**
 * Maps the raw trades data to the TradeEnhanced type.
 *
 * @param {Record<string, TradeRaw[]>} rawTrades - The raw trades data from the API.
 * @param {MappingService} [mappingService] - Optional mapping service for enhancing trades.
 * @param {Partial<TradeEnhancementConfig>} [config] - Optional configuration for trade enhancement.
 * @returns {Promise<Record<string, TradeEnhanced[]>>} - The mapped trades data.
 */
export async function mapTradesRawToTradesEnhanced(
  rawTrades: Record<string, TradeRaw[]>,
  mappingService?: MappingService,
  config?: Partial<TradeEnhancementConfig>,
): Promise<Record<string, TradeEnhanced[]>> {
  const result: Record<string, TradeEnhanced[]> = {}

  for (const [symbol, trades] of Object.entries(rawTrades)) {
    result[symbol] = []
    for (const rawTrade of trades) {
      const basicTrade = {
        timestamp: new Date(rawTrade.t),
        exchange: rawTrade.x,
        price: rawTrade.p,
        size: rawTrade.s,
        conditions: rawTrade.c,
        tradeId: rawTrade.i,
        tape: rawTrade.z,
        symbol,
      }

      if (mappingService) {
        try {
          const enhanced = await mappingService.enhanceTrade(basicTrade, config)
          result[symbol].push(enhanced)
        } catch {
          // Fallback to basic trade with no enhancements
          result[symbol].push({
            ...basicTrade,
            exchangeName: undefined,
            tapeDescription: undefined,
            conditionNames: undefined,
            conditionDescriptions: undefined,
            hasMappings: false,
          })
        }
      } else {
        result[symbol].push({
          ...basicTrade,
          exchangeName: undefined,
          tapeDescription: undefined,
          conditionNames: undefined,
          conditionDescriptions: undefined,
          hasMappings: false,
        })
      }
    }
  }

  return result
}
