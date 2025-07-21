/**
 * Helpers for Alpaca Credential Management
 * Provides functions to retrieve, validate, and manage Alpaca API credentials
 * for different environments (paper and live). This includes functions for
 * auto-detection of credentials, checking availability, and creating authorization headers.
 * @module
 */
import { AlpacaMarketError } from '../errors/errors.ts'
import type { AlpacaAuthCredentials } from './alpaca.types.ts'

export type AlpacaEnvironmentType = 'paper' | 'live'

/**
 * Environment variable mapping for different Alpaca environments
 */
const CREDENTIAL_ENV_MAP = {
  paper: {
    apiKey: 'APCA_API_PAPER_KEY',
    secretKey: 'APCA_API_PAPER_SECRET_KEY',
  },
  live: {
    apiKey: 'APCA_API_LIVE_KEY',
    secretKey: 'APCA_API_LIVE_SECRET',
  },
} as const

/**
 * Fallback environment variables for backwards compatibility
 */
const FALLBACK_ENV_MAP = {
  apiKey: 'APCA_API_KEY',
  secretKey: 'APCA_API_SECRET_KEY',
} as const

/**
 * Get credentials for a specific environment from environment variables
 *
 * This function retrieves Alpaca API credentials for the specified environment (paper or live)
 * from environment variables. It first attempts to use environment-specific variables,
 * then falls back to generic variables for backwards compatibility.
 *
 * @param {AlpacaEnvironmentType} environment - The Alpaca environment ('paper' or 'live')
 * @returns {AlpacaAuthCredentials} The validated credentials for the specified environment
 * @throws {AlpacaMarketError} Throws an error if required environment variables are missing or credentials are invalid
 *
 * @example
 * ```typescript
 * // Get paper trading credentials
 * const paperCreds = getCredentialsForEnvironment('paper');
 * console.log(paperCreds); // { apiKey: 'PK...', secretKey: '...' }
 *
 * // Get live trading credentials
 * const liveCreds = getCredentialsForEnvironment('live');
 * console.log(liveCreds); // { apiKey: 'AK...', secretKey: '...' }
 * ```
 */
export function getCredentialsForEnvironment(
  environment: AlpacaEnvironmentType,
): AlpacaAuthCredentials {
  const envMap = CREDENTIAL_ENV_MAP[environment]

  // Try environment-specific variables first
  let apiKey = Deno.env.get(envMap.apiKey)
  let secretKey = Deno.env.get(envMap.secretKey)

  // Fallback to generic variables if environment-specific ones are not found
  if (!apiKey || !secretKey) {
    const fallbackApiKey = Deno.env.get(FALLBACK_ENV_MAP.apiKey)
    const fallbackSecretKey = Deno.env.get(FALLBACK_ENV_MAP.secretKey)

    // Only use fallback if both are available
    if (fallbackApiKey && fallbackSecretKey) {
      apiKey = fallbackApiKey
      secretKey = fallbackSecretKey
    }
  }

  if (!apiKey) {
    throw new AlpacaMarketError(
      `Missing API key for ${environment} environment. ` +
        `Please set ${envMap.apiKey} or ${FALLBACK_ENV_MAP.apiKey} environment variable.`,
      { category: 'configuration' },
    )
  }

  if (!secretKey) {
    throw new AlpacaMarketError(
      `Missing secret key for ${environment} environment. ` +
        `Please set ${envMap.secretKey} or ${FALLBACK_ENV_MAP.secretKey} environment variable.`,
      { category: 'configuration' },
    )
  }

  const credentials: AlpacaAuthCredentials = { apiKey, secretKey }

  // Validate credentials
  return validateCredentials(credentials)
}

/**
 * Get all available credentials (both paper and live) with their status
 *
 * This function attempts to retrieve credentials for both paper and live environments,
 * returning available credentials along with any errors encountered during retrieval.
 * This is useful for determining which environments are properly configured.
 *
 * @returns {Object} An object containing available credentials and any errors
 * @returns {AlpacaAuthCredentials} [returns.paper] - Paper trading credentials if available
 * @returns {AlpacaAuthCredentials} [returns.live] - Live trading credentials if available
 * @returns {AlpacaMarketError} [returns.paperError] - Error encountered when retrieving paper credentials
 * @returns {AlpacaMarketError} [returns.liveError] - Error encountered when retrieving live credentials
 *
 * @example
 * ```typescript
 * const allCreds = getAllAvailableCredentials();
 *
 * if (allCreds.paper) {
 *   console.log('Paper trading is available');
 * } else if (allCreds.paperError) {
 *   console.log('Paper trading error:', allCreds.paperError.message);
 * }
 *
 * if (allCreds.live) {
 *   console.log('Live trading is available');
 * } else if (allCreds.liveError) {
 *   console.log('Live trading error:', allCreds.liveError.message);
 * }
 * ```
 */
