import type { AlpacaMarketClient } from '../../client/alpaca.ts'
import type { MappingService } from '../../services/mapping.service.ts'
import type { QuoteEnhanced } from '../../types/quote.ts'
import type { TradeEnhanced, TradeEnhancementConfig } from '../../types/trade.ts'
import type { Bar, BarRaw } from '../../types/bar.ts'
import type {
  BarParams,
  LatestBarParams,
  LatestQuoteParams,
  LatestTradeParams,
  QuoteParams,
  TradeParams,
} from './market-endpoint.types.ts'
import type { QuoteResponse } from '../../types/quote.ts'
import type { PaginatedResponse } from '../../types/response.ts'
import type { TradeRaw } from '../../types/trade.ts'
import { AlpacaMarketErrorContext } from '../../errors/errors.ts'
import {
  mapBarRawToBar,
  mapQuotesRawToQuotesEnhanced,
  mapTradesRawToTradesEnhanced,
} from './market-endpoint-helpers.ts'

/**
 * Endpoints for Alpaca Market Data API
 *
 * This class provides methods to interact with the Alpaca Market Data API,
 * including fetching historical and latest bars, quotes, and trades.
 * It supports both raw and enhanced data retrieval, with optional mapping
 * for enhanced metadata.
 *
 * @param {AlpacaMarketClient} client - The Alpaca Market Client instance.
 * @param {MappingService} [mappingService] - Optional mapping service for enhancing data.
 * @return {MarketDataEndpoint} - An instance of MarketDataEndpoints.
 * @throws {AlpacaMarketErrorContext} - Throws an error if the API request fails.
 *
 * @example Basic Usage:
 * ```typescript
 * const marketDataClient = new AlpacaMarketClient(config);
 * const marketDataEndpoints = new MarketDataEndpoints(marketDataClient);
 * ```
 *
 * @example With Mapping Service:
 * ```typescript
 * const mappingService = new MappingService();
 * const marketDataEndpoints = new MarketDataEndpoints(marketDataClient, mappingService);
 * ```
 *
 * @example Fetching Historical Bars:
 * ```typescript
 * const bars = await marketDataEndpoints.getBars({
 *   symbols: 'NVDA',
 * });
 * ```
 */
export class MarketDataEndpoint {
  constructor(
    private client: AlpacaMarketClient,
    private mappingService?: MappingService,
  ) {}

