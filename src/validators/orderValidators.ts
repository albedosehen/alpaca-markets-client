import { AlpacaMarketValidationError } from '../errors/errors.ts'
import { assertArray, assertObject, assertOptionalString, assertString } from './asserts.ts'
import { EnumValues } from '../utils/helpers.ts'
import {
  type Order,
  ORDER_CLASS,
  ORDER_SIDE,
  ORDER_STATUS,
  ORDER_TYPE,
  type OrderClass,
  type OrderSide,
  type OrderStatus,
  type OrderType,
  TIME_IN_FORCE,
  type TimeInForce,
} from '../types/order.ts'

/**
 * Validates a order response
 */
export function validateOrder(data: unknown): Order {
  assertObject(data, 'order response')
  const obj = data as Record<string, unknown>

  // Required fields validation
  assertString(obj.id, 'order.id')
  assertString(obj.symbol, 'order.symbol')
  assertString(obj.qty, 'order.qty')
  assertString(obj.created_at, 'order.created_at')
  assertString(obj.updated_at, 'order.updated_at')
  assertString(obj.submitted_at, 'order.submitted_at')
  assertString(obj.filled_qty, 'order.filled_qty')

  if (!EnumValues(ORDER_SIDE).includes(obj.side as OrderSide)) {
    throw new AlpacaMarketValidationError(`Invalid order side: ${obj.side}`, { field: 'order.side' })
  }

  if (!EnumValues(TIME_IN_FORCE).includes(obj.time_in_force as TimeInForce)) {
    throw new AlpacaMarketValidationError(`Invalid time_in_force: ${obj.time_in_force}`, {
      field: 'order.time_in_force',
    })
  }

  if (!EnumValues(ORDER_STATUS).includes(obj.status as OrderStatus)) {
    throw new AlpacaMarketValidationError(`Invalid order status: ${obj.status}`, { field: 'order.status' })
  }

  if (!EnumValues(ORDER_TYPE).includes(obj.order_type as OrderType)) {
    throw new AlpacaMarketValidationError(`Invalid order_type: ${obj.order_type}`, { field: 'order.order_type' })
  }

  // Validate Order Class
  if (obj.order_class !== undefined) {
    if (!EnumValues(ORDER_CLASS).includes(obj.order_class as OrderClass)) {
      throw new AlpacaMarketValidationError(`Invalid order_class: ${obj.order_class}`, { field: 'order.order_class' })
    }
  }

  // Validate optional string fields
  const optionalStringFields = [
    'filled_at',
    'expired_at',
    'canceled_at',
    'failed_at',
    'replaced_at',
    'filled_avg_price',
    'trail_percent',
    'trail_price',
    'hwm',
  ]

  optionalStringFields.forEach((field) => {
    assertOptionalString(obj[field], `order.${field}`)
  })

  return obj as unknown as Order
}

/**
 * Validate an array of order data.
 *
 * @param {unknown} data - The order array data to validate
 * @throws {AlpacaMarketValidationError} If validation fails for any order in the array
 * @returns {Order[]} The validated order data
 */
export function validateOrderArray(data: unknown): Order[] {
  assertArray(data, 'orders response')
  return (data as unknown[]).map((item, index) => {
    try {
      return validateOrder(item)
    } catch (error) {
      throw new AlpacaMarketValidationError(
        `Error validating order at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        { field: `orders[${index}]` },
      )
    }
  })
}
