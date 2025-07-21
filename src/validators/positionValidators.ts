/**
 * Internal validators for Alpaca Market position data.
 * @module
 */
import { AlpacaMarketValidationError } from '../errors/errors.ts'
import { assertArray, assertObject, assertString } from './asserts.ts'
import type { Position } from '../types/position.ts'

/**
 * Validates a position response from Alpaca Market API.
 *
 * @param {unknown} data - The position data to validate
 * @throws {AlpacaMarketValidationError} If validation fails
 * @returns {Position} The validated position data
 */
export function validatePosition(data: unknown): Position {
  assertObject(data, 'position response')
  const obj = data as Record<string, unknown>

  // Required fields
  assertString(obj.symbol, 'position.symbol')
  assertString(obj.qty, 'position.qty')
  assertString(obj.asset_id, 'position.asset_id')
  assertString(obj.exchange, 'position.exchange')
  assertString(obj.avg_entry_price, 'position.avg_entry_price')
  assertString(obj.market_value, 'position.market_value')
  assertString(obj.cost_basis, 'position.cost_basis')
  assertString(obj.unrealized_pl, 'position.unrealized_pl')
  assertString(obj.unrealized_plpc, 'position.unrealized_plpc')
  assertString(obj.unrealized_intraday_pl, 'position.unrealized_intraday_pl')
  assertString(obj.unrealized_intraday_plpc, 'position.unrealized_intraday_plpc')
  assertString(obj.current_price, 'position.current_price')
  assertString(obj.lastday_price, 'position.lastday_price')
  assertString(obj.change_today, 'position.change_today')

  const validSides = ['long', 'short']
  if (!validSides.includes(obj.side as string)) {
    throw new AlpacaMarketValidationError(`Invalid position side: ${obj.side}`, { field: 'position.side' })
  }

  const validAssetClasses = ['us_equity', 'crypto']
  if (!validAssetClasses.includes(obj.asset_class as string)) {
    throw new AlpacaMarketValidationError(`Invalid asset_class: ${obj.asset_class}`, { field: 'position.asset_class' })
  }

  if (obj.qty_available !== undefined) {
    assertString(obj.qty_available, 'position.qty_available')
  }

  return obj as unknown as Position
}

export function validatePositionArray(data: unknown): Position[] {
  assertArray(data, 'positions response')
  return (data as unknown[]).map((item, index) => {
    try {
      return validatePosition(item)
    } catch (error) {
      throw new AlpacaMarketValidationError(
        `Error validating position at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        { field: `positions[${index}]` },
      )
    }
  })
}
