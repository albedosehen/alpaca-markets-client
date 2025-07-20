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
 */
export function hasLikelyMarketDataAccess(credentials: AlpacaAuthCredentials): boolean {
  // Paper trading accounts typically don't have market data access
  // Live accounts may have market data access depending on subscription
  const isPaper = credentials.apiKey.startsWith('PK') || credentials.apiKey.startsWith('PAPER')
  return !isPaper
}

/**
 * Get environment variable names for a specific environment
 */
export function getEnvironmentVariableNames(environment: AlpacaEnvironmentType): {
  apiKey: string
  secretKey: string
} {
  return CREDENTIAL_ENV_MAP[environment]
}

/**
 * Validate Alpaca API credentials
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
 */
export function createAuthHeaders(credentials: AlpacaAuthCredentials): Record<string, string> {
  return {
    'APCA-API-KEY-ID': credentials.apiKey,
    'APCA-API-SECRET-KEY': credentials.secretKey,
  }
}

/**
 * Check if credentials are for paper trading environment
 */
export function isPaperCredentials(credentials: AlpacaAuthCredentials): boolean {
  return credentials.apiKey.startsWith('PK') || credentials.apiKey.startsWith('PAPER')
}

/**
 * Check if credentials are for live trading environment
 */
export function isLiveCredentials(credentials: AlpacaAuthCredentials): boolean {
  return !isPaperCredentials(credentials)
}