export function getAllAvailableCredentials(): {
  paper?: AlpacaAuthCredentials
  live?: AlpacaAuthCredentials
  paperError?: AlpacaMarketError
  liveError?: AlpacaMarketError
} {
  const result: {
    paper?: AlpacaAuthCredentials
    live?: AlpacaAuthCredentials
    paperError?: AlpacaMarketError
    liveError?: AlpacaMarketError
  } = {}

  try {
    result.paper = getCredentialsForEnvironment('paper')
  } catch (error) {
    result.paperError = error instanceof AlpacaMarketError ? error : new AlpacaMarketError(String(error))
  }

  try {
    result.live = getCredentialsForEnvironment('live')
  } catch (error) {
    result.liveError = error instanceof AlpacaMarketError ? error : new AlpacaMarketError(String(error))
  }

  return result
}

/**
 * Check which credentials are available
 *
 * This function provides a simple boolean check for credential availability
 * across different environments. It's useful for quickly determining which
 * trading environments are properly configured without handling specific errors.
 *
 * @returns {Object} An object indicating credential availability status
 * @returns {boolean} returns.paper - Whether paper trading credentials are available
 * @returns {boolean} returns.live - Whether live trading credentials are available
 * @returns {boolean} returns.hasAny - Whether any credentials (paper or live) are available
 *
 * @example
 * ```typescript
 * const availability = getCredentialAvailability();
 *
 * if (availability.hasAny) {
 *   console.log('At least one environment is configured');
 *
 *   if (availability.paper) {
 *     console.log('Paper trading is available');
 *   }
 *
 *   if (availability.live) {
 *     console.log('Live trading is available');
 *   }
 * } else {
 *   console.log('No credentials are configured');
 * }
 * ```
 */
export function getCredentialAvailability(): {
  paper: boolean
  live: boolean
  hasAny: boolean
} {
  const availability = getAllAvailableCredentials()
  const paper = !!availability.paper
  const live = !!availability.live

  return {
    paper,
    live,
    hasAny: paper || live,
  }
}

/**
 * Get credentials with environment auto-detection based on API key format
 *
 * This function automatically detects and returns the first available credentials,
 * prioritizing paper trading credentials over live credentials. It's useful when you
 * want to automatically use whatever credentials are available without specifying
 * the environment explicitly.
 *
 * @returns {Object} An object containing the detected credentials and environment
 * @returns {AlpacaAuthCredentials} returns.credentials - The detected credentials
 * @returns {AlpacaEnvironmentType} returns.detectedEnvironment - The detected environment ('paper' or 'live')
 * @throws {AlpacaMarketError} Throws an error if no valid credentials are found for any environment
 *
 * @example
 * ```typescript
 * try {
 *   const { credentials, detectedEnvironment } = getCredentialsWithAutoDetection();
 *
 *   console.log(`Using ${detectedEnvironment} environment`);
 *   console.log('API Key:', credentials.apiKey.substring(0, 8) + '...');
 *
 *   // Use the detected credentials
 *   const client = new AlpacaMarketClient({
 *     ...credentials,
 *     environment: detectedEnvironment
 *   });
 * } catch (error) {
 *   console.error('No valid credentials found:', error.message);
 * }
 * ```
 */
export function getCredentialsWithAutoDetection(): {
  credentials: AlpacaAuthCredentials
  detectedEnvironment: AlpacaEnvironmentType
} {
  const availability = getAllAvailableCredentials()

  // Try paper first if available
  if (availability.paper) {
    return {
      credentials: availability.paper,
      detectedEnvironment: 'paper',
    }
  }

  // Try live if available
  if (availability.live) {
    return {
      credentials: availability.live,
      detectedEnvironment: 'live',
    }
  }

  // No credentials available
  throw new AlpacaMarketError(
    'No valid Alpaca credentials found. Please set either:\n' +
      '- Paper trading: APCA_API_PAPER_KEY and APCA_API_PAPER_SECRET_KEY\n' +
      '- Live trading: APCA_API_LIVE_KEY and APCA_API_LIVE_SECRET\n' +
      '- Or fallback: APCA_API_KEY and APCA_API_SECRET_KEY',
    { category: 'configuration' },
  )
}

