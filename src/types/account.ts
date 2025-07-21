/**
 * Account Types for Alpaca Markets Client
 * Provides types and interfaces for user accounts, account activities, and related enums.
 * @module
 */

import type { Serialized } from '../utils/serializer.ts'

/**
 * Account status values for user accounts.
 *
 * @property Onboarding - User is in onboarding process
 * @property SubmissionFailed - Account submission failed
 * @property Submitted - Account submitted for review
 * @property AccountUpdated - Account information updated
 * @property ApprovalPending - Account approval pending
 * @property Active - Account is active and trading
 * @property Rejected - Account application rejected
 */
export const ACCOUNT_STATUS = {
  Onboarding: 'ONBOARDING',
  SubmissionFailed: 'SUBMISSION_FAILED',
  Submitted: 'SUBMITTED',
  AccountUpdated: 'ACCOUNT_UPDATED',
  ApprovalPending: 'APPROVAL_PENDING',
  Active: 'ACTIVE',
  Rejected: 'REJECTED',
} as const
export type AccountStatus = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS]

/**
 * Crypto status values for cryptocurrency assets.
 *
 * @property Active - Cryptocurrency is active and trading
 * @property Inactive - Cryptocurrency is inactive
 * @property ApprovalPending - Cryptocurrency approval is pending
 */
export const CRYPTO_STATUS = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  ApprovalPending: 'APPROVAL_PENDING',
} as const
export type CryptoStatus = typeof CRYPTO_STATUS[keyof typeof CRYPTO_STATUS]

/**
 * Activity types for account activities.
 *
 * @property Fill - Trade fill activity
 * @property Trans - Transfer activity
 * @property Misc - Miscellaneous activity
 * @property Acatc - ACAT transfer activity
 * @property Acats - ACATS transfer activity
 * @property Csd - Cash sweep deposit activity
 * @property Csw - Cash sweep withdrawal activity
 * @property Div - Dividend activity
 * @property Divcgl - Dividend capital gain activity
 * @property Divcgs - Dividend capital gain short activity
 * @property Divfee - Dividend fee activity
 * @property Divft - Dividend foreign tax activity
 * @property Divnra - Dividend non-resident alien activity
 * @property Divroc - Dividend return of capital activity
 * @property Divtw - Dividend tax withheld activity
 * @property Divtxex - Dividend tax exempt activity
 * @property Int - Interest activity
 * @property Intnra - Interest non-resident alien activity
 * @property Inttw - Interest tax withheld activity
 * @property Jnl - Journal activity
 * @property Jnlc - Journal cash activity
 * @property Jnls - Journal stock activity
 * @property Ma - Market activity
 * @property Nc - Non-cash activity
 * @property Opasn - Options assignment activity
 * @property Opexp - Options expiration activity
 * @property Opxrc - Options exercise activity
 * @property Ptc - Payment to client activity
 * @property Ptr - Payment to registered representative activity
 * @property Reorg - Reorganization activity
 * @property Sso - Stock split activity
 * @property Ssp - Stock spin-off activity
 */
export const ACTIVITY_TYPE = {
  Fill: 'FILL',
  Trans: 'TRANS',
  Misc: 'MISC',
  Acatc: 'ACATC',
  Acats: 'ACATS',
  Csd: 'CSD',
  Csw: 'CSW',
  Div: 'DIV',
  Divcgl: 'DIVCGL',
  Divcgs: 'DIVCGS',
  Divfee: 'DIVFEE',
  Divft: 'DIVFT',
  Divnra: 'DIVNRA',
  Divroc: 'DIVROC',
  Divtw: 'DIVTW',
  Divtxex: 'DIVTXEX',
  Int: 'INT',
  Intnra: 'INTNRA',
  Inttw: 'INTTW',
  Jnl: 'JNL',
  Jnlc: 'JNLC',
  Jnls: 'JNLS',
  Ma: 'MA',
  Nc: 'NC',
  Opasn: 'OPASN',
  Opexp: 'OPEXP',
  Opxrc: 'OPXRC',
  Ptc: 'PTC',
  Ptr: 'PTR',
  Reorg: 'REORG',
  Sso: 'SSO',
  Ssp: 'SSP',
} as const
export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE]

/**
 * Trade side values
 *
 * Represents the side of a trade, either 'buy' or 'sell'.
 */
type TradeSide = 'buy' | 'sell'

/**
 * Base interface for account information
 */
interface AccountBase {
  /** Whether account is blocked */
  account_blocked: boolean
  /** Account number */
  account_number: string
  /** Current buying power */
  buying_power: string
  /** Cash balance */
  cash: string
  /** Account creation date */
  created_at: string
  /** Account currency */
  currency: string
  /** Daytrading buying power */
  daytrading_buying_power: string
  /** Daytrade count */
  daytrade_count: number
  /** Total equity */
  equity: string
  /** Account ID */
  id: string
  /** Initial margin requirement */
  initial_margin: string
  /** Previous day equity */
  last_equity: string
  /** Previous day maintenance margin */
  last_maintenance_margin: string
  /** Long positions market value */
  long_market_value: string
  /** Maintenance margin requirement */
  maintenance_margin: string
  /** Buying power multiplier */
  multiplier: string
  /** Whether account is flagged as PDT */
  pattern_day_trader: boolean
  /** Total portfolio value */
  portfolio_value: string
  /** RegT buying power */
  regt_buying_power: string
  /** Short positions market value */
  short_market_value: string
  /** Whether shorting is enabled */
  shorting_enabled: boolean
  /** Special Memorandum Account balance */
  sma: string
  /** Account status */
  status: AccountStatus
  /** Whether trading is suspended by user */
  trade_suspended_by_user: boolean
  /** Whether trading is blocked */
  trading_blocked: boolean
  /** Whether transfers are blocked */
  transfers_blocked: boolean
  /** Options buying power */
  options_buying_power?: string
  /** Options approval level */
  options_approved_level?: number
  /** Options trading level */
  options_trading_level?: number
  /** Maximum margin multiplier */
  max_margin_multiplier?: string
  /** Crypto trading status */
  crypto_status?: CryptoStatus
}

/**
 * Base interface for account activity
 */
interface AccountActivityBase {
  /** Activity ID */
  id: string
  /** Account ID */
  account_id: string
  /** Activity type */
  activity_type: ActivityType
  /** Activity date */
  date: string
  /** Net amount */
  net_amount: string
  /** Symbol (if applicable) */
  symbol?: string
  /** Quantity (if applicable) */
  qty?: string
  /** Per share amount */
  per_share_amount?: string
  /** Cumulative quantity */
  cum_qty?: string
  /** Remaining quantity */
  leaves_qty?: string
  /** Price */
  price?: string
  /** Side (if applicable) */
  side?: TradeSide
  /** Transaction type */
  type?: string
  /** Transaction time */
  transaction_time?: string
}

/** Serialized types for account and activity */
export type Account = Serialized<AccountBase>
export type AccountActivity = Serialized<AccountActivityBase>
