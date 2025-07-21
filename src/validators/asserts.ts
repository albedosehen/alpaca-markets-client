/**
 * Internal assertion module for validation and sanitization.
 * @module
 */
import { type ValidationContext } from '../types/validation.ts'
import { AlpacaMarketValidationError } from '../errors/errors.ts'
import { PATTERNS } from '../utils/patterns.ts'
import type { AnyFn } from '../types/shared.ts'
/**
 * Input interface for assertion functions
 */
export interface AssertInput {
  input: string
  context?: string
}

/**
 * Create a AlpacaMarketValidationError with enhanced context
 */
function createAlpacaMarketValidationError(
  message: string,
  context: string,
  expected?: string,
  received?: unknown,
  rule?: string,
): AlpacaMarketValidationError {
  const validationContext: ValidationContext = {
    field: context,
    expected,
    received,
    rule,
  }

  return new AlpacaMarketValidationError(message, validationContext)
}

/**
 * Assert that a string does not contain dangerous SQL patterns
 * @param input The string to validate
 * @param context Optional string to clarify error (e.g. 'HAVING condition')
 * @param patterns SQL injection patterns to check
 */
export function assertNoDangerousSQL({ input, context = 'input', patterns }: AssertInput & { patterns: RegExp[] }) {
  for (const pattern of patterns) {
    if (pattern.test(input)) {
      throw createAlpacaMarketValidationError(
        `Dangerous SQL pattern detected in ${context}: ${pattern.toString()}`,
        context,
        'safe SQL string',
        input,
        'no_dangerous_sql',
      )
    }
  }
}

/**
 * Assert that a string is a non-empty string
 * @param input - The input to check
 * @param context - Optional context for the error message
 * @throws AlpacaMarketValidationError if the input is not a non-empty string
 */
export function assertNoEmptyString({ input, context = 'input' }: AssertInput) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw createAlpacaMarketValidationError(
      `Expected non-empty string in ${context}`,
      context,
      'non-empty string',
      input,
      'no_empty_string',
    )
  }
}

/**
 * Assert that a value follows specific patterns
 * @param input - The input to check
 * @param context - Optional context for the error message
 * @param patterns - Array of RegExp patterns to check against
 * @throws AlpacaMarketValidationError if the input doesn't match any pattern
 */
export function assertValidFormat({ input, context = 'input', patterns }: AssertInput & { patterns: RegExp[] }) {
  if (!patterns.some((p) => p.test(input))) {
    throw createAlpacaMarketValidationError(
      `Invalid format in ${context}. Expected format: ${patterns.map((p) => p.toString()).join(' or ')}`,
      context,
      patterns.map((p) => p.toString()).join(' or '),
      input,
      'valid_format',
    )
  }
}

/**
 * Assert that a string is not longer than a specified maximum length
 * @param input - The input to check
 * @param context - Optional context for the error message
 * @param maxLength - The maximum allowed length
 * @throws AlpacaMarketValidationError if the input is longer than the maximum length
 */
export function assertMaxStringLength(
  { input, context = 'input', maxLength = 1000 }: AssertInput & { maxLength?: number },
) {
  if (typeof input !== 'string' || input.length > maxLength) {
    throw createAlpacaMarketValidationError(
      `String in ${context} exceeds maximum length of ${maxLength} characters`,
      context,
      `string with max ${maxLength} characters`,
      `string with ${input?.length || 'unknown'} characters`,
      'max_string_length',
    )
  }
}

/**
 * Assert that a string has a minimum length
 * @param input - The input to check
 * @param context - Optional context for the error message
 * @param minLength - The minimum length the string should have
 */
export function assertMinStringLength(
  { input, context = 'input', minLength = 0 }: AssertInput & { minLength?: number },
) {
  if (typeof input !== 'string' || input.length < minLength) {
    throw createAlpacaMarketValidationError(
      `String in ${context} is shorter than minimum length of ${minLength} characters`,
      context,
      `string with min ${minLength} characters`,
      `string with ${input?.length || 'unknown'} characters`,
      'min_string_length',
    )
  }
}

