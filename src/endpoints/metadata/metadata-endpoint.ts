import type { AlpacaMarketClient } from '../../client/alpaca.ts'
import { AlpacaMarketErrorContext } from '../../errors/errors.ts'
import type { Exchange, ExchangeMappings, ExchangeRaw } from '../../types/exchanges.ts'
import type { ConditionsParams } from './metadata-endpoint.types.ts'
import type { TradeCondition, TradeConditionMappings } from '../../types/trade-conditions.ts'

/**
 * Raw API response for trade conditions
 */
interface ConditionsResponse {
  conditions: Record<string, string>
}

/**
 * Raw API response for exchanges
 */
interface ExchangesResponse {
  exchanges: ExchangeRaw[]
}

/**
 * Metadata endpoints for fetching trade conditions, exchanges, and tape codes
 *
 * This class provides methods to retrieve trade conditions and exchange information
 * from the Alpaca API, transforming raw API responses into structured mappings.
 *
 * @param {AlpacaMarketClient} client - The Alpaca market client instance used for API requests
 * @class MetadataEndpoints
 * @example
 * ```typescript
 * const metadataClient = new MetadataEndpoints(alpacaMarketClient);
 * const conditions = await metadataClient.getConditions({ ticktype: 'trades' });
 * const exchanges = await metadataClient.getExchanges();
 * ```
 * @see {@link https://alpaca.markets/docs/api-references/market-data-api}
 */
export class MetadataEndpoint {
  constructor(private client: AlpacaMarketClient) {}

  /**
   * Get trade conditions for the specified tick type
   *
   * @param params - Parameters including tick type
   * @returns Promise resolving to trade condition mappings
   */
  async getConditions(params: ConditionsParams): Promise<TradeConditionMappings> {
    console.debug('Getting trade conditions', { params })

    try {
      const response = await this.client.request<ConditionsResponse>(`/v2/stocks/meta/conditions/${params.ticktype}`, {
        method: 'GET',
        useDataUrl: true,
      })

      const result = this.transformConditionsResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getConditions',
        requestId: 'getConditions',
        metadata: { params },
      })
    }
  }

  /**
   * Get exchange information
   *
   * @returns Promise resolving to exchange mappings
   */
  async getExchanges(): Promise<ExchangeMappings> {
    console.debug('Getting exchanges')

    try {
      const response = await this.client.request<ExchangesResponse>('/v2/stocks/meta/exchanges', {
        method: 'GET',
        useDataUrl: true,
      })

      const result = this.transformExchangesResponse(response)
      return result
    } catch (error) {
      throw AlpacaMarketErrorContext.enrichError(error, {
        operation: 'getExchanges',
        requestId: 'getExchanges',
        metadata: {},
      })
    }
  }

  /**
   * Transform conditions API response to internal format
   *
   * @param response - Raw API response
   * @returns Transformed trade condition mappings
   */
  private transformConditionsResponse(
    response: ConditionsResponse,
  ): TradeConditionMappings {
    const mappings: TradeConditionMappings = {}

    for (const [code, description] of Object.entries(response.conditions)) {
      // Create a standardized trade condition object
      const condition: TradeCondition = {
        code,
        name: this.extractConditionName(description),
        description,
        category: this.categorizeCondition(code, description),
      }

      mappings[code] = condition
    }

    console.debug('Transformed conditions response', {
      conditionCount: Object.keys(mappings).length,
    })

    return mappings
  }

  /**
   * Transform exchanges API response to internal format
   *
   * @param response - Raw API response
   * @returns Transformed exchange mappings
   */
  private transformExchangesResponse(
    response: ExchangesResponse,
  ): ExchangeMappings {
    const mappings: ExchangeMappings = {}

    for (const rawExchange of response.exchanges) {
      // Create a standardized exchange object
      const exchange: Exchange = {
        code: rawExchange.code,
        name: rawExchange.name,
        displayName: this.extractDisplayName(rawExchange.name),
        mic: rawExchange.mic,
        tape: rawExchange.tape,
        active: true, // Assume active if returned by API
      }

      mappings[rawExchange.code] = exchange
    }

    console.debug('Transformed exchanges response', {
      exchangeCount: Object.keys(mappings).length,
    })

    return mappings
  }

  /**
   * Extract a short name from a condition description
   *
   * @param description - Full condition description
   * @returns Short name for the condition
   */
  private extractConditionName(description: string): string {
    // Simple heuristic to extract name from description
    // Take first part before common separators or truncate if too long
    const separators = [' - ', ': ', ' (', ',']

    for (const sep of separators) {
      const index = description.indexOf(sep)
      if (index > 0 && index < 50) {
        return description.substring(0, index).trim()
      }
    }

    // If no separator found, truncate at reasonable length
    return description.length > 30 ? description.substring(0, 27).trim() + '...' : description
  }

  /**
   * Categorize a trade condition based on code and description
   *
   * @param code - Condition code
   * @param description - Condition description
   * @returns Category string
   */
  private categorizeCondition(code: string, description: string): string {
    const desc = description.toLowerCase()

    // Timing-related conditions
    if (
      desc.includes('extended') || desc.includes('late') || desc.includes('time') ||
      desc.includes('opening') || desc.includes('closing') || code === 'T' || code === 'U'
    ) {
      return 'timing'
    }

    // Volume-related conditions
    if (
      desc.includes('odd lot') || desc.includes('block') || desc.includes('volume') ||
      code === 'I'
    ) {
      return 'volume'
    }

    // Price-related conditions
    if (
      desc.includes('price') || desc.includes('sweep') || desc.includes('derivativ') ||
      code === 'F' || code === '4'
    ) {
      return 'price'
    }

    // Market structure conditions
    if (desc.includes('intermarket') || desc.includes('cross') || desc.includes('auction')) {
      return 'market'
    }

    // Default category
    return 'other'
  }

  /**
   * Extract a display name from exchange full name
   *
   * @param fullName - Full exchange name
   * @returns Shortened display name
   */
  private extractDisplayName(fullName: string): string {
    // Common abbreviations and mappings
    const mappings: Record<string, string> = {
      'New York Stock Exchange': 'NYSE',
      'NASDAQ': 'NASDAQ',
      'NYSE Arca': 'Arca',
      'Chicago Stock Exchange': 'CHX',
      'Cboe': 'CBOE',
      'International Securities Exchange': 'ISE',
      'Investors Exchange': 'IEX',
      'Members Exchange': 'MEMX',
    }

    // Check for exact matches first
    for (const [full, short] of Object.entries(mappings)) {
      if (fullName.includes(full)) {
        return short
      }
    }

    // Extract common patterns
    if (fullName.includes('NYSE')) return 'NYSE'
    if (fullName.includes('NASDAQ')) return 'NASDAQ'
    if (fullName.includes('Cboe')) return 'CBOE'

    // Fallback: use the first word or acronym
    const words = fullName.split(' ')
    if (words.length === 1) {
      return words[0]
    }

    // Try to create acronym from first letters
    const acronym = words.map((word) => word.charAt(0)).join('').toUpperCase()
    return acronym.length <= 5 ? acronym : words[0]
  }
}
