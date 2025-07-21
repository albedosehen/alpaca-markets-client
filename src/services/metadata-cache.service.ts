/**
 * Metadata cache service for Alpaca Markets Client
 * Provides caching for tape codes, trade conditions, and exchange mappings
 * with support for lazy loading, TTL, and fallback defaults.
 * @module
 */
import { AlpacaMarketErrorContext } from '../errors/errors.ts'
import { DEFAULT_TRADE_CONDITIONS, type TradeConditionMappings } from '../types/trade-conditions.ts'
import { DEFAULT_EXCHANGES, type ExchangeMappings } from '../types/exchanges.ts'
import { DEFAULT_TAPE_CODES, type TapeCodeMappings } from '../types/tape-codes.ts'

/**
 * Configuration for metadata cache
 */
export interface MetadataCacheConfig {
  /** Cache TTL in milliseconds (default: 1 hour) */
  readonly ttlMs: number
  /** Whether to use fallback defaults when API fails */
  readonly useFallbackDefaults: boolean
  /** Maximum retry attempts for API calls */
  readonly maxRetries: number
  /** Enable debug logging (default: false) */
  readonly debug?: boolean
}

/**
 * Default configuration for metadata cache
 */
const DEFAULT_CONFIG: MetadataCacheConfig = {
  ttlMs: 60 * 60 * 1000, // 1 hour
  useFallbackDefaults: true,
  maxRetries: 3,
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  readonly data: T
  readonly expiresAt: number
  readonly fetchedAt: number
}

/**
 * In-memory cache for metadata with TTL and lazy loading
 */
export class MetadataCache {
  private readonly tapeCodeCache = new Map<string, CacheEntry<TapeCodeMappings>>()
  private readonly conditionCache = new Map<string, CacheEntry<TradeConditionMappings>>()
  private readonly exchangeCache = new Map<string, CacheEntry<ExchangeMappings>>()
  private readonly debug: boolean

  // Track ongoing API calls to prevent duplicates
  private readonly pendingTapeCalls = new Map<string, Promise<TapeCodeMappings>>()
  private readonly pendingConditionCalls = new Map<string, Promise<TradeConditionMappings>>()
  private readonly pendingExchangeCalls = new Map<string, Promise<ExchangeMappings>>()

  constructor(
    private readonly config: MetadataCacheConfig = DEFAULT_CONFIG,
  ) {
    this.debug = config.debug ?? false
  }

  /**
   * Get tape code mappings with caching
   */
  async getTapeMapping(): Promise<TapeCodeMappings> {
    const cacheKey = 'tape-codes'
    const cached = this.tapeCodeCache.get(cacheKey)

    // Return cached data if valid
    if (cached && Date.now() < cached.expiresAt) {
      if (this.debug) {
        console.debug('Tape codes served from cache', {
          fetchedAt: new Date(cached.fetchedAt),
          expiresAt: new Date(cached.expiresAt),
        })
      }
      return cached.data
    }

    // Check if there's already a pending API call
    const existingCall = this.pendingTapeCalls.get(cacheKey)
    if (existingCall) {
      if (this.debug) {
        console.debug('Tape codes request already in progress, waiting...', { cacheKey })
      }
      return await existingCall
    }

    return await this.fetchTapeCodes(cacheKey)
  }

  /**
   * Get trade condition mappings with caching
   */
  async getConditionMapping(tickType: 'trades' | 'quotes' = 'trades'): Promise<TradeConditionMappings> {
    const cacheKey = `conditions-${tickType}`
    const cached = this.conditionCache.get(cacheKey)

    // Return cached data if valid
    if (cached && Date.now() < cached.expiresAt) {
      if (this.debug) {
        console.debug('Trade conditions served from cache', {
          tickType,
          fetchedAt: new Date(cached.fetchedAt),
          expiresAt: new Date(cached.expiresAt),
        })
      }
      return cached.data
    }

    // Check if there's already a pending API call
    const existingCall = this.pendingConditionCalls.get(cacheKey)
    if (existingCall) {
      if (this.debug) {
        console.debug('Trade conditions request already in progress, waiting...', { tickType })
      }
      return await existingCall
    }

    return await this.fetchConditions(cacheKey, tickType)
  }

  /**
   * Get exchange mappings with caching
   */
  async getExchangeMapping(): Promise<ExchangeMappings> {
    const cacheKey = 'exchanges'
    const cached = this.exchangeCache.get(cacheKey)

    // Return cached data if valid
    if (cached && Date.now() < cached.expiresAt) {
      if (this.debug) {
        console.debug('Exchanges served from cache', {
          fetchedAt: new Date(cached.fetchedAt),
          expiresAt: new Date(cached.expiresAt),
        })
      }
      return cached.data
    }

    // Check if there's already a pending API call
    const existingCall = this.pendingExchangeCalls.get(cacheKey)
    if (existingCall) {
      if (this.debug) {
        console.debug('Exchanges request already in progress, waiting...')
      }
      return await existingCall
    }

    return await this.fetchExchanges(cacheKey)
  }