/**
 * Assert that an array is not longer than a specified maximum length
 * @param input - The input to check
 * @param context - Optional context for the error message
 * @param maxLength - The maximum allowed length
 * @throws AlpacaMarketValidationError if the input is longer than the maximum length
 */
export function assertMaxArrayLength(
  { input, context = 'array', maxLength = 1000 }: { input: unknown[]; context?: string; maxLength?: number },
) {
  if (!Array.isArray(input)) {
    throw createAlpacaMarketValidationError(
      `Expected array in ${context}`,
      context,
      'array',
      typeof input,
      'is_array',
    )
  }
  if (input.length > maxLength) {
    throw createAlpacaMarketValidationError(
      `Array in ${context} exceeds maximum length of ${maxLength} elements`,
      context,
      `array with max ${maxLength} elements`,
      `array with ${input.length} elements`,
      'max_array_length',
    )
  }
}

/**
 * Assert that an array is not shorter than a specified minimum length
 * @param input - The input array to check
 * @param context - Optional context for the error message
 * @param minLength - The minimum length the array should have
 * @throws AlpacaMarketValidationError if the input array is shorter than the minimum length
 */
export function assertMinArrayLength(
  { input, context = 'array', minLength = 0 }: { input: unknown[]; context?: string; minLength?: number },
) {
  if (!Array.isArray(input)) {
    throw createAlpacaMarketValidationError(
      `Expected array in ${context}`,
      context,
      'array',
      typeof input,
      'is_array',
    )
  }
  if (input.length < minLength) {
    throw createAlpacaMarketValidationError(
      `Array in ${context} is shorter than minimum length of ${minLength} elements`,
      context,
      `array with min ${minLength} elements`,
      `array with ${input.length} elements`,
      'min_array_length',
    )
  }
}

/**
 * Assert that an array has a specific length
 * @param input - The input array to check
 * @param context - Optional context for the error message
 * @param length - The expected length of the array
 * @throws AlpacaMarketValidationError if the input array does not have the expected length
 */
export function assertArrayLength(
  { input, context = 'array', length }: { input: unknown[]; context?: string; length: number },
) {
  if (!Array.isArray(input)) {
    throw createAlpacaMarketValidationError(
      `Expected array in ${context}`,
      context,
      'array',
      typeof input,
      'is_array',
    )
  }
  if (input.length !== length) {
    throw createAlpacaMarketValidationError(
      `Array in ${context} has length ${input.length}, expected ${length}`,
      context,
      `array with ${length} elements`,
      `array with ${input.length} elements`,
      'exact_array_length',
    )
  }
}

/**
 * Assert that a value is a numeric string
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a numeric string
 */
export function assertNumericString(input: string, context = 'input') {
  if (!PATTERNS.NUMERIC_STRING.test(input)) {
    throw createAlpacaMarketValidationError(
      `Expected numeric string in ${context}`,
      context,
      'numeric string (digits only)',
      input,
      'numeric_string',
    )
  }
}

/**
 * Assert that a number is between a specified minimum and maximum value
 * @param input - The input to check
 * @param min - The minimum allowed value
 * @param max - The maximum allowed value
 * @param context - Optional context for the error message
 * @throws AlpacaMarketValidationError if the input is not a number or is outside the specified range
 */
export function assertNumberBetween(input: number | string, min: number, max: number, context = 'input') {
  if (typeof input !== 'number' && typeof input !== 'string') {
    throw createAlpacaMarketValidationError(
      `Expected number in ${context}`,
      context,
      'number',
      typeof input,
      'is_number',
    )
  }

  const value = typeof input === 'string' ? parseInt(input) : input
  if (isNaN(value) || value < min || value > max) {
    throw createAlpacaMarketValidationError(
      `Expected number between ${min} and ${max} in ${context}`,
      context,
      `number between ${min} and ${max}`,
      value,
      'number_between',
    )
  }
}

export function assertNonNegativeNumber(input: number, context = 'input') {
  if (typeof input !== 'number' || input < 0) {
    throw createAlpacaMarketValidationError(
      `Expected non-negative number in ${context}`,
      context,
      'non-negative number',
      input,
      'non_negative_number',
    )
  }
}

