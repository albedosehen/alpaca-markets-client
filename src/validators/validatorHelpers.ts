/**
 * Internal Validators for Alpaca Markets Client
 * @module
 */

import {
  assertMaxArrayLength,
  assertMaxStringLength,
  assertMaxWildcards,
  assertMinStringLength,
  assertNoDangerousSQL,
  assertNoEmptyString,
  assertNumberBetween,
  assertNumberLessThan,
  assertNumericString,
  assertObject,
  assertString,
  assertValidFormat,
} from './asserts.ts'
import { AlpacaMarketValidationError } from '../errors/errors.ts'
import { type ValidationContext, type ValidationResult } from '../types/validation.ts'
import { PATTERNS } from '../utils/patterns.ts'

/**
 * Helper functions for type checking
 */
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type for a generic function that can take any arguments
 * Used for type checking in validation functions
 */
type AnyFn = (...args: unknown[]) => unknown

function isFunction(value: unknown): value is AnyFn {
  return typeof value === 'function'
}

function isPrimitiveOrNullish(value: unknown): value is string | number | boolean | null | undefined {
  return value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
}

/**
 * Safe validation wrapper that converts exceptions to ValidationResult
 */
function safeValidation(
  validationFn: () => void,
  field?: string,
): ValidationResult {
  try {
    validationFn()
    return { success: true }
  } catch (error) {
    if (error instanceof AlpacaMarketValidationError) {
      return {
        success: false,
        error: error.message,
        context: error.context,
      }
    }

    const context: ValidationContext | undefined = field ? { field } : undefined
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      context,
    }
  }
}

/**
 * Validate field name to prevent injection attacks
 * @param field - Field name to validate
 */
export function validateFieldName(field: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(field, 'field name')
    assertNoEmptyString({ input: field, context: 'field name' })
    assertMaxStringLength({ input: field, context: 'field name', maxLength: 100 })
    assertNoDangerousSQL({
      input: field,
      context: 'field name',
      patterns: [...PATTERNS.SQL.FIELD_NAME_INJECTIONS],
    })
    assertValidFormat({
      input: field,
      context: 'field name',
      patterns: [PATTERNS.FIELD_NAME],
    })
  }, 'field')
}