  /**
   * Get historical bars for one or more symbols
   *
   * @param {BarParams} params - The parameters for the bars request.
   * @return {Promise<PaginatedResponse<Record<string, Bar[]>>>} The historical bars for the specified symbols.
   */
  async getBars(params: BarParams): Promise<PaginatedResponse<Record<string, Bar[]>>> {
    try {
      const response = await this.client.request<
        { value: { bars: Record<string, BarRaw[]>; next_page_token?: string } }
      >('/v2/stocks/bars', {
        method: 'GET',
        params: this.buildBarParams(params),
        useDataUrl: true,
      })

      const result = this.transformBarsResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getBars',
        requestId: 'getBars',
        metadata: { params },
      })
    }
  }

  /**
   * Get latest bars for one or more symbols
   *
   * @param {LatestBarParams} params - The parameters for the latest bars request.
   * @return {Promise<Record<string, Bar>>} The latest bars for the specified symbols.
   */
  async getLatestBars(params: LatestBarParams): Promise<Record<string, Bar>> {
    try {
      const response = await this.client.request<{ bars: Record<string, BarRaw> }>(
        '/v2/stocks/bars/latest',
        {
          method: 'GET',
          params: this.buildLatestBarParams(params),
          useDataUrl: true,
        },
      )

      const result = this.transformLatestBarsResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getLatestBars',
        requestId: 'getLatestBars',
        metadata: { params },
      })
    }
  }

  /**
   * Get historical quotes for one or more symbols
   *
   * @param {QuoteParams} params - The parameters for the quotes request.
   * @return {Promise<PaginatedResponse<Record<string, QuoteEnhanced[]>>>} The historical quotes for the specified symbols.
   */
  async getQuotes(params: QuoteParams): Promise<PaginatedResponse<Record<string, QuoteEnhanced[]>>> {
    try {
      const response = await this.client.request<
        { value: { quotes: Record<string, QuoteResponse[]>; next_page_token?: string } }
      >('/v2/stocks/quotes', {
        method: 'GET',
        params: this.buildQuoteParams(params),
        useDataUrl: true,
      })

      const result = await this.transformQuotesResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getQuotes',
        requestId: 'getQuotes',
        metadata: { params },
      })
    }
  }

  /**
   * Get latest quotes for one or more symbols
   *
   * @param {LatestQuoteParams} params - The parameters for the latest quotes request.
   * @return {Promise<Record<string, QuoteEnhanced>>} The latest quotes for the specified symbols.
   */
  async getLatestQuotes(params: LatestQuoteParams): Promise<Record<string, QuoteEnhanced>> {
    try {
      const response = await this.client.request<{ value: { quotes: Record<string, QuoteResponse> } }>(
        '/v2/stocks/quotes/latest',
        {
          method: 'GET',
          params: this.buildLatestQuoteParams(params),
          useDataUrl: true,
        },
      )

      const result = await this.transformLatestQuotesResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getLatestQuotes',
        requestId: 'getLatestQuotes',
        metadata: { params },
      })
    }
  }

  /**
   * Get historical trades for one or more symbols
   *
   * @param {TradeParams} params - The parameters for the trades request.
   * @returns {Promise<PaginatedResponse<Record<string, TradeEnhanced[]>>>} The historical trades for the specified symbols.
   */
  async getTrades(params: TradeParams): Promise<PaginatedResponse<Record<string, TradeEnhanced[]>>> {
    try {
      const response = await this.client.request<
        { value: { trades: Record<string, TradeRaw[]>; next_page_token?: string } }
      >('/v2/stocks/trades', {
        method: 'GET',
        params: this.buildTradeParams(params),
        useDataUrl: true,
      })

      const result = await this.transformTradesResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getTrades',
        requestId: 'getTrades',
        metadata: { params },
      })
    }
  }

  /**
   * Get latest trades for one or more symbols
   *
   * @param {LatestTradeParams} params - The parameters for the latest trades request.
   * @returns {Promise<Record<string, TradeEnhanced>>} The latest trades for the specified symbols.
   */
  async getLatestTrades(params: LatestTradeParams): Promise<Record<string, TradeEnhanced>> {
    try {
      const response = await this.client.request<{ value: { trades: Record<string, TradeRaw> } }>(
        '/v2/stocks/trades/latest',
        {
          method: 'GET',
          params: this.buildLatestTradeParams(params),
          useDataUrl: true,
        },
      )

      const result = await this.transformLatestTradesResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getLatestTrades',
        requestId: 'getLatestTrades',
        metadata: { params },
      })
    }
  }

  /**
   * Get historical trades for one or more symbols with enhanced metadata mappings
   *
   * @param params - Trade query parameters
   * @param config - Enhancement configuration (optional)
   * @returns Enhanced trades with human-readable mappings
   */
  async getTradesEnhanced(
    params: TradeParams,
    config?: Partial<TradeEnhancementConfig>,
  ): Promise<PaginatedResponse<Record<string, TradeEnhanced[]>>> {
    if (!this.mappingService) {
      const { data, nextPageToken } = await this.getTrades(params)

      if (!data) {
        return {
          data: {},
          nextPageToken,
        }
      }

      const enhancedData: Record<string, TradeEnhanced[]> = {}
      for (const [symbol, trades] of Object.entries(data)) {
        enhancedData[symbol] = trades.map((trade) => ({
          ...trade,
          exchangeName: undefined,
          tapeDescription: undefined,
          conditionNames: undefined,
          conditionDescriptions: undefined,
          hasMappings: false,
        }))
      }
      return {
        data: enhancedData,
        nextPageToken,
      }
    }

    try {
      const response = await this.client.request<
        { value: { trades: Record<string, TradeRaw[]>; next_page_token?: string } }
      >('/v2/stocks/trades', {
        method: 'GET',
        params: this.buildTradeParams(params),
        useDataUrl: true,
      })

      const result = await this.transformTradesEnhancedResponse(response, config)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getTradesEnhanced',
        requestId: 'getTradesEnhanced',
        metadata: { params, config },
      })
    }
  }

  /**
   * Get latest trades for one or more symbols with enhanced metadata mappings
   *
   * @param params - Latest trade query parameters
   * @param config - Enhancement configuration (optional)
   * @returns Enhanced latest trades with human-readable mappings
   */
  async getLatestTradesEnhanced(
    params: LatestTradeParams,
    config?: Partial<TradeEnhancementConfig>,
  ): Promise<Record<string, TradeEnhanced>> {
    // If no mapping service available, fall back to regular trades
    if (!this.mappingService) {
      const trades = await this.getLatestTrades(params)

      // Convert regular trades to enhanced format without mappings
      const enhancedTrades: Record<string, TradeEnhanced> = {}
      for (const [symbol, trade] of Object.entries(trades)) {
        enhancedTrades[symbol] = {
          ...trade,
          exchangeName: undefined,
          tapeDescription: undefined,
          conditionNames: undefined,
          conditionDescriptions: undefined,
          hasMappings: false,
        }
      }
      return enhancedTrades
    }

    try {
      const response = await this.client.request<{ value: { trades: Record<string, TradeRaw> } }>(
        '/v2/stocks/trades/latest',
        {
          method: 'GET',
          params: this.buildLatestTradeParams(params),
          useDataUrl: true,
        },
      )

      const result = await this.transformLatestTradesEnhancedResponse(response, config)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getLatestTradesEnhanced',
        requestId: 'getLatestTradesEnhanced',
        metadata: { params, config },
      })
    }
  }

  /**
   * Build the request parameters for the bars API endpoint.
   * @param {BarParams} params - The parameters for the bars request.
   * @returns The request parameters for the bars API.
   * @private
   */
  private buildBarParams(params: BarParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      timeframe: params.timeframe,
      start: params.start ? this.formatDate(params.start) : undefined,
      end: params.end ? this.formatDate(params.end) : undefined,
      adjustment: params.adjustment,
      feed: params.feed,
      sort: params.sort,
      limit: params.limit,
      page_token: params.pageToken,
      asof: params.asof,
    }
  }

  /**
   * Build the request parameters for the latest bars API endpoint.
   * @param {LatestBarParams} params - The parameters for the latest bars request.
   * @returns The request parameters for the latest bars API.
   * @private
   */
  private buildLatestBarParams(params: LatestBarParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      feed: params.feed,
    }
  }

  /**
   * Build the request parameters for the quotes API endpoint.
   * @param {QuoteParams} params - The parameters for the quotes request.
   * @returns The request parameters for the quotes API.
   * @private
   */
  private buildQuoteParams(params: QuoteParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      start: params.start ? this.formatDate(params.start) : undefined,
      end: params.end ? this.formatDate(params.end) : undefined,
      feed: params.feed,
      sort: params.sort,
      limit: params.limit,
      page_token: params.pageToken,
      asof: params.asof,
    }
  }

  /**
   * Build the request parameters for the latest quotes API endpoint.
   * @param {LatestQuoteParams} params - The parameters for the latest quotes request.
   * @returns The request parameters for the latest quotes API.
   * @private
   */
  private buildLatestQuoteParams(params: LatestQuoteParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      feed: params.feed,
    }
  }

  /**
   * Build the request parameters for the trades API endpoint.
   * @param {TradeParams} params - The parameters for the trades request.
   * @returns The request parameters for the trades API.
   * @private
   */
  private buildTradeParams(params: TradeParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      start: params.start ? this.formatDate(params.start) : undefined,
      end: params.end ? this.formatDate(params.end) : undefined,
      feed: params.feed,
      sort: params.sort,
      limit: params.limit,
      page_token: params.pageToken,
      asof: params.asof,
    }
  }

  /**
   * Build the request parameters for the latest trades API endpoint.
   * @param {LatestTradeParams} params - The parameters for the latest trades request.
   * @returns The request parameters for the latest trades API.
   * @private
   */
  private buildLatestTradeParams(params: LatestTradeParams): Record<string, unknown> {
    return {
      symbols: Array.isArray(params.symbols) ? params.symbols.join(',') : params.symbols,
      feed: params.feed,
    }
  }

  /**
   * Format a date to an ISO string.
   * @param date - The date to format, can be a string or Date object.
   * @returns The formatted date string.
   * @private
   */
  private formatDate(date: string | Date): string {
    if (typeof date === 'string') {
      return date
    }
    return date.toISOString()
  }

  /**
   * Transform the bars response
   * @param {Object} response - The API response containing raw bars data
   * @param {Object} logger - The logger instance
   * @returns A paginated response of transformed bars
   * @private
   */
  private transformBarsResponse(
    response: { value: { bars: Record<string, BarRaw[]>; next_page_token?: string } },
  ): PaginatedResponse<Record<string, Bar[]>> {
    if (!response?.value?.bars) {
      return {
        data: {},
        nextPageToken: response?.value?.next_page_token,
      }
    }

    const transformedBars: Record<string, Bar[]> = {}

    for (const [symbol, rawBars] of Object.entries(response.value.bars)) {
      transformedBars[symbol] = rawBars.map((rawBar) => mapBarRawToBar(rawBar, symbol))
    }

    return {
      data: transformedBars,
      nextPageToken: response.value.next_page_token,
    }
  }

  /**
   * Transform the latest bars response
   * @param {Object} response - The API response
   * @param {Object} logger - The logger instance
   * @returns A record of transformed bars
   * @private
   */
  private transformLatestBarsResponse(
    response: { bars: Record<string, BarRaw> },
  ): Record<string, Bar> {
    if (!response?.bars) {
      return {}
    }

    const transformedBars: Record<string, Bar> = {}

    for (const [symbol, rawBar] of Object.entries(response.bars)) {
      transformedBars[symbol] = mapBarRawToBar(rawBar, symbol)
    }

    return transformedBars
  }

  /**
   * Transform the quotes response
   * @param response - The API response
   * @param logger - The logger instance
   * @returns A promise that resolves to a paginated response of enhanced quotes
   * @private
   */
  private async transformQuotesResponse(
    response: { value: { quotes: Record<string, QuoteResponse[]>; next_page_token?: string } },
  ): Promise<PaginatedResponse<Record<string, QuoteEnhanced[]>>> {
    if (!response?.value?.quotes) {
      return {
        data: {},
        nextPageToken: response?.value?.next_page_token,
      }
    }

    // Use the enhanced mapper with mapping service
    const enhancedQuotes = await mapQuotesRawToQuotesEnhanced(response.value.quotes, this.mappingService)

    return {
      data: enhancedQuotes,
      nextPageToken: response.value.next_page_token,
    }
  }

  /**
   * Transform the latest quotes response
   * @param response - The API response
   * @param logger - The logger instance
   * @returns A promise that resolves to a record of enhanced quotes
   * @private
   */
  private async transformLatestQuotesResponse(
    response: { value: { quotes: Record<string, QuoteResponse> } },
  ): Promise<Record<string, QuoteEnhanced>> {
    if (!response?.value?.quotes) {
      return {}
    }

    const quotesAsArrays: Record<string, QuoteResponse[]> = {}
    for (const [symbol, quote] of Object.entries(response.value.quotes)) {
      quotesAsArrays[symbol] = [quote]
    }

    const enhancedQuotesArrays = await mapQuotesRawToQuotesEnhanced(quotesAsArrays, this.mappingService)

    const enhancedQuotes: Record<string, QuoteEnhanced> = {}
    for (const [symbol, quotesArray] of Object.entries(enhancedQuotesArrays)) {
      if (quotesArray.length > 0) {
        enhancedQuotes[symbol] = quotesArray[0]
      }
    }

    return enhancedQuotes
  }

  /**
   * Transform the trades response
   * @param response - The API response
   * @param logger - The logger instance
   * @returns A promise that resolves to a paginated response of enhanced trades
   * @private
   */
  private async transformTradesResponse(
    response: { value: { trades: Record<string, TradeRaw[]>; next_page_token?: string } },
  ): Promise<PaginatedResponse<Record<string, TradeEnhanced[]>>> {
    if (!response?.value?.trades) {
      return {
        data: {},
        nextPageToken: response?.value?.next_page_token,
      }
    }

    // Use the enhanced mapper with mapping service
    const enhancedTrades = await mapTradesRawToTradesEnhanced(response.value.trades, this.mappingService)

    return {
      data: enhancedTrades,
      nextPageToken: response.value.next_page_token,
    }
  }

  /**
   * Transform the latest trades response
   * @param response - The API response
   * @param logger - The logger instance
   * @returns A promise that resolves to a record of enhanced trades
   * @private
   */
  private async transformLatestTradesResponse(
    response: { value: { trades: Record<string, TradeRaw> } },
  ): Promise<Record<string, TradeEnhanced>> {
    if (!response?.value?.trades) {
      return {}
    }

    const tradesAsArrays: Record<string, TradeRaw[]> = {}
    for (const [symbol, trade] of Object.entries(response.value.trades)) {
      tradesAsArrays[symbol] = [trade]
    }

    const enhancedTradesArrays = await mapTradesRawToTradesEnhanced(tradesAsArrays, this.mappingService)

    const enhancedTrades: Record<string, TradeEnhanced> = {}
    for (const [symbol, tradesArray] of Object.entries(enhancedTradesArrays)) {
      if (tradesArray.length > 0) {
        enhancedTrades[symbol] = tradesArray[0]
      }
    }

    return enhancedTrades
  }

  /**
   * Transform enhanced trades response using mapping service
   *
   * @private
   */
  private async transformTradesEnhancedResponse(
    response: { value: { trades: Record<string, TradeRaw[]>; next_page_token?: string } },
    config?: Partial<TradeEnhancementConfig>,
  ): Promise<PaginatedResponse<Record<string, TradeEnhanced[]>>> {
    if (!response.value.trades) {
      return {
        data: {},
        nextPageToken: response.value.next_page_token,
      }
    }

    const enhancedTrades = await mapTradesRawToTradesEnhanced(response.value.trades, this.mappingService, config)

    return {
      data: enhancedTrades,
      nextPageToken: response.value.next_page_token,
    }
  }

  /**
   * Transform enhanced latest trades response using mapping service
   *
   * @private
   */
  private async transformLatestTradesEnhancedResponse(
    response: { value: { trades: Record<string, TradeRaw> } },
    config?: Partial<TradeEnhancementConfig>,
  ): Promise<Record<string, TradeEnhanced>> {
    if (!response.value.trades) {
      return {}
    }

    const tradesAsArrays: Record<string, TradeRaw[]> = {}
    for (const [symbol, trade] of Object.entries(response.value.trades)) {
      tradesAsArrays[symbol] = [trade]
    }

    const enhancedTradesArrays = await mapTradesRawToTradesEnhanced(tradesAsArrays, this.mappingService, config)

    const enhancedTrades: Record<string, TradeEnhanced> = {}
    for (const [symbol, tradesArray] of Object.entries(enhancedTradesArrays)) {
      if (tradesArray.length > 0) {
        enhancedTrades[symbol] = tradesArray[0]
      }
    }

    return enhancedTrades
  }
}
