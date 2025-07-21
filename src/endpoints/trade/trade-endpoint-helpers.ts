/**
 * Helpers for Trade Endpoint
 * Provides factory functions to create trading clients with different configurations
 * for various trading strategies, including conservative and high-frequency trading.
 * @module
 */
import type { AlpacaMarketClient } from '../../client/alpaca.ts'
import { AlpacaTradeEndpoint } from './trade-endpoint.ts'
import type { TradingClientConfig } from './trade-endpoint.types.ts'

/**
 * Factory function to create a TradingClient with default configuration
 *
 * @param {AlpacaMarketClient} apiClient - The Alpaca API client instance
 * @param {TradingClientConfig} [config] - Optional configuration for the trading client
 * @returns {AlpacaTradeEndpoint} - An instance of the trading client with default
 */
export const createTradingClient = (
  apiClient: AlpacaMarketClient,
  config?: TradingClientConfig,
): AlpacaTradeEndpoint => {
  const defaultConfig: TradingClientConfig = {
    cacheConfig: {
      enabled: true,
      maxSize: 1000,
      defaultTtlMs: 300000, // 5 minutes
    },
    circuitBreakerConfig: {
      failureThreshold: 3,
      timeoutMs: 10000,
      recoveryTimeoutMs: 30000,
      halfOpenMaxAttempts: 1,
      resetTimeoutMs: 300000,
    },

    requestDeduplicationConfig: {
      enabled: true,
      maxPendingRequests: 50,
      timeoutMs: 30000,
    },
    connectionPoolConfig: {
      enabled: true,
      maxConnections: 5,
      maxIdleTime: 30000,
      keepAlive: true,
      timeout: 15000,
    },
  }

  return new AlpacaTradeEndpoint(
    apiClient,
    { ...defaultConfig, ...config },
  )
}

/**
 * Factory function to create a TradingClient optimized for high-frequency trading
 *
 * @param {AlpacaMarketClient} apiClient - The Alpaca API client instance
 * @param {TradingClientConfig} [config] - Optional configuration for the trading client
 * @returns {AlpacaTradeEndpoint} - An instance of the trading client optimized for high-frequency trading
 */
export const createHighFrequencyTradingClient = (
  apiClient: AlpacaMarketClient,
  config?: TradingClientConfig,
): AlpacaTradeEndpoint => {
  const hftConfig: TradingClientConfig = {
    cacheConfig: {
      enabled: true,
      maxSize: 2000,
      defaultTtlMs: 60000, // 1 minute for faster updates
    },
    circuitBreakerConfig: {
      failureThreshold: 2,
      timeoutMs: 5000,
      recoveryTimeoutMs: 10000,
      halfOpenMaxAttempts: 2,
      resetTimeoutMs: 120000,
    },
  }

  return new AlpacaTradeEndpoint(
    apiClient,
    { ...hftConfig, ...config },
  )
}

/**
 * Factory function to create a TradingClient optimized for conservative trading
 *
 * @param {AlpacaMarketClient} apiClient - The Alpaca API client instance
 * @param {TradingClientConfig} [config] - Optional configuration for the trading client
 * @return {AlpacaTradeEndpoint} - An instance of the trading client optimized for conservative trading
 */
export const createConservativeTradingClient = (
  apiClient: AlpacaMarketClient,
  config?: TradingClientConfig,
): AlpacaTradeEndpoint => {
  const conservativeConfig: TradingClientConfig = {
    cacheConfig: {
      enabled: true,
      maxSize: 500,
      defaultTtlMs: 600000, // 10 minutes for longer caching
    },
    circuitBreakerConfig: {
      failureThreshold: 5,
      timeoutMs: 15000, // 15 seconds
      recoveryTimeoutMs: 60000, // 1 minute
      halfOpenMaxAttempts: 1,
      resetTimeoutMs: 600000, // 10 minutes
    },
  }

  return new AlpacaTradeEndpoint(
    apiClient,
    { ...conservativeConfig, ...config },
  )
}
