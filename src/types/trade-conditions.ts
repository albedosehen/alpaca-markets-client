/**
 * Trade Conditions Types for Alpaca Markets Client
 * Provides types and interfaces for trade condition data.
 * @module
 */

import type { Serialized } from '../utils/serializer.ts'

/**
 * Raw trade condition data from Alpaca API
 */
interface TradeConditionRawBase {
  /** Condition code identifier */
  condition: string
  /** Human-readable description of the condition */
  description: string
}

/**
 * Normalized trade condition mapping
 */
interface TradeConditionBase {
  /** Condition code identifier */
  code: string
  /** Short human-readable name */
  name: string
  /** Detailed description */
  description: string
  /** Category of the condition (e.g., "timing", "price", "volume") */
  category?: string
}

/**
 * Collection of trade condition mappings
 */
interface TradeConditionMappingsBase {
  [key: string]: TradeConditionBase
}

export type TradeConditionRaw = Serialized<TradeConditionRawBase>
export type TradeCondition = Serialized<TradeConditionBase>
export type TradeConditionMappings = Serialized<TradeConditionMappingsBase>

/**
 * Default trade condition mappings for common codes
 */
export const DEFAULT_TRADE_CONDITIONS: TradeConditionMappings = {
  '@': {
    code: '@',
    name: 'Regular Sale',
    description: 'A regular sale transaction',
    category: 'timing',
  },
  'T': {
    code: 'T',
    name: 'Form T Trade',
    description: 'Extended hours trade (reported out-of-sequence)',
    category: 'timing',
  },
  'I': {
    code: 'I',
    name: 'Odd Lot Trade',
    description: 'Trade in odd lot quantities (less than 100 shares)',
    category: 'volume',
  },
  'F': {
    code: 'F',
    name: 'Intermarket Sweep',
    description: 'Intermarket sweep order',
    category: 'price',
  },
  '4': {
    code: '4',
    name: 'Derivatively Priced',
    description: 'Trade that is derivatively priced',
    category: 'price',
  },
  'U': {
    code: 'U',
    name: 'Extended Hours',
    description: 'Extended trading hours (sold out of sequence)',
    category: 'timing',
  },
  'Z': {
    code: 'Z',
    name: 'Sold Last',
    description: 'Trade reported late but is on time',
    category: 'timing',
  },
}
