/**
 * Parameters for fetching trade conditions
 */
export interface ConditionsParams {
  /** Type of tick data (trades or quotes) */
  ticktype: 'trades' | 'quotes'
}
