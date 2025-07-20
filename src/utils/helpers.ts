import { assertNonSensitiveString } from '../validators/asserts.ts'
import { PATTERNS } from './patterns.ts'
import type { AnyFn } from '../types/shared.ts'

/**
 * Safely stringify an object, handling circular references and sensitive data
 * @param obj - The object to stringify
 * @returns Safe JSON string representation
 */
export function safeJsonStringify(obj: unknown): string {
  const seen = new WeakSet()

  try {
    return JSON.stringify(obj, (key, value) => {
      // Remove sensitive keys
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'credentials']
      if (typeof key === 'string' && sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        return '[REDACTED]'
      }

      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }

      return value
    })
  } catch {
    return '[Object could not be serialized]'
  }
}

/**
 * Truncate message to prevent overly long error messages
 * @param message - The message to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated message
 */
export function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message
  }
  return message.substring(0, maxLength - 3) + '...'
}

/**
 * Determine if we're running in a production environment
 * Checks DENO_ENV or ENV environment variables
 * @returns true if in production, false otherwise
 */
export function isProductionEnvironment(): boolean {
  const env = Deno.env.get('DENO_ENV') || Deno.env.get('ENV') || 'development'
  return env === 'production'
}

/**
 * Sanitize error messages to prevent sensitive information exposure
 * @param message - The error message to sanitize
 * @param includeDetails - Whether to include detailed error information
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(message: string, includeDetails: boolean): string {
  if (!includeDetails) {
    try {
      assertNonSensitiveString(message, [...PATTERNS.SENSITIVE.SECRETS], 'Sanitized Error ')
    } catch (e) {
      return `Sensitive error: ${(e as Error).message}`
    }

    // Hide internal file paths and system information
    let sanitized = message
    for (const pattern of PATTERNS.INTERNAL_PATHS) {
      sanitized = sanitized.replace(pattern, '[internal]')
    }

    // Filter out any SQL injection patterns
    for (const pattern of PATTERNS.SQL.CLAUSE_INJECTIONS) {
      sanitized = sanitized.replace(pattern, '[filtered]')
    }

    return sanitized
  }

  // In development, return the full message but still sanitize obvious secrets
  let sanitized = message
  for (const pattern of [...PATTERNS.SENSITIVE.SECRETS]) {
    sanitized = sanitized.replace(pattern, (_match, p1, p2) => {
      return `${p1}${p2 || ''}[omitted]`
    })
  }

  return sanitized
}

/**
 * Decode and validate a JWT token, extracting the payload only after signature verification
 * @param token - The JWT token to decode and validate
 * @param secret - Optional secret key for verification (if not provided, only basic validation is performed)
 * @returns The decoded payload
 * @throws Error if token is invalid or signature verification fails
 */
