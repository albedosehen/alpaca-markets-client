import type { ValidationContext, ValidationResult } from '../types/validation.ts'
import {
  type AlpacaMarketErrorJSON,
  ERROR_CATEGORY,
  type ErrorCategory,
  type OperationalContext,
  type ValidationErrorJSON,
} from './errors.types.ts'

/**
 * AlpacaMarketValidationError for assertion failures with rich context
 *
 * This error extends the base Error class to include validation context and operational context.
 * It provides methods to create errors from validation results, enrich with additional context,
 * and convert to a standard AlpacaMarketError for consistency.
 */
export class AlpacaMarketValidationError extends Error {
  public readonly context?: ValidationContext
  public readonly operationalContext?: OperationalContext

  constructor(
    message: string,
    context?: ValidationContext,
    operationalContext?: OperationalContext,
  ) {
    super(message)
    this.name = 'ValidationError'
    this.context = context
    this.operationalContext = operationalContext
  }

  /**
   * Create ValidationError from validation result
   */
  public static fromValidationResult(
    result: ValidationResult,
    operationalContext?: OperationalContext,
  ): AlpacaMarketValidationError {
    return new AlpacaMarketValidationError(
      result.error || 'Validation failed',
      result.context,
      operationalContext,
    )
  }

  /**
   * Enrich with additional context
   */
  public enrich(context: Partial<ValidationContext>): AlpacaMarketValidationError {
    const enrichedContext: ValidationContext = {
      ...this.context,
      ...context,
    }

    return new AlpacaMarketValidationError(this.message, enrichedContext, this.operationalContext)
  }

  /**
   * Convert to AlpacaMarketError for consistency
   */
  public toAlpacaMarketError(): AlpacaMarketError {
    return new AlpacaMarketError(this.message, {
      category: 'validation',
      isRetryable: false,
      operationalContext: this.operationalContext,
      cause: this,
    })
  }

  /**
   * Serialize to JSON
   */
  public toJSON(): ValidationErrorJSON {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      operationalContext: this.operationalContext,
      stack: this.stack,
    }
  }
}

/**
 * Enhanced AlpacaMarketError with operational context and categorization
 */
export class AlpacaMarketError extends Error {
  public readonly status?: number
  public readonly url?: string
  public readonly responseBody?: string
  public readonly rateLimitReset?: Date
  public readonly operationalContext?: OperationalContext
  public readonly category: ErrorCategory
  public readonly isRetryable: boolean

  constructor(
    message: string,
    options?: {
      status?: number
      url?: string
      responseBody?: string
      rateLimitReset?: Date
      operationalContext?: OperationalContext
      category?: ErrorCategory
      isRetryable?: boolean
      cause?: Error
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'AlpacaMarketError'
    this.status = options?.status
    this.url = options?.url
    this.responseBody = options?.responseBody
    this.rateLimitReset = options?.rateLimitReset
    this.operationalContext = options?.operationalContext
    this.category = options?.category || this.categorizeError(options)
    this.isRetryable = options?.isRetryable ?? this.determineRetryability()
  }

  /**
   * Automatically categorize error based on context
   */
  private categorizeError(options?: { status?: number; url?: string }): ErrorCategory {
    if (options?.status) {
      if (options.status === 401) return ERROR_CATEGORY.AUTHENTICATION
      if (options.status === 403) return ERROR_CATEGORY.AUTHORIZATION
      if (options.status === 429) return ERROR_CATEGORY.RATE_LIMIT
      if (options.status >= 500) return ERROR_CATEGORY.API
      if (options.status >= 400) return ERROR_CATEGORY.VALIDATION
    }

    if (this.message.toLowerCase().includes('timeout')) return ERROR_CATEGORY.TIMEOUT
    if (this.message.toLowerCase().includes('network')) return ERROR_CATEGORY.NETWORK
    if (this.message.toLowerCase().includes('circuit')) return ERROR_CATEGORY.CIRCUIT_BREAKER

    return ERROR_CATEGORY.UNKNOWN
  }

  /**
   * Determine if error is retryable based on category and status
   */
  private determineRetryability(): boolean {
    switch (this.category) {
      case 'network':
      case 'timeout':
      case 'circuit_breaker':
        return true
      case 'rate_limit':
        return true // Can retry after rate limit reset
      case 'api':
        return this.status ? this.status >= 500 : false
      case 'authentication':
      case 'authorization':
      case 'validation':
      case 'configuration':
        return false
      default:
        return false
    }
  }

  /**
   * Enrich error with additional operational context
   */
  public enrich(context: Partial<OperationalContext>): AlpacaMarketError {
    const enrichedContext: OperationalContext = {
      timestamp: new Date(),
      ...this.operationalContext,
      ...context,
    }

    return new AlpacaMarketError(this.message, {
      status: this.status,
      url: this.url,
      responseBody: this.responseBody,
      rateLimitReset: this.rateLimitReset,
      operationalContext: enrichedContext,
      category: this.category,
      isRetryable: this.isRetryable,
      cause: this.cause as Error,
    })
  }

  /**
   * Create a new error with updated retry information
   */
  public withRetryInfo(attemptNumber: number, maxAttempts: number, nextRetryAt?: Date): AlpacaMarketError {
    return this.enrich({
      retry: {
        attemptNumber,
        maxAttempts,
        nextRetryAt,
      },
    })
  }

  /**
   * Create a new error with circuit breaker information
   */
  public withCircuitBreakerInfo(
    state: 'open' | 'closed' | 'half-open',
    failureCount: number,
    lastFailureTime?: Date,
  ): AlpacaMarketError {
    return this.enrich({
      circuitBreaker: {
        state,
        failureCount,
        lastFailureTime,
      },
    })
  }

  /**
   * Serialize error to JSON with all context
   */
  public toJSON(): AlpacaMarketErrorJSON {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      url: this.url,
      responseBody: this.responseBody,
      rateLimitReset: this.rateLimitReset?.toISOString(),
      operationalContext: this.operationalContext,
      category: this.category,
      isRetryable: this.isRetryable,
      stack: this.stack,
      cause: this.cause ? (this.cause as Error).message : undefined,
    }
  }
}