export function assertPositiveNumber(input: number, context = 'input') {
  if (typeof input !== 'number' || input <= 0) {
    throw createAlpacaMarketValidationError(
      `Expected positive number in ${context}`,
      context,
      'positive number',
      input,
      'positive_number',
    )
  }
}

// Enhanced type assertions with AlpacaMarketValidationError

/**
 * Assert that a value is a string
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a string
 */
export function assertString(input: unknown, context = 'input'): asserts input is string {
  if (typeof input !== 'string') {
    throw createAlpacaMarketValidationError(
      `Expected string in ${context}`,
      context,
      'string',
      typeof input,
      'is_string',
    )
  }
}

export function assertOptionalString(input: unknown, context = 'input'): asserts input is string | undefined {
  if (input !== undefined && typeof input !== 'string') {
    throw createAlpacaMarketValidationError(
      `Expected string or undefined in ${context}`,
      context,
      'string or undefined',
      typeof input,
      'is_optional_string',
    )
  }
  if (input === undefined) {
    return
  }
  assertString(input, context)
}

/**
 * Assert that a value is a number
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a number
 */
export function assertNumber(input: unknown, context = 'input'): asserts input is number {
  if (typeof input !== 'number') {
    throw createAlpacaMarketValidationError(
      `Expected number in ${context}`,
      context,
      'number',
      typeof input,
      'is_number',
    )
  }
}

/**
 * Assert that a value is a boolean
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a boolean
 */
export function assertBoolean(input: unknown, context = 'input'): asserts input is boolean {
  if (typeof input !== 'boolean') {
    throw createAlpacaMarketValidationError(
      `Expected boolean in ${context}`,
      context,
      'boolean',
      typeof input,
      'is_boolean',
    )
  }
}

/**
 * Assert that a value is a function
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a function
 */
export function assertFunction(input: unknown, context = 'input'): asserts input is AnyFn {
  if (typeof input !== 'function') {
    throw createAlpacaMarketValidationError(
      `Expected function in ${context}`,
      context,
      'function',
      typeof input,
      'is_function',
    )
  }
}

/**
 * Assert that a value is an object (but not null or array)
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a plain object
 */
export function assertObject(input: unknown, context = 'input'): asserts input is object {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw createAlpacaMarketValidationError(
      `Expected object in ${context}`,
      context,
      'plain object',
      Array.isArray(input) ? 'array' : typeof input,
      'is_object',
    )
  }
}

/**
 * Assert that a value is an array
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not an array
 */
export function assertArray(input: unknown, context = 'input'): asserts input is Array<unknown> {
  if (!Array.isArray(input)) {
    throw createAlpacaMarketValidationError(
      `Expected array in ${context}`,
      context,
      'array',
      typeof input,
      'is_array',
    )
  }
}

/**
 * Assert that a value is undefined
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not undefined
 */
export function assertUndefined(input: unknown, context = 'input'): asserts input is undefined {
  if (typeof input !== 'undefined') {
    throw createAlpacaMarketValidationError(
      `Expected undefined in ${context}`,
      context,
      'undefined',
      typeof input,
      'is_undefined',
    )
  }
}

/**
 * Assert that a value is null
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not null
 */
export function assertNull(input: unknown, context = 'input'): asserts input is null {
  if (input !== null) {
    throw createAlpacaMarketValidationError(
      `Expected null in ${context}`,
      context,
      'null',
      typeof input,
      'is_null',
    )
  }
}

/**
 * Assert that a value is a symbol
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a symbol
 */
export function assertSymbol(input: unknown, context = 'input'): asserts input is symbol {
  if (typeof input !== 'symbol') {
    throw createAlpacaMarketValidationError(
      `Expected symbol in ${context}`,
      context,
      'symbol',
      typeof input,
      'is_symbol',
    )
  }
}

/**
 * Assert that a value is a bigint
 * @param input - The input to check
 * @param context - Context for the error message
 * @throws AlpacaMarketValidationError if the input is not a bigint
 */
export function assertBigInt(input: unknown, context = 'input'): asserts input is bigint {
  if (typeof input !== 'bigint') {
    throw createAlpacaMarketValidationError(
      `Expected bigint in ${context}`,
      context,
      'bigint',
      typeof input,
      'is_bigint',
    )
  }
}