/**
 * Determine if market data access is likely available for given credentials
 *
 * This function provides a heuristic check for market data access based on the API key format.
 * Paper trading accounts typically don't have market data access, while live accounts may have
 * market data access depending on their subscription plan. This is a best-effort detection
 * and actual market data access should be verified through API calls.
 *
 * @param {AlpacaAuthCredentials} credentials - The credentials to check for market data access
 * @returns {boolean} True if market data access is likely available, false otherwise
 *
 * @example
 * ```typescript
 * const paperCreds = { apiKey: 'PK...', secretKey: '...' };
 * const liveCreds = { apiKey: 'AK...', secretKey: '...' };
 *
 * console.log(hasLikelyMarketDataAccess(paperCreds)); // false - paper accounts typically don't have market data
 * console.log(hasLikelyMarketDataAccess(liveCreds));  // true - live accounts may have market data
 *
 * // Use for conditional logic
 * if (hasLikelyMarketDataAccess(credentials)) {
 *   console.log('Market data features may be available');
 * } else {
 *   console.log('Market data access may be limited');
 * }
 * ```
 */
export function hasLikelyMarketDataAccess(credentials: AlpacaAuthCredentials): boolean {
  // Paper trading accounts typically don't have market data access
  // Live accounts may have market data access depending on subscription
  const isPaper = credentials.apiKey.startsWith('PK') || credentials.apiKey.startsWith('PAPER')
  return !isPaper
}

/**
 * Get environment variable names for a specific environment
 *
 * This function returns the expected environment variable names for API credentials
 * based on the specified environment. This is useful for documentation, error messages,
 * or when you need to programmatically reference the correct environment variable names.
 *
 * @param {AlpacaEnvironmentType} environment - The Alpaca environment ('paper' or 'live')
 * @returns {Object} An object containing the environment variable names
 * @returns {string} returns.apiKey - The environment variable name for the API key
 * @returns {string} returns.secretKey - The environment variable name for the secret key
 *
 * @example
 * ```typescript
 * const paperVars = getEnvironmentVariableNames('paper');
 * console.log(paperVars);
 * // { apiKey: 'APCA_API_PAPER_KEY', secretKey: 'APCA_API_PAPER_SECRET_KEY' }
 *
 * const liveVars = getEnvironmentVariableNames('live');
 * console.log(liveVars);
 * // { apiKey: 'APCA_API_LIVE_KEY', secretKey: 'APCA_API_LIVE_SECRET' }
 *
 * // Use for error messages or documentation
 * const envVars = getEnvironmentVariableNames('paper');
 * console.log(`Please set ${envVars.apiKey} and ${envVars.secretKey}`);
 * ```
 */
export function getEnvironmentVariableNames(environment: AlpacaEnvironmentType): {
  apiKey: string
  secretKey: string
} {
  return CREDENTIAL_ENV_MAP[environment]
}

/**
 * Validate Alpaca API credentials
 *
 * This function performs basic validation on Alpaca API credentials to ensure they
 * meet minimum requirements. It checks for the presence of both API key and secret key,
 * and validates that they meet minimum length requirements to catch obvious errors
 * before making API calls.
 *
 * @param {AlpacaAuthCredentials} credentials - The credentials object to validate
 * @returns {AlpacaAuthCredentials} The same credentials object if validation passes
 * @throws {AlpacaMarketError} Throws an error if API key is missing, empty, or too short
 * @throws {AlpacaMarketError} Throws an error if secret key is missing, empty, or too short
 *
 * @example Basic validation
 * ```typescript
 * try {
 *   const validCreds = validateCredentials({
 *     apiKey: 'PKTEST12345678',
 *     secretKey: 'abcdefghijklmnopqrstuvwxyz123456'
 *   });
 *   console.log('Credentials are valid');
 * } catch (error) {
 *   console.error('Invalid credentials:', error.message);
 * }
 * ```
 *
 * @example Handling validation errors
 * ```typescript
 * const invalidCreds = { apiKey: '', secretKey: 'short' };
 *
 * try {
 *   validateCredentials(invalidCreds);
 * } catch (error) {
 *   if (error instanceof AlpacaMarketError) {
 *     console.error('Validation failed:', error.message);
 *     console.error('Category:', error.context?.category);
 *   }
 * }
 * ```
 */