/**
 * Error enrichment utilities
 */
export class AlpacaMarketErrorContext {
  /**
   * Enrich any error with operational context and convert to AlpacaMarketError
   */
  public static enrichError(
    error: unknown,
    context?: Partial<OperationalContext>,
    category?: ErrorCategory,
  ): AlpacaMarketError {
    const baseContext: OperationalContext = {
      timestamp: new Date(),
      ...context,
    }

    if (error instanceof AlpacaMarketError) {
      return error.enrich(baseContext)
    }

    if (error instanceof AlpacaMarketValidationError) {
      return error.toAlpacaMarketError().enrich(baseContext)
    }

    if (error instanceof Response) {
      return new AlpacaMarketError(
        `API error ${error.status} from ${error.url}`,
        {
          status: error.status,
          url: error.url,
          operationalContext: baseContext,
          category: category || 'api',
        },
      )
    }

    if (error instanceof Error) {
      // Check if this is a timeout error (AbortSignal.timeout() throws DOMException)
      const isTimeoutError = error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('aborted')

      return new AlpacaMarketError(error.message, {
        operationalContext: baseContext,
        category: category || (isTimeoutError ? 'timeout' : 'unknown'),
        cause: error,
      })
    }

    const message = typeof error === 'string' ? error : 'Unknown error occurred'

    return new AlpacaMarketError(message, {
      operationalContext: baseContext,
      category: category || 'unknown',
    })
  }

  /**
   * Create network error with context
   */
  public static networkError(
    message: string,
    context?: Partial<OperationalContext>,
  ): AlpacaMarketError {
    return new AlpacaMarketError(message, {
      category: 'network',
      isRetryable: true,
      operationalContext: {
        timestamp: new Date(),
        ...context,
      },
    })
  }

  /**
   * Create timeout error with context
   */
  public static timeoutError(
    message: string,
    timeoutMs: number,
    context?: Partial<OperationalContext>,
  ): AlpacaMarketError {
    return new AlpacaMarketError(message, {
      category: 'timeout',
      isRetryable: true,
      operationalContext: {
        timestamp: new Date(),
        metadata: { timeoutMs },
        ...context,
      },
    })
  }

  /**
   * Create rate limit error with reset time
   */
  public static rateLimitError(
    message: string,
    resetTime?: Date,
    context?: Partial<OperationalContext>,
  ): AlpacaMarketError {
    return new AlpacaMarketError(message, {
      category: 'rate_limit',
      isRetryable: true,
      rateLimitReset: resetTime,
      operationalContext: {
        timestamp: new Date(),
        ...context,
      },
    })
  }
}

/**
 * Assertion helper that throws ValidationError with rich context
 */
export function createAssertion(
  ruleName: string,
  operationalContext?: OperationalContext,
) {
  return function assert(
    condition: boolean,
    message: string,
    context?: Partial<ValidationContext>,
  ): asserts condition {
    if (!condition) {
      const validationContext: ValidationContext = {
        rule: ruleName,
        ...context,
      }

      throw new AlpacaMarketValidationError(message, validationContext, operationalContext)
    }
  }
}