export async function validateAndDecodeJWTPayload<T = unknown>(token: string, secret?: string): Promise<T> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid JWT token: token must be a non-empty string')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token: must have exactly 3 parts')
  }

  const [headerB64, payloadB64, _signatureB64] = parts

  let header: { alg?: string; typ?: string }
  try {
    const headerPadded = base64UrlDecode(headerB64)
    header = JSON.parse(headerPadded)
    if (header.typ && header.typ !== 'JWT') {
      throw new Error('Invalid JWT token: incorrect type')
    }
  } catch (e) {
    throw new Error(`Invalid JWT token: malformed header - ${e instanceof Error ? e.message : String(e)}`)
  }

  let payload: T
  try {
    const payloadDecoded = base64UrlDecode(payloadB64)
    payload = JSON.parse(payloadDecoded) as T
  } catch (e) {
    throw new Error(`Invalid JWT token: malformed payload - ${e instanceof Error ? e.message : String(e)}`)
  }

  if (typeof payload === 'object' && payload !== null && 'exp' in payload) {
    const exp = (payload as { exp: unknown }).exp
    if (typeof exp === 'number' && exp * 1000 < Date.now()) {
      throw new Error('JWT token has expired')
    }
  }

  // Verify signature when secret is provided
  if (secret && header.alg) {
    try {
      await verifyJWTSignature(token, secret, header.alg)
    } catch (e) {
      throw new Error(`JWT signature verification failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return payload
}

/**
 * Decode base64url encoded string
 * @param base64url - The base64url encoded string
 * @returns The decoded string
 */
function base64UrlDecode(base64url: string): string {
  // Replace URL-safe characters with standard base64 characters
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if necessary
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return atob(padded)
}

/**
 * Verify JWT signature using Web Crypto API
 * @param token - The JWT token to verify
 * @param secret - The secret key for verification
 * @param algorithm - The signing algorithm
 */
export async function verifyJWTSignature(token: string, secret: string, algorithm: string): Promise<void> {
  const [headerB64, payloadB64, signatureB64] = token.split('.')
  const data = `${headerB64}.${payloadB64}`

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: getHashAlgorithm(algorithm) },
    false,
    ['verify'],
  )

  const signature = base64UrlToUint8Array(signatureB64)
  const isValid = await globalThis.crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(data),
  )

  if (!isValid) {
    throw new Error('Invalid JWT signature')
  }
}

/**
 * Convert base64url string to Uint8Array
 * @param base64url - The base64url encoded string
 * @returns Uint8Array representation
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binaryString = atob(padded)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Get hash algorithm for Web Crypto API
 * @param algorithm - JWT algorithm
 * @returns Hash algorithm name
 */
function getHashAlgorithm(algorithm: string): string {
  switch (algorithm) {
    case 'HS256':
      return 'SHA-256'
    case 'HS384':
      return 'SHA-384'
    case 'HS512':
      return 'SHA-512'
    default:
      throw new Error(`Unsupported JWT algorithm: ${algorithm}`)
  }
}

/**
 * Check if a value is a primitive type or null/undefined
 * @param value - The value to check
 * @returns True if the value is a primitive type or null/undefined, false otherwise
 */
export function isPrimitiveOrNullish(value: unknown): value is boolean | number | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  )
}

/**
 * Check if a value is a string
 * @param value - The value to check
 * @returns True if the value is a string, false otherwise
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Check if a value is a number
 * @param value - The value to check
 * @returns True if the value is a number, false otherwise
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

/**
 * Check if a value is a boolean
 * @param value - The value to check
 * @returns True if the value is a boolean, false otherwise
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Check if a value is an object (excluding arrays and null)
 * @param value - The value to check
 * @returns True if the value is an object, false otherwise
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check if a value is an array
 * @param value - The value to check
 * @returns True if the value is an array, false otherwise
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Check if a value is a function
 * @param value - The value to check
 * @returns True if the value is a function, false otherwise
 */
export function isFunction(value: unknown): value is AnyFn {
  return typeof value === 'function'
}

/**
 * Check if a value is less than another value
 * @param a - The first value
 * @param b - The second value
 * @returns True if the first value is less than the second value, false otherwise
 */
export function lessThan(a: number, b: number): boolean {
  return a < b
}

/**
 * Check if a value is greater than another value
 * @param a - The first value
 * @param b - The second value
 * @returns True if the first value is greater than the second value, false otherwise
 */
export function greaterThan(a: number, b: number): boolean {
  return a > b
}

/**
 * Check if two values are equal
 * @param a - The first value
 * @param b - The second value
 * @returns True if the two values are equal, false otherwise
 */
export function equalTo(a: number, b: number): boolean {
  return a === b
}

/**
 * Utility functions for working with enumerations in TypeScript
 */

/**
 * Extracts the values from an enum-like object for use with Zod's z.enum()
 * @param enumObject - The enum object to extract values from
 * @returns Array of enum values as a tuple for TypeScript inference
 */
export function EnumValues<T extends Record<string, string | number>>(
  enumObject: T,
): [T[keyof T], ...T[keyof T][]] {
  const values = Object.values(enumObject) as T[keyof T][]
  return [values[0], ...values.slice(1)] as [T[keyof T], ...T[keyof T][]]
}
