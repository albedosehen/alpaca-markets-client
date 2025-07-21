/**
 * Bar Types for Alpaca Markets Client
 * Provides types and interfaces for bar data.
 * @module
 */

import type { Serialized } from '../utils/serializer.ts'

/**
 * Raw bar data as defined by the official Alpaca Markets API
 */
export interface BarRaw {
  /** Timestamp of the bar */
  t: string
  /** Open price */
  o: number
  /** High price */
  h: number
  /** Low price */
  l: number
  /** Close price */
  c: number
  /** Volume */
  v: number
  /** Trade count */
  n?: number
  /** Volume weighted average price */
  vw?: number
}

/**
 * Bar data
 */
export interface Bar {
  /** Timestamp of the bar */
  timestamp: Date
  /** Open price */
  open: number
  /** High price */
  high: number
  /** Low price */
  low: number
  /** Close price */
  close: number
  /** Volume */
  volume: number
  /** Trade count */
  tradeCount?: number
  /** Volume weighted average price */
  vwap?: number
  /** Symbol */
  symbol: string
}

/**
 * Serialized versions for API transmission
 */
export type BarSerialized = Serialized<Bar>