  /**
   * Clear all cached metadata
   */
  clearCache(): void {
    this.tapeCodeCache.clear()
    this.conditionCache.clear()
    this.exchangeCache.clear()
    if (this.debug) {
      console.debug('Metadata cache cleared')
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    tapeCodesCount: number
    conditionsCount: number
    exchangesCount: number
    totalSize: number
  } {
    return {
      tapeCodesCount: this.tapeCodeCache.size,
      conditionsCount: this.conditionCache.size,
      exchangesCount: this.exchangeCache.size,
      totalSize: this.tapeCodeCache.size + this.conditionCache.size + this.exchangeCache.size,
    }
  }

  /**
   * Fetch tape codes from API with fallback to defaults
   */
  private async fetchTapeCodes(cacheKey: string): Promise<TapeCodeMappings> {
    const tapeCodesPromise = this.doFetchTapeCodes()
    this.pendingTapeCalls.set(cacheKey, tapeCodesPromise)

    try {
      const data = await tapeCodesPromise

      // Cache the result
      const entry: CacheEntry<TapeCodeMappings> = {
        data,
        expiresAt: Date.now() + this.config.ttlMs,
        fetchedAt: Date.now(),
      }
      this.tapeCodeCache.set(cacheKey, entry)
      this.pendingTapeCalls.delete(cacheKey)

      console.debug('Tape codes cached', {
        count: Object.keys(data).length,
        expiresAt: new Date(entry.expiresAt),
      })

      return data
    } catch (error) {
      this.pendingTapeCalls.delete(cacheKey)

      if (this.config.useFallbackDefaults) {
        console.warn('Failed to fetch tape codes, using defaults', { error })
        return DEFAULT_TAPE_CODES
      }

      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'fetch-tape-codes',
          metadata: { cacheKey },
        },
        'api',
      )
    }
  }

  /**
   * Fetch trade conditions from API with fallback to defaults
   */
  private async fetchConditions(cacheKey: string, tickType: 'trades' | 'quotes'): Promise<TradeConditionMappings> {
    const conditionsPromise = this.doFetchConditions(tickType)
    this.pendingConditionCalls.set(cacheKey, conditionsPromise)

    try {
      const data = await conditionsPromise

      // Cache the result
      const entry: CacheEntry<TradeConditionMappings> = {
        data,
        expiresAt: Date.now() + this.config.ttlMs,
        fetchedAt: Date.now(),
      }
      this.conditionCache.set(cacheKey, entry)
      this.pendingConditionCalls.delete(cacheKey)

      console.debug('Trade conditions cached', {
        tickType,
        count: Object.keys(data).length,
        expiresAt: new Date(entry.expiresAt),
      })
      return data
    } catch (error) {
      this.pendingConditionCalls.delete(cacheKey)

      if (this.config.useFallbackDefaults) {
        console.warn('Failed to fetch trade conditions, using defaults', { tickType, error })
        return DEFAULT_TRADE_CONDITIONS
      }

      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'fetch-trade-conditions',
          metadata: { cacheKey, tickType },
        },
        'api',
      )
    }
  }

  /**
   * Fetch exchanges from API with fallback to defaults
   */
  private async fetchExchanges(cacheKey: string): Promise<ExchangeMappings> {
    const exchangesPromise = this.doFetchExchanges()
    this.pendingExchangeCalls.set(cacheKey, exchangesPromise)

    try {
      const data = await exchangesPromise

      // Cache the result
      const entry: CacheEntry<ExchangeMappings> = {
        data,
        expiresAt: Date.now() + this.config.ttlMs,
        fetchedAt: Date.now(),
      }
      this.exchangeCache.set(cacheKey, entry)
      this.pendingExchangeCalls.delete(cacheKey)

      console.debug('Exchanges cached', {
        count: Object.keys(data).length,
        expiresAt: new Date(entry.expiresAt),
      })
      return data
    } catch (error) {
      this.pendingExchangeCalls.delete(cacheKey)

      if (this.config.useFallbackDefaults) {
        console.warn('Failed to fetch exchanges, using defaults', { error })
        return DEFAULT_EXCHANGES
      }

      throw AlpacaMarketErrorContext.enrichError(
        error,
        {
          operation: 'fetch-exchanges',
          metadata: { cacheKey },
        },
        'api',
      )
    }
  }

  /**
   * Actually fetch tape codes from API
   */
  private async doFetchTapeCodes(): Promise<TapeCodeMappings> {
    // For now, return defaults as the API endpoint structure isn't fully specified
    // This will be replaced with actual API call once metadata endpoints are implemented
    console.debug('Fetching tape codes (using defaults for now)')
    return DEFAULT_TAPE_CODES
  }

  /**
   * Actually fetch trade conditions from API
   */
  private async doFetchConditions(tickType: 'trades' | 'quotes'): Promise<TradeConditionMappings> {
    // For now, return defaults as the API endpoint structure isn't fully specified
    // This will be replaced with actual API call once metadata endpoints are implemented
    console.debug('Fetching trade conditions (using defaults for now)', { tickType })
    return DEFAULT_TRADE_CONDITIONS
  }

  /**
   * Actually fetch exchanges from API
   */
  private async doFetchExchanges(): Promise<ExchangeMappings> {
    // For now, return defaults as the API endpoint structure isn't fully specified
    // This will be replaced with actual API call once metadata endpoints are implemented
    console.debug('Fetching exchanges (using defaults for now)')
    return DEFAULT_EXCHANGES
  }
}
