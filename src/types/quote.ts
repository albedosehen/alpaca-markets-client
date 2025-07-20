/**
 * Raw quote data from Alpaca API (exact API response format)
 *
 * @property t - Timestamp in ISO 8601 format
 * @property ax - Ask exchange (optional)
 * @property ap - Ask price
 * @property as - Ask size
 * @property bx - Bid exchange (optional)
 * @property bp - Bid price
 * @property bs - Bid size
 * @property c - Conditions (optional, array of strings)
 */
export const QUOTE_TYPE = {
  t: 'string',
  ax: 'string',
  ap: 'number',
  as: 'number',
  bx: 'string',
  bp: 'number',
  bs: 'number',
  c: 'string[]',
} as const

/**
 * Raw quote data interface representing the API response format.
 *
 * This interface defines the structure of quote data as received from the Alpaca API.
 */
export interface QuoteResponse {
  /** Timestamp in ISO 8601 format */
  t: string
  /** Ask exchange (optional) */
  ax?: string
  /** Ask price */
  ap: number
  /** Ask size */
  as: number
  /** Bid exchange (optional) */
  bx?: string
  /** Bid price */
  bp: number
  /** Bid size */
  bs: number
  /** Conditions (optional, array of strings) */
  c?: string[]
}

/**
 * Normalized quote data (application format).
 *
 * This interface defines the common properties for all quote types in Alpaca Market's API.
 */
export interface Quote {
  /** Timestamp as Date object */
  timestamp: Date
  /** Ask exchange (optional) */
  askExchange?: string
  /** Ask price */
  askPrice: number
  /** Ask size */
  askSize: number
  /** Bid exchange (optional) */
  bidExchange?: string
  /** Bid price */
  bidPrice: number
  /** Bid size */
  bidSize: number
  /** Conditions (optional, array of strings) */
  conditions?: string[]
  /** Symbol for the asset */
  symbol: string
}

/**
 * Enhanced quote data with human-readable metadata mappings.
 *
 * This interface extends the base quote with additional metadata for better user experience.
 */
export interface QuoteEnhanced extends Quote {
  /** Human-readable ask exchange name */
  askExchangeName?: string
  /** Human-readable bid exchange name */
  bidExchangeName?: string
  /** Human-readable condition names */
  conditionNames?: string[]
  /** Human-readable condition descriptions */
  conditionDescriptions?: string[]
  /** Whether mappings were applied */
  hasMappings: boolean
}

/**
 * Configuration for quote enhancement with metadata mappings.
 *
 * This interface defines the options for enhancing quote data with human-readable metadata.
 */
export interface QuoteEnhancementConfig {
  /** Whether to include exchange names in the enhanced quote */
  includeExchangeNames: boolean
  /** Whether to include condition names in the enhanced quote */
  includeConditionNames: boolean
  /** Whether to include condition descriptions in the enhanced quote */
  includeConditionDescriptions: boolean
  /** Whether to log unmapped condition codes for debugging */
  logUnmappedCodes: boolean
}

/**
 * Default configuration for quote enhancement.
 *
 * This configuration includes exchange names and condition names,
 * but does not include condition descriptions by default.
 * It also does not log unmapped codes, which can be verbose.
 *
 * @property includeExchangeNames - Whether to include exchange names in the enhanced quote
 * @property includeConditionNames - Whether to include condition names in the enhanced quote
 * @property includeConditionDescriptions - Whether to include condition descriptions in the enhanced quote
 * @property logUnmappedCodes - Whether to log unmapped condition codes for debugging
 */
export const DEFAULT_QUOTE_ENHANCEMENT_CONFIG: QuoteEnhancementConfig = {
  includeExchangeNames: true,
  includeConditionNames: true,
  includeConditionDescriptions: false,
  logUnmappedCodes: false,
}
