import type { Serialized } from '../utils/serializer.ts'

/**
 * Raw trade data from Alpaca API (exact API response format)
 */
export interface TradeRaw {
  /* timestamp in ISO 8601 format */
  t: string
  /* exchange code */
  x?: string
  /* price in USD */
  p: number
  /* size in shares */
  s: number
  /* conditions as an array of strings */
  c?: string[]
  /* trade ID */
  i?: number
  /* symbol for the trade */
  z?: string // tape
}

/**
 * Normalized trade data (application format)
 */
export interface Trade {
  timestamp: Date
  exchange?: string
  price: number
  size: number
  conditions?: string[]
  tradeId?: number
  tape?: string
  symbol: string
}

/**
 * Enhanced trade data with human-readable metadata mappings
 */
export interface TradeEnhanced extends Trade {
  exchangeName?: string
  tapeDescription?: string
  conditionNames?: string[]
  conditionDescriptions?: string[]
  hasMappings: boolean
}

/**
 * Trade mapping status information
 *
 * Indicates whether the trade has exchange, tape, and condition mappings
 * and provides details on unmapped conditions.
 */
export interface TradeMappingStatus {
  hasExchangeMapping: boolean
  hasTapeMapping: boolean
  hasConditionMappings: boolean
  unmappedConditionCount: number
  unmappedConditions: string[]
}

/**
 * Trade with enrichment metadata and mapping status
 *
 * Includes all enhanced trade data along with mapping status information.
 * This is useful for applications that need to display or process trades
 * with detailed metadata and mapping status.
 */
export interface TradeWithMappingStatus extends TradeEnhanced {
  mappingStatus: TradeMappingStatus
}

/**
 * Configuration for trade enhancement with metadata mappings
 *
 * Allows enabling/disabling specific metadata enrichments
 * to optimize performance and reduce payload size.
 */
export interface TradeEnhancementConfig {
  includeExchangeNames: boolean
  includeTapeDescriptions: boolean
  includeConditionNames: boolean
  includeConditionDescriptions: boolean
  includeMappingStatus: boolean
  logUnmappedCodes: boolean
}

/**
 * Default configuration for trade enhancement
 *
 * Includes exchange names, tape descriptions, and condition names
 * but excludes condition descriptions and mapping status by default.
 * This can be customized based on application needs.
 */
export const DEFAULT_ENHANCEMENT_CONFIG: TradeEnhancementConfig = {
  includeExchangeNames: true,
  includeTapeDescriptions: true,
  includeConditionNames: true,
  includeConditionDescriptions: false,
  includeMappingStatus: false,
  logUnmappedCodes: false,
}

/**
 * Serialized versions for API transmission
 */
export type TradeSerialized = Serialized<Trade>
export type TradeEnhancedSerialized = Serialized<TradeEnhanced>
