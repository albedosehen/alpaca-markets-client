/**
 * Alpaca Markets Client Module
 * Provides a unified interface for accessing Alpaca's Market Data, Trading, and Streaming APIs.
 * This module includes factory functions for creating clients with default configurations,
 * as well as utility functions for handling authentication, environment detection, and credential management.
 * @module
 */
export { AlpacaMarketClient } from './alpaca.ts'
export {
  ALPACA_ENVIRONMENT,
  type AlpacaAuthCredentials,
  type AlpacaCacheConfig,
  type AlpacaClientConfig,
  type AlpacaEnvironment,
  type AlpacaMappingConfig,
  type AlpacaStreamingConfig,
  type AlpacaTradingClientConfig,
  createDefaultAlpacaConfig,
} from './alpaca.types.ts'

export {
  type AlpacaEnvironmentType,
  createAuthHeaders,
  getAllAvailableCredentials,
  getCredentialAvailability,
  getCredentialsForEnvironment,
  getCredentialsWithAutoDetection,
  getEnvironmentVariableNames,
  hasLikelyMarketDataAccess,
  isLiveCredentials,
  isPaperCredentials,
  validateCredentials,
} from './alpaca-credential-helpers.ts'
