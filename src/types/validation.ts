/**
 * Validation context for structured error metadata
 */
export interface ValidationContext {
  /** Field or parameter name that failed validation */
  field?: string
  /** Expected value or format */
  expected?: string
  /** Actual value received */
  received?: unknown
  /** Validation rule that failed */
  rule?: string
  /** Additional context information */
  details?: Record<string, unknown>
  /** Path to the invalid field in nested objects */
  path?: string[]
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  success: boolean
  error?: string
  context?: ValidationContext
}
