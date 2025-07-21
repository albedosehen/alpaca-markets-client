/**
 * Types and interfaces for Metadata Endpoint
 * @module
 */

/**
 * ConditionsParams interface
 *
 * This interface defines the parameters for fetching conditions data
 * from the Alpaca Markets Metadata Endpoint.
 */
export interface ConditionsParams {
  /** Type of tick data (trades or quotes) */
  ticktype: 'trades' | 'quotes'
}
