/**
 * Mapping service for enhancing trade and quote data
 * with metadata such as exchange names, tape descriptions, and condition mappings.
 * @module
 */
import { AlpacaMarketErrorContext } from '../errors/errors.ts'
import type { MetadataCache } from './metadata-cache.service.ts'
import {
  DEFAULT_ENHANCEMENT_CONFIG,
  type Trade,
  type TradeEnhanced,
  type TradeEnhancementConfig,
  type TradeMappingStatus,
} from '../types/trade.ts'
import {
  DEFAULT_QUOTE_ENHANCEMENT_CONFIG,
  type Quote,
  type QuoteEnhanced,
  type QuoteEnhancementConfig,
} from '../types/quote.ts'
import { validateQueryValue } from '../validators/validatorHelpers.ts'

/**
 * Configuration for the mapping service
 */
export interface MappingServiceConfig {
  /** Default enhancement configuration */
  readonly defaultEnhancementConfig: TradeEnhancementConfig
  /** Whether to validate enhanced trades with schema */
  readonly validateOutput: boolean
  /** Whether to cache enhancement results */
  readonly cacheEnhancements: boolean
  /** Enable debug logging (default: false) */
  readonly debug?: boolean
}

/**
 * Default configuration for mapping service
 */
const DEFAULT_CONFIG: MappingServiceConfig = {
  defaultEnhancementConfig: DEFAULT_ENHANCEMENT_CONFIG,
  validateOutput: true,
  cacheEnhancements: false, // Disabled by default to avoid memory issues
}

/**
 * Service for orchestrating trade data enhancement with metadata mappings
 *
 * This service provides the core business logic for enriching trade data
 * with human-readable names and descriptions by coordinating metadata
 * lookups through the metadata cache.
 */
export class MappingService {
  private readonly enhancementCache = new Map<string, TradeEnhanced>()
  private readonly debug: boolean

  constructor(
    private readonly metadataCache: MetadataCache,
    private readonly config: MappingServiceConfig = DEFAULT_CONFIG,
  ) {
    this.debug = config.debug ?? false
  }