/**
 * Assert that a value is a primitive type (string, number, boolean) or null/undefined
 * @param input - The value to check
 * @param context - Context for the error message
 */
export function assertPrimitiveOrNullish(
  input: unknown,
  context = 'input',
): asserts input is boolean | number | null | undefined {
  if (
    input !== null &&
    input !== undefined &&
    typeof input !== 'boolean' &&
    typeof input !== 'number'
  ) {
    throw createAlpacaMarketValidationError(
      `Expected null, undefined, boolean, or number in ${context}`,
      context,
      'null, undefined, boolean, or number',
      typeof input,
      'is_primitive_or_nullish',
    )
  }
}

/**
 * Assert that a number is less than a maximum value
 * @param input - The input to check
 * @param max - The maximum value
 * @param context - The context for the error message
 */
export function assertNumberLessThan(input: number, max: number, context = 'input'): asserts input is number {
  if (typeof input !== 'number' || input >= max) {
    throw createAlpacaMarketValidationError(
      `Expected number less than ${max} in ${context}`,
      context,
      `number < ${max}`,
      input,
      'number_less_than',
    )
  }
}

/**
 * Assert that a number is less than or equal to a maximum value
 * @param input - The input to check
 * @param max - The maximum value
 * @param context - The context for the error message
 */
export function assertNumberLessThanOrEqual(input: number, max: number, context = 'input'): asserts input is number {
  if (typeof input !== 'number' || input > max) {
    throw createAlpacaMarketValidationError(
      `Expected number less than or equal to ${max} in ${context}`,
      context,
      `number <= ${max}`,
      input,
      'number_less_than_or_equal',
    )
  }
}

/**
 * Assert that a number is greater than a minimum value
 * @param input - The input to check
 * @param min - The minimum value
 * @param context - The context for the error message
 */
export function assertNumberGreaterThan(input: number, min: number, context = 'input'): asserts input is number {
  if (typeof input !== 'number' || input <= min) {
    throw createAlpacaMarketValidationError(
      `Expected number greater than ${min} in ${context}`,
      context,
      `number > ${min}`,
      input,
      'number_greater_than',
    )
  }
}

/**
 * Assert that a number is greater than or equal to a minimum value
 * @param input - The input to check
 * @param min - The minimum value
 * @param context - The context for the error message
 */
export function assertNumberGreaterThanOrEqual(input: number, min: number, context = 'input'): asserts input is number {
  if (typeof input !== 'number' || input < min) {
    throw createAlpacaMarketValidationError(
      `Expected number greater than or equal to ${min} in ${context}`,
      context,
      `number >= ${min}`,
      input,
      'number_greater_than_or_equal',
    )
  }
}

/**
 * Assert that a string has a maximum number of wildcard characters
 * @param input - The input string to check
 * @param context - The context for the error message
 * @param maxWildcards - The maximum allowed wildcard characters
 */
export function assertMaxWildcards({
  input,
  context = 'input',
  maxWildcards = 50,
}: AssertInput & { maxWildcards?: number }): void {
  const wildcardCount = (input.match(PATTERNS.WILDCARD) || []).length
  if (wildcardCount > maxWildcards) {
    throw createAlpacaMarketValidationError(
      `Too many wildcards in ${context}: found ${wildcardCount}, maximum allowed is ${maxWildcards}`,
      context,
      `max ${maxWildcards} wildcards`,
      `${wildcardCount} wildcards`,
      'max_wildcards',
    )
  }
}

/**
 * Assert that a string is non-sensitive and matches at least one of the given patterns
 * @param input - The input to check
 * @param patterns - The patterns to match against
 * @param context - The context for the error message
 */
export function assertNonSensitiveString(
  input: unknown,
  patterns: RegExp[],
  context = 'input',
): asserts input is string {
  if (typeof input !== 'string' || !patterns.some((pattern) => pattern.test(input))) {
    throw createAlpacaMarketValidationError(
      `Sensitive string detected in ${context}. Expected a non-sensitive string`,
      context,
      'non-sensitive string',
      '<omitted>',
      'non_sensitive_string',
    )
  }
}
