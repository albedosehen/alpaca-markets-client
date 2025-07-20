/**
 * Error categories for better classification and handling
 *
 * @property NETWORK - Network-related errors
 * @property VALIDATION - Validation errors for input data
 * @property API - Errors related to API responses
 * @property TIMEOUT - Request timeouts
 * @property CIRCUIT_BREAKER - Circuit breaker triggered errors
 * @property RATE_LIMIT - Rate limiting errors
 * @property AUTHENTICATION - Authentication failures
 * @property AUTHORIZATION - Authorization failures
 * @property CONFIGURATION - Configuration errors
 * @property UNKNOWN - Unknown or unclassified errors
 */
export const ERROR_CATEGORY = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  API: 'api',
  TIMEOUT: 'timeout',
  CIRCUIT_BREAKER: 'circuit_breaker',
  RATE_LIMIT: 'rate_limit',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  CONFIGURATION: 'configuration',
  UNKNOWN: 'unknown',
} as const

/** Error categories for better classification and handling */
export type ErrorCategory = (typeof ERROR_CATEGORY)[keyof typeof ERROR_CATEGORY]

/**
 * Operational context for error tracking and debugging
 *
 * This interface provides additional metadata about the operation that failed,
 * including timing, retry attempts, and circuit breaker state.
 */
export interface OperationalContext {
  /** Timestamp when error occurred */
  timestamp: Date
  /** Operation that failed */
  operation?: string
  /** Request ID for tracing */
  requestId?: string
  /** User ID if available */
  userId?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Timing information */
  timing?: {
    startTime: number
    duration: number
  }
  /** Retry information */
  retry?: {
    attemptNumber: number
    maxAttempts: number
    nextRetryAt?: Date
  }
  /** Circuit breaker information */
  circuitBreaker?: {
    state: 'open' | 'closed' | 'half-open'
    failureCount: number
    lastFailureTime?: Date
  }
}

/**
 * JSON serialization interface for AlpacaMarketValidationError
 */
export interface ValidationErrorJSON {
  readonly name: string
  readonly message: string
  readonly context?: unknown
  readonly operationalContext?: OperationalContext
  readonly stack?: string
}

/**
 * JSON serialization interface for AlpacaMarketError
 */
export interface AlpacaMarketErrorJSON {
  readonly name: string
  readonly message: string
  readonly status?: number
  readonly url?: string
  readonly responseBody?: string
  readonly rateLimitReset?: string
  readonly operationalContext?: OperationalContext
  readonly category: ErrorCategory
  readonly isRetryable: boolean
  readonly stack?: string
  readonly cause?: string
}
