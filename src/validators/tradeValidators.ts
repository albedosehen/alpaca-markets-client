/**
 * Internal validators for Alpaca Market trade data.
 * @module
 */
import { assertArray, assertBoolean, assertNumber, assertObject, assertString } from './asserts.ts'
import { AlpacaMarketValidationError } from '../errors/errors.ts'
import type { Trade, TradeEnhanced, TradeMappingStatus, TradeWithMappingStatus } from '../types/trade.ts'

/**
 * Validates a basic trade object
 *
 * @param data - The trade data to validate
 * @returns {Trade} - The validated trade object
 * @throws {AlpacaMarketValidationError} - If validation fails
 */
export function validateTrade(data: unknown): Trade {
  assertObject(data, 'trade data')
  const obj = data as Record<string, unknown>

  // Required fields
  assertNumber(obj.price, 'trade.price')
  assertNumber(obj.size, 'trade.size')
  assertString(obj.symbol, 'trade.symbol')

  // Validate timestamp - should be a Date object
  if (!(obj.timestamp instanceof Date)) {
    throw new AlpacaMarketValidationError('Expected Date object for trade.timestamp', { field: 'trade.timestamp' })
  }

  // Optional fields
  if (obj.exchange !== undefined) {
    assertString(obj.exchange, 'trade.exchange')
  }

  if (obj.conditions !== undefined) {
    assertArray(obj.conditions, 'trade.conditions')
    if (!Array.isArray(obj.conditions) || !obj.conditions.every((c) => typeof c === 'string')) {
      throw new AlpacaMarketValidationError('trade.conditions must be an array of strings', {
        field: 'trade.conditions',
      })
    }
  }

  if (obj.tradeId !== undefined) {
    assertNumber(obj.tradeId, 'trade.tradeId')
  }

  if (obj.tape !== undefined) {
    assertString(obj.tape, 'trade.tape')
  }

  return obj as unknown as Trade
}

/**
 * Validates an enhanced trade object
 *
 * This function extends the basic trade validation to include additional fields
 * such as exchange name, tape description, and condition names/descriptions.
 *
 * @param data - The trade data to validate
 * @returns {TradeEnhanced} - The validated enhanced trade object
 * @throws {AlpacaMarketValidationError} - If validation fails
 */
export function validateTradeEnhanced(data: unknown): TradeEnhanced {
  validateTrade(data)
  const obj = data as Record<string, unknown>

  assertBoolean(obj.hasMappings, 'trade.hasMappings')

  // Optional enhanced fields
  if (obj.exchangeName !== undefined) {
    assertString(obj.exchangeName, 'trade.exchangeName')
  }

  if (obj.tapeDescription !== undefined) {
    assertString(obj.tapeDescription, 'trade.tapeDescription')
  }

  if (obj.conditionNames !== undefined) {
    assertArray(obj.conditionNames, 'trade.conditionNames')
    if (!Array.isArray(obj.conditionNames) || !obj.conditionNames.every((c) => typeof c === 'string')) {
      throw new AlpacaMarketValidationError('trade.conditionNames must be an array of strings', {
        field: 'trade.conditionNames',
      })
    }
  }

  if (obj.conditionDescriptions !== undefined) {
    assertArray(obj.conditionDescriptions, 'trade.conditionDescriptions')
    if (!Array.isArray(obj.conditionDescriptions) || !obj.conditionDescriptions.every((c) => typeof c === 'string')) {
      throw new AlpacaMarketValidationError('trade.conditionDescriptions must be an array of strings', {
        field: 'trade.conditionDescriptions',
      })
    }
  }

  return obj as unknown as TradeEnhanced
}

/**
 * Validates trade mapping status
 *
 * This function checks the mapping status of a trade, including whether it has exchange mappings,
 * tape mappings, and condition mappings. It also validates the unmapped conditions.
 *
 * @param data - The mapping status data to validate
 * @returns {TradeMappingStatus} - The validated mapping status object
 * @throws {AlpacaMarketValidationError} - If validation fails
 */
export function validateTradeMappingStatus(data: unknown): TradeMappingStatus {
  assertObject(data, 'mapping status')
  const obj = data as Record<string, unknown>

  assertBoolean(obj.hasExchangeMapping, 'mappingStatus.hasExchangeMapping')
  assertBoolean(obj.hasTapeMapping, 'mappingStatus.hasTapeMapping')
  assertBoolean(obj.hasConditionMappings, 'mappingStatus.hasConditionMappings')
  assertNumber(obj.unmappedConditionCount, 'mappingStatus.unmappedConditionCount')
  assertArray(obj.unmappedConditions, 'mappingStatus.unmappedConditions')

  if (!Array.isArray(obj.unmappedConditions) || !obj.unmappedConditions.every((c) => typeof c === 'string')) {
    throw new AlpacaMarketValidationError('mappingStatus.unmappedConditions must be an array of strings', {
      field: 'mappingStatus.unmappedConditions',
    })
  }

  return obj as unknown as TradeMappingStatus
}

/**
 * Validates trade with mapping status
 *
 * This function combines the validation of a trade with its mapping status,
 * ensuring that both the trade data and its mapping status are correctly structured.
 *
 * @param data - The trade data to validate
 * @returns {TradeWithMappingStatus} - The validated trade with mapping status
 * @throws {AlpacaMarketValidationError} - If validation fails
 */
export function validateTradeWithMappingStatus(data: unknown): TradeWithMappingStatus {
  const enhanced = validateTradeEnhanced(data)
  const obj = data as Record<string, unknown>

  assertObject(obj.mappingStatus, 'trade.mappingStatus')
  const mappingStatus = validateTradeMappingStatus(obj.mappingStatus)

  return { ...enhanced, mappingStatus } as TradeWithMappingStatus
}
