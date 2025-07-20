import { AlpacaMarketValidationError } from '../errors/errors.ts'
import { assertArray, assertNumber, assertObject, assertOptionalString, assertString } from './asserts.ts'
import type { Quote } from '../types/quote.ts'

/**
 * Validates a quote response.
 *
 * @param data - The quote data to validate
 * @throws {AlpacaMarketValidationError} If validation fails
 * @returns The validated quote data
 */
export function validateQuote(data: unknown): Quote {
  assertObject(data, 'quote response')
  const obj = data as Record<string, unknown>

  // Required fields validation
  assertString(obj.t, 'quote.t')
  assertNumber(obj.ap, 'quote.ap')
  assertNumber(obj.as, 'quote.as')
  assertNumber(obj.bp, 'quote.bp')
  assertNumber(obj.bs, 'quote.bs')

  // Optional string fields
  assertOptionalString(obj.ax, 'quote.ax')
  assertOptionalString(obj.bx, 'quote.bx')

  // Validate conditions array if present
  if (obj.c !== undefined) {
    assertArray(obj.c, 'quote.c')
    const conditions = obj.c as unknown[]
    conditions.forEach((condition, index) => {
      assertString(condition, `quote.c[${index}]`)
    })
  }

  // Convert to normalized format
  return {
    timestamp: new Date(obj.t as string),
    askExchange: obj.ax as string | undefined,
    askPrice: obj.ap as number,
    askSize: obj.as as number,
    bidExchange: obj.bx as string | undefined,
    bidPrice: obj.bp as number,
    bidSize: obj.bs as number,
    conditions: obj.c as string[] | undefined,
    symbol: '', // Symbol will be set by the caller
  }
}

/**
 * Validate an array of quote data.
 *
 * @param data - The quote array data to validate
 * @throws {AlpacaMarketValidationError} If validation fails for any quote in the array
 * @returns The validated quote data
 */
export function validateQuoteArray(data: unknown): Quote[] {
  assertArray(data, 'quotes response')
  return (data as unknown[]).map((item, index) => {
    try {
      return validateQuote(item)
    } catch (error) {
      throw new AlpacaMarketValidationError(
        `Error validating quote at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        { field: `quotes[${index}]` },
      )
    }
  })
}
