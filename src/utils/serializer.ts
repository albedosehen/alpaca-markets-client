/**
 * Helper type for serializing nested objects without requiring id field
 */
type SerializedObject<T> = {
  [K in keyof T]: SerializedValue<T[K]>
}

/**
 * Map a value to its serialized form:
 * - { id } ➔ string
 * - Date     ➔ string
 * - Object   ➔ recursively serialized
 * - Other    ➔ unchanged
 */
type SerializedValue<T> = T extends { id: string } ? string
  : T extends Date ? string
  : T extends (Date | null) ? string | null
  : T extends (Date | undefined) ? string | undefined
  : T extends (Date | null | undefined) ? string | null | undefined
  : T extends object ? SerializedObject<T>
  : T

/**
 * Serializes all properties of a type T for JSON or API transmission:
 * - For each property, applies SerializedValue to map { id } and Date to string, and objects recursively
 * - Preserves optional properties (e.g., Date | undefined becomes string | undefined)
 * - Ensures the shape of T is maintained, but with all fields in their serialized (JSON-safe) form
 *
 * Example:
 *   // Given:
 *   interface Comment {
 *     id: { id: string }
 *     createdAt: Date
 *     editedAt?: Date
 *   }
 *   // Then:
 *   Serialized<Comment> == {
 *     id: string
 *     createdAt: string
 *     editedAt?: string
 *   }
 */
export type Serialized<T> = SerializedObject<T>

/**
 * Serializer interface for transforming data
 * Provides methods to convert { id } and Date fields to their string representations
 * and allows for custom serialization logic
 *
 * @template R - Raw record type with { id } and Date objects
 * @returns Serializer object with methods for common transformations
 */
export type Serializer<R extends { id: string }> = {
  id: (record: R) => string
  idArray: (ids: R[]) => string[]
  optionalId: (record?: R) => string | undefined
  date: (date: Date) => string
  optionalDate: (date?: Date) => string | undefined
  optionalNumber: (n?: number) => number | undefined
  dateOrNull: (date: Date | null) => string | null
  dateArray: (dates: Date[]) => string[]
  number: (n: number) => number
  numberOrNull: (n: number | null) => number | null
  // deno-lint-ignore no-explicit-any
  objectArray: <T>(arr: T[], serializer: (obj: T) => any) => any[]
  // deno-lint-ignore no-explicit-any
  optionalObject: <T>(obj: T | undefined, serializer: (obj: T) => any) => any | undefined
  // deno-lint-ignore no-explicit-any
  extend: (more: Record<string, (...args: any[]) => any>) => Serializer<R> & typeof more
  // deno-lint-ignore no-explicit-any
} & Record<string, (...args: any[]) => any>

/**
 * Creates a collection of common serialization functions for transforming
 * raw database types to serializable types
 *
 * @template R - Raw database record type with { id } and Date objects
 * @returns Object containing common transformation utilities
 * @example
 * ```typescript
 * interface UserRaw {
 *   id: { id: string }
 *   name: string
 *   createdAt: Date
 * }
 *
 * const serializer = createSerializer<UserRaw>()
 *
 * const mapUser = (raw: UserRaw) => ({
 *   id: serializer.id(raw),
 *   name: raw.name,
 *   createdAt: serializer.date(raw.createdAt)
 * })
 * ```
 */
export const createSerializer = <R extends { id: string }>(
  // deno-lint-ignore no-explicit-any
  custom?: Record<string, (...args: any[]) => any>,
): Serializer<R> => {
  const base = {
    /**
     * Convert a Record containing { id } to string representation
     *
     * @param record - Record containing { id }
     * @returns String representation of the { id }
     */
    id: (record: R): string => record.id,

    /**
     * Convert a Date object to ISO string representation
     *
     * @param date - Date object to convert
     * @returns ISO string representation of the date
     */
    idArray: (ids: R[]): string[] => ids.map((r) => r.id),

    /**
     * Convert an optional Record containing { id } to string or undefined
     *
     * @param record - Optional record containing { id }
     * @returns String representation of the { id } or undefined
     */
    optionalId: (record?: R): string | undefined => record?.id,

    /**
     * Convert a Date object to ISO string representation
     *
     * @param date - Date object to convert
     * @returns ISO string representation of the date
     */
    date: (date: Date): string => date.toISOString(),

    /**
     * Convert an optional Date to ISO string or undefined
     *
     * @param date - Optional Date object to convert
     * @returns ISO string representation or undefined
     */
    optionalDate: (date?: Date): string | undefined => date?.toISOString(),

    /**
     * Convert an optional number to number or undefined
     *
     * @param n - Optional number to convert
     * @returns Number or undefined
     */
    optionalNumber: (n?: number): number | undefined => n,

    /**
     * Convert a Date or null to ISO string or null
     *
     * @param date - Date or null to convert
     * @returns ISO string representation or null
     */
    dateOrNull: (date: Date | null): string | null => (date ? date.toISOString() : null),

    /**
     * Convert an array of Dates to ISO strings
     *
     * @param dates - Array of Dates to convert
     * @returns Array of ISO string representations
     */
    dateArray: (dates: Date[]): string[] => dates.map((date) => date.toISOString()),

    /**
     * Pass through a number
     *
     * @param n - Number value
     * @returns The same number
     */
    number: (n: number): number => n,

    /**
     * Pass through a number or null (type consistency)
     *
     * @param n - Number value or null
     * @returns The same number or null
     */
    numberOrNull: (n: number | null): number | null => n,

    /**
     * Serialize an array of objects using a provided serializer function
     *
     * @param arr - Array of objects
     * @param serializer - Function to serialize each object
     * @returns Array of serialized objects
     */
    // deno-lint-ignore no-explicit-any
    objectArray: <T>(arr: T[], serializer: (obj: T) => any): any[] => arr.map(serializer),

    /**
     * Serialize an object using a provided serializer function
     *
     * @param obj - Object to serialize
     * @param serializer - Function to serialize the object
     * @returns Serialized object or undefined if input is undefined
     */
    // deno-lint-ignore no-explicit-any
    optionalObject: <T>(obj: T | undefined, serializer: (obj: T) => any): any | undefined =>
      obj ? serializer(obj) : undefined,

    /**
     * Extend the serializer with additional custom serialization logic
     * @param obj - Object containing additional serialization methods
     * @returns Extended serializer object
     */
    // deno-lint-ignore no-explicit-any
    extend(obj: Record<string, (...args: any[]) => any>) {
      return { ...base, ...obj }
    },
  }

  return {
    ...base,
    ...(custom || {}),
  }
}
