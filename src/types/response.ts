/**
 * API response structure from Alpaca Market
 *
 * This defines the standard format for all API responses,
 * including success and error cases.
 */
export interface ApiResponse<T = unknown> {
  data?: T
  message?: string
  code?: number
}

/**
 * Paginated response from the API.
 */
export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  nextPageToken?: string
}

/**
 * Error response from the Alpaca Market API.
 *
 * This structure is used for all error responses,
 * providing a consistent format for error handling.
 */
export interface ApiErrorResponse {
  code: number
  message: string
  details?: Record<string, unknown>
}