/**
 * Validate a table name for database operations
 * @param table - The table name to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateTableName(table: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(table, 'table name')
    assertNoEmptyString({ input: table, context: 'table name' })
    assertMaxStringLength({ input: table, context: 'table name', maxLength: 64 })
    assertNoDangerousSQL({
      input: table,
      context: 'table name',
      patterns: [...PATTERNS.SQL.FIELD_NAME_INJECTIONS],
    })
    assertValidFormat({
      input: table,
      context: 'table name',
      patterns: [PATTERNS.TABLE_NAME],
    })
  }, 'table')
}

/**
 * Validate a host for connection configuration
 * @param host - The host to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateHost(host: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(host, 'host')
    assertNoEmptyString({ input: host, context: 'host' })
    assertMaxStringLength({ input: host, context: 'host', maxLength: 253 })
    assertValidFormat({
      input: host,
      context: 'host',
      patterns: [...PATTERNS.HOST],
    })
  }, 'host')
}

/**
 * Validate a port for connection configuration
 * @param port - The port to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validatePort(port: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(port, 'port')
    assertNoEmptyString({ input: port, context: 'port' })
    assertNumericString(port, 'port')
    assertNumberBetween(port, 1, 65535, 'port')
  }, 'port')
}

/**
 * Validate a username for database operations
 * @param username - The username to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateUsername(username: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(username, 'username')
    assertNoEmptyString({ input: username, context: 'username' })
    assertMinStringLength({ input: username, context: 'username', minLength: 3 })
    assertMaxStringLength({ input: username, context: 'username', maxLength: 64 })
    assertNoDangerousSQL({
      input: username,
      context: 'username',
      patterns: [...PATTERNS.SQL.FIELD_NAME_INJECTIONS],
    })
    assertValidFormat({
      input: username,
      context: 'username',
      patterns: [PATTERNS.FIELD_NAME],
    })
  }, 'username')
}

/**
 * Validate a password for database operations
 * @param password - The password to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validatePassword(password: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(password, 'password')
    assertNoEmptyString({ input: password, context: 'password' })
    assertMinStringLength({ input: password, context: 'password', minLength: 4 })
    assertMaxStringLength({ input: password, context: 'password', maxLength: 256 })
    assertValidFormat({
      input: password,
      context: 'password',
      patterns: [PATTERNS.PASSWORD],
    })
  }, 'password')
}

/**
 * Validate a query value for database operations
 * @param value - The value to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateQueryValue(value: unknown): ValidationResult {
  if (isPrimitiveOrNullish(value)) {
    return { success: true }
  }

  if (isString(value)) {
    return safeValidation(() => {
      assertMaxStringLength({ input: value, context: 'string value', maxLength: 10000 })
      assertNoDangerousSQL({
        input: value,
        context: 'string value',
        patterns: [...PATTERNS.SQL.CLAUSE_INJECTIONS],
      })
    }, 'value')
  }

  if (isArray(value)) {
    return safeValidation(() => {
      assertMaxArrayLength({ input: value, context: 'array value', maxLength: 1000 })

      for (let i = 0; i < value.length; ++i) {
        const result = validateQueryValue(value[i])
        if (!result.success) {
          throw new AlpacaMarketValidationError(`Error at array index [${i}]: ${result.error}`)
        }
      }
    }, 'array')
  }

  if (isObject(value)) {
    return safeValidation(() => {
      const entries = Object.entries(value as Record<string, unknown>)
      assertNumberLessThan(entries.length, 100, 'object length')

      for (const [key, val] of entries) {
        const keyResult = validateFieldName(key)
        if (!keyResult.success) {
          throw new AlpacaMarketValidationError(`Invalid object key "${key}": ${keyResult.error}`)
        }

        const valueResult = validateQueryValue(val)
        if (!valueResult.success) {
          throw new AlpacaMarketValidationError(`Error in object property "${key}": ${valueResult.error}`)
        }
      }
    }, 'object')
  }

  if (isFunction(value)) {
    return {
      success: false,
      error: 'Function types are not allowed in queries',
      context: { rule: 'no_functions' },
    }
  }

  return {
    success: false,
    error: `Unsupported data type: ${typeof value}`,
    context: {
      received: typeof value,
      rule: 'supported_type',
    },
  }
}

/**
 * Validate a LIKE pattern for database operations
 * @param pattern - The LIKE pattern to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateLikePattern(pattern: unknown): ValidationResult {
  return safeValidation(() => {
    assertString(pattern, 'LIKE pattern')
    assertNoEmptyString({ input: pattern, context: 'LIKE pattern' })
    assertMaxStringLength({ input: pattern, context: 'LIKE pattern', maxLength: 1000 })
    assertNoDangerousSQL({
      input: pattern,
      context: 'LIKE pattern',
      patterns: [...PATTERNS.SQL.CLAUSE_INJECTIONS],
    })
    assertMaxWildcards({ input: pattern, context: 'LIKE pattern', maxWildcards: 50 })
  }, 'pattern')
}

/**
 * Validate connection configuration
 * @param config - The connection configuration to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateConnectionConfig(config: unknown): ValidationResult {
  return safeValidation(() => {
    assertObject(config, 'connection config')

    const {
      host,
      port,
      namespace,
      database,
      username,
      password,
    } = config as Record<string, unknown>

    const hostResult = validateHost(host)
    if (!hostResult.success) {
      throw new AlpacaMarketValidationError(hostResult.error || 'Invalid host')
    }

    const portResult = validatePort(port)
    if (!portResult.success) {
      throw new AlpacaMarketValidationError(portResult.error || 'Invalid port')
    }

    const namespaceResult = validateTableName(namespace)
    if (!namespaceResult.success) {
      throw new AlpacaMarketValidationError(namespaceResult.error || 'Invalid namespace')
    }

    const databaseResult = validateTableName(database)
    if (!databaseResult.success) {
      throw new AlpacaMarketValidationError(databaseResult.error || 'Invalid database')
    }

    const usernameResult = validateUsername(username)
    if (!usernameResult.success) {
      throw new AlpacaMarketValidationError(usernameResult.error || 'Invalid username')
    }

    const passwordResult = validatePassword(password)
    if (!passwordResult.success) {
      throw new AlpacaMarketValidationError(passwordResult.error || 'Invalid password')
    }
  }, 'config')
}

/**
 * Assert function that throws a AlpacaMarketValidationError if validation fails
 * @param validationResult - The result of a validation function
 * @param context - Optional context for error reporting
 * @throws {AlpacaMarketValidationError} If validation fails
 */