export function validateCredentials(credentials: AlpacaAuthCredentials): AlpacaAuthCredentials {
  if (!credentials.apiKey) {
    throw new AlpacaMarketError('API key is required', { category: 'validation' })
  }

  if (!credentials.secretKey) {
    throw new AlpacaMarketError('Secret key is required', { category: 'validation' })
  }

  if (credentials.apiKey.length < 10) {
    throw new AlpacaMarketError('API key appears to be invalid (too short)', { category: 'validation' })
  }

  if (credentials.secretKey.length < 10) {
    throw new AlpacaMarketError('Secret key appears to be invalid (too short)', { category: 'validation' })
  }

  return credentials
}

/**
 * Create authorization headers for Alpaca API requests
 *
 * This function creates the required HTTP headers for authenticating with the Alpaca API.
 * It converts the API credentials into the specific header format expected by Alpaca's
 * REST API endpoints.
 *
 * @param {AlpacaAuthCredentials} credentials - The API credentials to convert to headers
 * @returns {Record<string, string>} An object containing the required authorization headers
 *
 * @example
 * ```typescript
 * const credentials = {
 *   apiKey: 'PKTEST12345678',
 *   secretKey: 'abcdefghijklmnopqrstuvwxyz123456'
 * };
 *
 * const headers = createAuthHeaders(credentials);
 * console.log(headers);
 * // {
 * //   'APCA-API-KEY-ID': 'PKTEST12345678',
 * //   'APCA-API-SECRET-KEY': 'abcdefghijklmnopqrstuvwxyz123456'
 * // }
 *
 * // Use with fetch or other HTTP clients
 * const response = await fetch('https://api.alpaca.markets/v2/account', {
 *   headers: {
 *     ...createAuthHeaders(credentials),
 *     'Content-Type': 'application/json'
 *   }
 * });
 * ```
 */
export function createAuthHeaders(credentials: AlpacaAuthCredentials): Record<string, string> {
  return {
    'APCA-API-KEY-ID': credentials.apiKey,
    'APCA-API-SECRET-KEY': credentials.secretKey,
  }
}

/**
 * Check if credentials are for paper trading environment
 *
 * This function determines if the provided credentials are for paper trading
 * by examining the API key format. Paper trading API keys typically start with
 * 'PK' or 'PAPER' prefixes.
 *
 * @param {AlpacaAuthCredentials} credentials - The credentials to check
 * @returns {boolean} True if the credentials are for paper trading, false otherwise
 *
 * @example
 * ```typescript
 * const paperCreds = { apiKey: 'PKTEST12345678', secretKey: '...' };
 * const liveCreds = { apiKey: 'AKTEST12345678', secretKey: '...' };
 *
 * console.log(isPaperCredentials(paperCreds)); // true
 * console.log(isPaperCredentials(liveCreds));  // false
 *
 * // Use for conditional logic
 * if (isPaperCredentials(credentials)) {
 *   console.log('Using paper trading environment');
 * } else {
 *   console.log('Using live trading environment');
 * }
 * ```
 */
export function isPaperCredentials(credentials: AlpacaAuthCredentials): boolean {
  return credentials.apiKey.startsWith('PK') || credentials.apiKey.startsWith('PAPER')
}

/**
 * Check if credentials are for live trading environment
 *
 * This function determines if the provided credentials are for live trading
 * by checking if they are NOT paper trading credentials. Live trading credentials
 * typically use API keys that don't start with 'PK' or 'PAPER' prefixes.
 *
 * @param {AlpacaAuthCredentials} credentials - The credentials to check
 * @returns {boolean} True if the credentials are for live trading, false otherwise
 *
 * @example
 * ```typescript
 * const paperCreds = { apiKey: 'PKTEST12345678', secretKey: '...' };
 * const liveCreds = { apiKey: 'AKTEST12345678', secretKey: '...' };
 *
 * console.log(isLiveCredentials(paperCreds)); // false
 * console.log(isLiveCredentials(liveCreds));  // true
 *
 * // Use for conditional logic
 * if (isLiveCredentials(credentials)) {
 *   console.warn('WARNING: Using live trading environment with real money!');
 * } else {
 *   console.log('Using paper trading environment (safe for testing)');
 * }
 * ```
 */
export function isLiveCredentials(credentials: AlpacaAuthCredentials): boolean {
  return !isPaperCredentials(credentials)
}