  /**
   * Enhance a single trade with metadata mappings
   *
   * @param trade - The trade to enhance
   * @param config - Enhancement configuration (optional)
   * @returns Enhanced trade with mapped metadata
   */
  async enhanceTrade(
    trade: Trade,
    config: Partial<TradeEnhancementConfig> = {},
  ): Promise<TradeEnhanced> {
    try {
      const enhancementConfig = { ...this.config.defaultEnhancementConfig, ...config }
      const cacheKey = this.getCacheKey(trade, enhancementConfig)

      // Check cache if enabled
      if (this.config.cacheEnhancements && this.enhancementCache.has(cacheKey)) {
        const cached = this.enhancementCache.get(cacheKey)!
        return cached
      }

      const enhanced = await this.doEnhanceTrade(trade, enhancementConfig)

      // Cache if enabled
      if (this.config.cacheEnhancements) {
        this.enhancementCache.set(cacheKey, enhanced)
      }

      // Validate output if enabled
      if (this.config.validateOutput) {
        try {
          const validation = validateQueryValue(enhanced)
          if (!validation.success) {
            throw new Error(validation.error || 'Validation failed')
          }
          return enhanced
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(error, {
            operation: 'enhanceTrade validation',
            metadata: { symbol: trade.symbol, tradeId: trade.tradeId },
          }, 'validation')
        }
      }

      return enhanced
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'enhanceTrade',
        metadata: { symbol: trade.symbol, tradeId: trade.tradeId },
      })
    }
  }

  /**
   * Enhance multiple trades with metadata mappings
   *
   * @param trades - Array of trades to enhance
   * @param config - Enhancement configuration (optional)
   * @returns Array of enhanced trades
   */
  async enhanceTrades(
    trades: Trade[],
    config: Partial<TradeEnhancementConfig> = {},
  ): Promise<TradeEnhanced[]> {
    if (trades.length === 0) {
      return []
    }

    try {
      // Process all trades in parallel
      const enhanced = await Promise.all(
        trades.map((trade) => this.enhanceTrade(trade, config)),
      )

      return enhanced
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'enhanceTrades',
        metadata: { tradeCount: trades.length },
      })
    }
  }

  /**
   * Enhance a single quote with metadata mappings
   *
   * @param quote - The quote to enhance
   * @param config - Enhancement configuration (optional)
   * @returns Enhanced quote with mapped metadata
   */
  async enhanceQuote(
    quote: Quote,
    config: Partial<QuoteEnhancementConfig> = {},
  ): Promise<QuoteEnhanced> {
    try {
      const enhancementConfig = { ...DEFAULT_QUOTE_ENHANCEMENT_CONFIG, ...config }

      const enhanced = await this.doEnhanceQuote(quote, enhancementConfig)

      // Validate output if enabled
      if (this.config.validateOutput) {
        try {
          const validation = validateQueryValue(enhanced)
          if (!validation.success) {
            throw new Error(validation.error || 'Validation failed')
          }
          return enhanced
        } catch (error) {
          throw AlpacaMarketErrorContext.enrichError(error, {
            operation: 'enhanceQuote validation',
            metadata: { symbol: quote.symbol },
          }, 'validation')
        }
      }

      return enhanced
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'enhanceQuote',
        metadata: { symbol: quote.symbol },
      })
    }
  }

  /**
   * Enhance multiple quotes with metadata mappings
   *
   * @param quotes - Array of quotes to enhance
   * @param config - Enhancement configuration (optional)
   * @returns Array of enhanced quotes
   */
  async enhanceQuotes(
    quotes: Quote[],
    config: Partial<QuoteEnhancementConfig> = {},
  ): Promise<QuoteEnhanced[]> {
    if (quotes.length === 0) {
      return []
    }

    try {
      // Process all quotes in parallel
      const enhanced = await Promise.all(
        quotes.map((quote) => this.enhanceQuote(quote, config)),
      )

      return enhanced
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'enhanceQuotes',
        metadata: { quoteCount: quotes.length },
      })
    }
  }

  /**
   * Apply tape mapping to a trade
   *
   * @param trade - Trade with tape code
   * @returns Trade with tape description
   */
  async applyTapeMapping(trade: Trade): Promise<{ tapeDescription?: string }> {
    if (!trade.tape) {
      return { tapeDescription: undefined }
    }

    try {
      const mappings = await this.metadataCache.getTapeMapping()
      const mapping = mappings[trade.tape]
      const tapeDescription = mapping?.description
      return { tapeDescription }
    } catch (error) {
      console.warn('Failed to get tape mapping, using fallback', {
        tape: trade.tape,
        error: error instanceof Error ? error.message : String(error),
      })
      return { tapeDescription: undefined }
    }
  }

  /**
   * Apply condition mappings to a trade
   *
   * @param trade - Trade with condition codes
   * @param config - Enhancement configuration
   * @returns Trade with condition names and descriptions
   */
  async applyConditionMappings(
    trade: Trade,
    config: TradeEnhancementConfig,
  ): Promise<{ conditionNames?: string[]; conditionDescriptions?: string[] }> {
    if (!trade.conditions || trade.conditions.length === 0) {
      return {
        conditionNames: undefined,
        conditionDescriptions: undefined,
      }
    }

    try {
      const mappings = await this.metadataCache.getConditionMapping('trades')
      const names: string[] = []
      const descriptions: string[] = []

      for (const conditionCode of trade.conditions) {
        const mapping = mappings[conditionCode]
        if (mapping) {
          if (config.includeConditionNames) {
            names.push(mapping.name)
          }
          if (config.includeConditionDescriptions) {
            descriptions.push(mapping.description)
          }
        } else {
          // Log unmapped codes if enabled
          if (config.logUnmappedCodes) {
            console.info('Unmapped condition code', {
              code: conditionCode,
              symbol: trade.symbol,
            })
          }
        }
      }

      return {
        conditionNames: config.includeConditionNames && names.length > 0 ? names : undefined,
        conditionDescriptions: config.includeConditionDescriptions && descriptions.length > 0
          ? descriptions
          : undefined,
      }
    } catch (error) {
      console.warn('Failed to get condition mappings, using fallback', {
        conditions: trade.conditions,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        conditionNames: undefined,
        conditionDescriptions: undefined,
      }
    }
  }

  /**
   * Apply exchange mapping to a trade
   *
   * @param trade - Trade with exchange code
   * @returns Trade with exchange name
   */
  async applyExchangeMapping(trade: Trade): Promise<{ exchangeName?: string }> {
    if (!trade.exchange) {
      return { exchangeName: undefined }
    }

    try {
      const mappings = await this.metadataCache.getExchangeMapping()
      const mapping = mappings[trade.exchange]
      return {
        exchangeName: mapping?.name,
      }
    } catch (error) {
      console.warn('Failed to get exchange mapping, using fallback', {
        exchange: trade.exchange,
        error: error instanceof Error ? error.message : String(error),
      })
      return { exchangeName: undefined }
    }
  }

  /**
   * Generate mapping status for a trade
   *
   * @param trade - Original trade
   * @param enhanced - Enhanced trade
   * @returns Mapping status information
   */
  generateMappingStatus(trade: Trade, enhanced: TradeEnhanced): TradeMappingStatus {
    const unmappedConditions: string[] = []

    // Check for unmapped conditions
    if (trade.conditions && trade.conditions.length > 0) {
      const mappedCount = enhanced.conditionNames?.length ?? 0
      if (mappedCount < trade.conditions.length) {
        // Find which conditions weren't mapped (this is a simplified check)
        for (const condition of trade.conditions) {
          // In a real implementation, we'd need to cross-reference with the actual mappings
          // For now, we'll estimate based on counts
          if (unmappedConditions.length < (trade.conditions.length - mappedCount)) {
            unmappedConditions.push(condition)
          }
        }
      }
    }

    return {
      hasExchangeMapping: Boolean(enhanced.exchangeName),
      hasTapeMapping: Boolean(enhanced.tapeDescription),
      hasConditionMappings: Boolean(enhanced.conditionNames && enhanced.conditionNames.length > 0),
      unmappedConditionCount: unmappedConditions.length,
      unmappedConditions,
    }
  }

  /**
   * Clear enhancement cache
   */
  clearCache(): void {
    this.enhancementCache.clear()
    if (this.debug) {
      console.debug('Enhancement cache cleared')
    }
  }

  /**
   * Get enhancement cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.enhancementCache.size,
      keys: Array.from(this.enhancementCache.keys()),
    }
  }

  /**
   * Core enhancement logic
   */
  private async doEnhanceTrade(
    trade: Trade,
    config: TradeEnhancementConfig,
  ): Promise<TradeEnhanced> {
    if (this.debug) {
      console.debug('Enhancing trade', {
        symbol: trade.symbol,
        tradeId: trade.tradeId,
        config,
      })
    }

    // Gather all mapping operations
    const exchangeOperation = config.includeExchangeNames
      ? this.applyExchangeMapping(trade)
      : Promise.resolve({ exchangeName: undefined } as { exchangeName?: string })

    const tapeOperation = config.includeTapeDescriptions
      ? this.applyTapeMapping(trade)
      : Promise.resolve({ tapeDescription: undefined } as { tapeDescription?: string })

    const conditionOperation = config.includeConditionNames || config.includeConditionDescriptions
      ? this.applyConditionMappings(trade, config)
      : Promise.resolve(
        { conditionNames: undefined, conditionDescriptions: undefined } as {
          conditionNames?: string[]
          conditionDescriptions?: string[]
        },
      )

    const [exchangeData, tapeData, conditionData] = await Promise.all([
      exchangeOperation,
      tapeOperation,
      conditionOperation,
    ])

    // Merge all enhancements with the original trade
    const enhanced: TradeEnhanced = {
      ...trade,
      ...exchangeData,
      ...tapeData,
      ...conditionData,
      hasMappings: Boolean(
        exchangeData.exchangeName ||
          tapeData.tapeDescription ||
          conditionData.conditionNames?.length ||
          conditionData.conditionDescriptions?.length,
      ),
    }

    if (this.debug) {
      console.debug('Trade enhanced successfully', {
        symbol: trade.symbol,
        tradeId: trade.tradeId,
        hasMappings: enhanced.hasMappings,
      })
    }

    return enhanced
  }

  /**
   * Core quote enhancement logic
   */
  private async doEnhanceQuote(
    quote: Quote,
    config: QuoteEnhancementConfig,
  ): Promise<QuoteEnhanced> {
    if (this.debug) {
      console.debug('Enhancing quote', {
        symbol: quote.symbol,
        config,
      })
    }

    // Gather all mapping operations
    const askExchangeOperation = config.includeExchangeNames && quote.askExchange
      ? this.applyExchangeMapping({ exchange: quote.askExchange } as Trade)
      : Promise.resolve({ exchangeName: undefined } as { exchangeName?: string })

    const bidExchangeOperation = config.includeExchangeNames && quote.bidExchange
      ? this.applyExchangeMapping({ exchange: quote.bidExchange } as Trade)
      : Promise.resolve({ exchangeName: undefined } as { exchangeName?: string })

    const conditionOperation = (config.includeConditionNames || config.includeConditionDescriptions) && quote.conditions
      ? this.applyConditionMappings({
        conditions: quote.conditions,
        symbol: quote.symbol,
      } as Trade, {
        includeConditionNames: config.includeConditionNames,
        includeConditionDescriptions: config.includeConditionDescriptions,
        logUnmappedCodes: config.logUnmappedCodes,
        includeExchangeNames: false,
        includeTapeDescriptions: false,
        includeMappingStatus: false,
      })
      : Promise.resolve(
        { conditionNames: undefined, conditionDescriptions: undefined } as {
          conditionNames?: string[]
          conditionDescriptions?: string[]
        },
      )

    const [askExchangeData, bidExchangeData, conditionData] = await Promise.all([
      askExchangeOperation,
      bidExchangeOperation,
      conditionOperation,
    ])

    // Merge all enhancements with the original quote
    const enhanced: QuoteEnhanced = {
      ...quote,
      askExchangeName: askExchangeData.exchangeName,
      bidExchangeName: bidExchangeData.exchangeName,
      ...conditionData,
      hasMappings: Boolean(
        askExchangeData.exchangeName ||
          bidExchangeData.exchangeName ||
          conditionData.conditionNames?.length ||
          conditionData.conditionDescriptions?.length,
      ),
    }

    if (this.debug) {
      console.debug('Quote enhanced successfully', {
        symbol: quote.symbol,
        hasMappings: enhanced.hasMappings,
      })
    }

    return enhanced
  }

  /**
   * Generate cache key for trade enhancement
   */
  private getCacheKey(trade: Trade, config: TradeEnhancementConfig): string {
    const tradeKey = `${trade.symbol}-${trade.tradeId}-${trade.timestamp.getTime()}`
    const configKey =
      `${config.includeExchangeNames}-${config.includeTapeDescriptions}-${config.includeConditionNames}-${config.includeConditionDescriptions}`
    return `${tradeKey}:${configKey}`
  }
}
