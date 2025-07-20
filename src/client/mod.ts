/**
 * The main Alpaca Market Client
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