export function assertValidation(validationResult: ValidationResult, context?: string): void {
  if (!validationResult.success) {
    const message = context ? `${context}: ${validationResult.error}` : validationResult.error!
    throw new AlpacaMarketValidationError(message, validationResult.context)
  }
}

/**
 * Safe validator that returns a result object instead of throwing
 * @param validator - The validation function to call
 * @param data - The data to validate
 * @returns Object with success boolean and either error or data
 */
export function safeValidate<T>(
  validator: (data: unknown) => ValidationResult,
  data: T,
): { success: true; data: T } | { success: false; error: AlpacaMarketValidationError } {
  try {
    const result = validator(data)
    if (result.success) {
      return { success: true, data }
    } else {
      const error = new AlpacaMarketValidationError(result.error || 'Validation failed', result.context)
      return { success: false, error }
    }
  } catch (error) {
    const validationError = error instanceof AlpacaMarketValidationError
      ? error
      : new AlpacaMarketValidationError(error instanceof Error ? error.message : String(error))
    return { success: false, error: validationError }
  }
}

/**
 * Sanitize and validate an object's properties recursively
 * @param obj - The object to sanitize
 * @param maxDepth - Maximum recursion depth to prevent infinite loops
 * @returns Sanitized object
 * @throws AlpacaMarketValidationError if validation fails
 */
export function sanitizeObject(obj: unknown, maxDepth = 10): unknown {
  if (maxDepth <= 0) {
    throw new AlpacaMarketValidationError('Maximum recursion depth exceeded during object sanitization')
  }

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    const result = validateQueryValue(obj)
    if (!result.success) {
      throw new AlpacaMarketValidationError(result.error || 'Invalid string value', result.context)
    }
    return obj
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }

  if (Array.isArray(obj)) {
    if (obj.length > 1000) {
      throw new AlpacaMarketValidationError('Arrays cannot exceed 1000 elements', {
        rule: 'max_array_length',
        expected: 'max 1000 elements',
        received: `${obj.length} elements`,
      })
    }
    return obj.map((item) => sanitizeObject(item, maxDepth - 1))
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {}
    const entries = Object.entries(obj as Record<string, unknown>)

    if (entries.length > 100) {
      throw new AlpacaMarketValidationError('Objects cannot have more than 100 properties', {
        rule: 'max_object_properties',
        expected: 'max 100 properties',
        received: `${entries.length} properties`,
      })
    }

    for (const [key, value] of entries) {
      const fieldResult = validateFieldName(key)
      if (!fieldResult.success) {
        throw new AlpacaMarketValidationError(fieldResult.error || 'Invalid field name', fieldResult.context)
      }
      sanitized[key] = sanitizeObject(value, maxDepth - 1)
    }
    return sanitized
  }

  throw new AlpacaMarketValidationError(`Unsupported data type: ${typeof obj}`, {
    rule: 'supported_type',
    received: typeof obj,
  })
}
