import type { Serialized } from '../utils/serializer.ts'

/**
 * Raw tape code data from Alpaca API
 */
interface TapeCodeRawBase {
  /** Tape code identifier (A, B, C) */
  tape: string
  /** Human-readable description of the tape */
  name: string
}

/**
 * Normalized tape code mapping
 */
interface TapeCodeBase {
  /** Tape code identifier (A, B, C) */
  code: string
  /** Human-readable name (NYSE, NYSE Arca, NASDAQ) */
  name: string
  /** Detailed description */
  description: string
}

/**
 * Collection of tape code mappings
 */
interface TapeCodeMappingsBase {
  [key: string]: TapeCodeBase
}

export type TapeCodeRaw = Serialized<TapeCodeRawBase>
export type TapeCode = Serialized<TapeCodeBase>
export type TapeCodeMappings = Serialized<TapeCodeMappingsBase>

/**
 * Default tape code mappings based on standard market conventions
 */
export const DEFAULT_TAPE_CODES: TapeCodeMappings = {
  A: {
    code: 'A',
    name: 'NYSE',
    description: 'New York Stock Exchange',
  },
  B: {
    code: 'B',
    name: 'NYSE Arca',
    description: 'NYSE Arca (formerly American Stock Exchange)',
  },
  C: {
    code: 'C',
    name: 'NASDAQ',
    description: 'NASDAQ Stock Market',
  },
}
