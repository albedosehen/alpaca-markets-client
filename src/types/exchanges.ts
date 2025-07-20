import type { Serialized } from '../utils/serializer.ts'

/**
 * Raw exchange data from Alpaca API
 */
interface ExchangeRawBase {
  /** Exchange code/identifier */
  code: string
  /** Full name of the exchange */
  name: string
  /** MIC (Market Identifier Code) */
  mic?: string
  /** Tape association */
  tape?: string
}

/**
 * Normalized exchange mapping
 */
interface ExchangeBase {
  /** Exchange code/identifier */
  code: string
  /** Full name of the exchange */
  name: string
  /** Short display name */
  displayName: string
  /** MIC (Market Identifier Code) */
  mic?: string
  /** Tape association (A, B, C) */
  tape?: string
  /** Whether the exchange is active */
  active: boolean
}

/**
 * Collection of exchange mappings
 */
interface ExchangeMappingsBase {
  [key: string]: ExchangeBase
}

export type ExchangeRaw = Serialized<ExchangeRawBase>
export type Exchange = Serialized<ExchangeBase>
export type ExchangeMappings = Serialized<ExchangeMappingsBase>

/**
 * Default exchange mappings for common codes
 *
 * This includes major US exchanges and their associated codes.
 *
 * @property A - NYSE MKT
 * @property B - NASDAQ OMX BX
 * @property C - National Stock Exchange
 * @property D - FINRA ADF
 * @property I - International Securities Exchange
 * @property J - Cboe EDGA
 * @property K - Cboe EDGX
 * @property M - Chicago Stock Exchange
 * @property N - New York Stock Exchange
 * @property P - NYSE Arca
 * @property Q - NASDAQ
 * @property S - NASDAQ Small Cap
 * @property T - NASDAQ Int
 * @property U - Members Exchange
 * @property V - IEX
 * @property W - Cboe
 * @property X - NASDAQ PSX
 * @property Y - Cboe BYX
 * @property Z - Cboe BZX
 */
export const DEFAULT_EXCHANGES: ExchangeMappings = {
  'A': {
    code: 'A',
    name: 'NYSE MKT',
    displayName: 'NYSE MKT',
    mic: 'XASE',
    tape: 'B',
    active: true,
  },
  'B': {
    code: 'B',
    name: 'NASDAQ OMX BX',
    displayName: 'NASDAQ BX',
    mic: 'XBOS',
    tape: 'C',
    active: true,
  },
  'C': {
    code: 'C',
    name: 'National Stock Exchange',
    displayName: 'NSX',
    mic: 'XCIS',
    tape: 'C',
    active: true,
  },
  'D': {
    code: 'D',
    name: 'FINRA ADF',
    displayName: 'FINRA ADF',
    mic: 'XADF',
    tape: 'C',
    active: true,
  },
  'I': {
    code: 'I',
    name: 'International Securities Exchange',
    displayName: 'ISE',
    mic: 'XISX',
    tape: 'C',
    active: true,
  },
  'J': {
    code: 'J',
    name: 'Cboe EDGA',
    displayName: 'EDGA',
    mic: 'EDGA',
    tape: 'C',
    active: true,
  },
  'K': {
    code: 'K',
    name: 'Cboe EDGX',
    displayName: 'EDGX',
    mic: 'EDGX',
    tape: 'C',
    active: true,
  },
  'M': {
    code: 'M',
    name: 'Chicago Stock Exchange',
    displayName: 'CHX',
    mic: 'XCHI',
    tape: 'C',
    active: true,
  },
  'N': {
    code: 'N',
    name: 'New York Stock Exchange',
    displayName: 'NYSE',
    mic: 'XNYS',
    tape: 'A',
    active: true,
  },
  'P': {
    code: 'P',
    name: 'NYSE Arca',
    displayName: 'Arca',
    mic: 'ARCX',
    tape: 'B',
    active: true,
  },
  'Q': {
    code: 'Q',
    name: 'NASDAQ',
    displayName: 'NASDAQ',
    mic: 'XNAS',
    tape: 'C',
    active: true,
  },
  'S': {
    code: 'S',
    name: 'NASDAQ Small Cap',
    displayName: 'NASDAQ SC',
    mic: 'XNMS',
    tape: 'C',
    active: true,
  },
  'T': {
    code: 'T',
    name: 'NASDAQ Int',
    displayName: 'NASDAQ Int',
    mic: 'XNGS',
    tape: 'C',
    active: true,
  },
  'U': {
    code: 'U',
    name: 'Members Exchange',
    displayName: 'MEMX',
    mic: 'MEMX',
    tape: 'C',
    active: true,
  },
  'V': {
    code: 'V',
    name: 'IEX',
    displayName: 'IEX',
    mic: 'IEXG',
    tape: 'C',
    active: true,
  },
  'W': {
    code: 'W',
    name: 'Cboe',
    displayName: 'CBOE',
    mic: 'XCBO',
    tape: 'C',
    active: true,
  },
  'X': {
    code: 'X',
    name: 'NASDAQ PSX',
    displayName: 'PSX',
    mic: 'XPHL',
    tape: 'C',
    active: true,
  },
  'Y': {
    code: 'Y',
    name: 'Cboe BYX',
    displayName: 'BYX',
    mic: 'BATY',
    tape: 'C',
    active: true,
  },
  'Z': {
    code: 'Z',
    name: 'Cboe BZX',
    displayName: 'BZX',
    mic: 'BATS',
    tape: 'C',
    active: true,
  },
}
