/**
 * Internal validators for Alpaca Market account data.
 * @module
 */
import { assertArray, assertBoolean, assertNumber, assertObject, assertString } from './asserts.ts'
import { EnumValues } from '../utils/helpers.ts'
import { AlpacaMarketValidationError } from '../errors/errors.ts'
import {
  Account,
  ACCOUNT_STATUS,
  type AccountActivity,
  type AccountStatus,
  ACTIVITY_TYPE,
  type ActivityType,
  CRYPTO_STATUS,
  type CryptoStatus,
} from '../types/account.ts'

/**
 * Validate Alpaca Market account activity data.
 *
 * @param {unknown} data - The account activity data to validate
 * @throws {AlpacaMarketValidationError} If validation fails
 * @returns {AccountActivity} The validated account activity data
 */
export function validateAccountActivity(data: unknown): AccountActivity {
  assertObject(data, 'account activity response')
  const obj = data as Record<string, unknown>

  // Required fields
  assertString(obj.id, 'activity.id')
  assertString(obj.account_id, 'activity.account_id')
  assertString(obj.date, 'activity.date')
  assertString(obj.net_amount, 'activity.net_amount')

  // Validate enum values
  const validActivityTypes = EnumValues(ACTIVITY_TYPE)
  if (!validActivityTypes.includes(obj.activity_type as ActivityType)) {
    throw new AlpacaMarketValidationError(`Invalid activity_type: ${obj.activity_type}`, {
      field: 'activity.activity_type',
    })
  }

  // Optional fields validation
  const optionalStringFields = [
    'symbol',
    'qty',
    'per_share_amount',
    'cum_qty',
    'leaves_qty',
    'price',
    'description',
    'status',
    'transaction_time',
  ]
  optionalStringFields.forEach((field) => {
    if (obj[field] !== undefined) {
      assertString(obj[field], `activity.${field}`)
    }
  })

  // Optional side validation
  if (obj.side !== undefined) {
    const validSides = ['buy', 'sell']
    if (!validSides.includes(obj.side as string)) {
      throw new AlpacaMarketValidationError(`Invalid activity side: ${obj.side}`, { field: 'activity.side' })
    }
  }

  return obj as unknown as AccountActivity
}

/**
 * Validate an array of Alpaca Market account activity data.
 *
 * @param {unknown} data - The account activities data to validate
 * @throws {AlpacaMarketValidationError
} If validation fails for any activity in the array
 * @returns {AccountActivity[]} The validated account activities
 */
export function validateAccountActivityArray(data: unknown): AccountActivity[] {
  assertArray(data, 'account activities response')
  return (data as unknown[]).map((item, index) => {
    try {
      return validateAccountActivity(item)
    } catch (error) {
      throw new AlpacaMarketValidationError(
        `Error validating activity at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        { field: `activities[${index}]` },
      )
    }
  })
}

/**
 * Validate Alpaca Market account data.
 *
 * @param {unknown} data - The account data to validate
 * @throws {AlpacaMarketValidationError
} If validation fails
 * @returns {Account} The validated account data
 */
export function validateAccount(data: unknown): Account {
  assertObject(data, 'account response')
  const obj = data as Record<string, unknown>

  // Required fields
  assertString(obj.account_number, 'account.account_number')
  assertString(obj.buying_power, 'account.buying_power')
  assertString(obj.cash, 'account.cash')
  assertString(obj.created_at, 'account.created_at')
  assertString(obj.currency, 'account.currency')
  assertNumber(obj.daytrade_count, 'account.daytrade_count')
  assertString(obj.daytrading_buying_power, 'account.daytrading_buying_power')
  assertString(obj.equity, 'account.equity')
  assertString(obj.id, 'account.id')
  assertString(obj.initial_margin, 'account.initial_margin')
  assertString(obj.last_equity, 'account.last_equity')
  assertString(obj.last_maintenance_margin, 'account.last_maintenance_margin')
  assertString(obj.long_market_value, 'account.long_market_value')
  assertString(obj.maintenance_margin, 'account.maintenance_margin')
  assertString(obj.multiplier, 'account.multiplier')
  assertString(obj.portfolio_value, 'account.portfolio_value')
  assertString(obj.regt_buying_power, 'account.regt_buying_power')
  assertString(obj.short_market_value, 'account.short_market_value')
  assertString(obj.sma, 'account.sma')
  assertBoolean(obj.account_blocked, 'account.account_blocked')
  assertBoolean(obj.pattern_day_trader, 'account.pattern_day_trader')
  assertBoolean(obj.shorting_enabled, 'account.shorting_enabled')
  assertBoolean(obj.trade_suspended_by_user, 'account.trade_suspended_by_user')
  assertBoolean(obj.trading_blocked, 'account.trading_blocked')
  assertBoolean(obj.transfers_blocked, 'account.transfers_blocked')

  // Validate enum values
  const validStatuses = EnumValues(ACCOUNT_STATUS)
  if (!validStatuses.includes(obj.status as AccountStatus)) {
    throw new AlpacaMarketValidationError(`Invalid account status: ${obj.status}`, { field: 'account.status' })
  }

  // Optional fields
  if (obj.crypto_status !== undefined) {
    const validCryptoStatuses = EnumValues(CRYPTO_STATUS)
    if (!validCryptoStatuses.includes(obj.crypto_status as CryptoStatus)) {
      throw new AlpacaMarketValidationError(`Invalid crypto_status: ${obj.crypto_status}`, {
        field: 'account.crypto_status',
      })
    }
  }

  return obj as unknown as Account
}
