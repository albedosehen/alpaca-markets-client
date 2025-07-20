# Alpaca Markets Client 🦙

---

**A client library for the Alpaca Markets API, providing access to trading, market data, and account management functionalities.**

## Features

- **TypeScript First** - Designed for Deno with first-class TypeScript support.
- **Trading Operations** - Full support for orders, positions, and account management.
- **Market Data Access** - Real-time and historical market data with enhanced metadata.
- **WebSocket Streaming** - Live market data stream client with automatic reconnection support.
- **High-Frequency Trading Support** - Specialized client for high-frequency trading applications.
- **Reliable & Performant** - Request deduplication, caching, rate-limiting, circuit breaker configuration, and connection pooling for high reliability.

## Installation

```typescript
import { AlpacaClient, createDefaultAlpacaConfig } from "jsr:@albedosehen/alpaca-markets-client"
```

## Quick Start

### Basic Setup

```typescript
import { AlpacaClient, createDefaultAlpacaConfig } from "jsr:@albedosehen/alpaca-markets-client"

// Create configuration for paper trading
const config = createDefaultAlpacaConfig({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key'
}, 'paper')

// Initialize client
const client = new AlpacaClient(config)
```

### Trading Operations

Use the `AlpacaTradingEndpoint` to manage your trading operations:

```typescript
// Get account information
try {
  const account = await client.trading.getAccount()
  console.log(`Account equity: $${account.equity}`)
} catch (error) {
  console.error('Failed to get account:', error.message)
}

// Create a market order
try {
  const order = await client.trading.createOrder({
    symbol: 'NVDA',
    qty: '1',
    side: 'buy',
    type: 'market',
    time_in_force: 'day'
  })
  console.log(`Order created: ${order.id}`)
} catch (error) {
  console.error('Failed to create order:', error.message)
}

// Get positions
try {
  const positions = await client.trading.getPositions()
  positions.forEach(position => {
    console.log(`${position.symbol}: ${position.qty} shares`)
  })
} catch (error) {
  console.error('Failed to get positions:', error.message)
}
```

### Market Data Access

Easily access real-time and historical market data with `AlpacaMarketDataEndpoint`:

```typescript
// Get latest market data for multiple symbols
try {
  const bars = await client.market.getLatestBars({
    symbols: ['NVDA', 'MSFT']
  })

  Object.entries(bars).forEach(([symbol, bar]) => {
    console.log(`${symbol}: $${bar.close} (${bar.timestamp})`)
  })
} catch (error) {
  console.error('Failed to get market data:', error.message)
}

// Get historical data with enhanced metadata
try {
  const trades = await client.market.getTradesEnhanced({
    symbols: ['NVDA'],
    start: '2024-01-01',
    end: '2024-01-02'
  })

  trades.data['NVDA']?.forEach(trade => {
    console.log(`Trade: $${trade.price} at ${trade.exchangeName || trade.exchange}`)
    if (trade.conditionNames?.length) {
      console.log(`Conditions: ${trade.conditionNames.join(', ')}`)
    }
  })
} catch (error) {
  console.error('Failed to get enhanced trades:', error.message)
}
```

### WebSocket Streaming

The `AlpacaStreamingClient` allows you to connect to real-time market data streams. You can subscribe to trades, quotes, bars, and more.

```typescript
try {
  // Connect to streaming
  await client.connectToStream()

  // Subscribe to real-time trades
  await client.stream.subscribe({
    type: 'trades',
    symbols: ['NVDA', 'MSFT']
  })

  console.log('Streaming connected and subscribed')
} catch (error) {
  console.error('Streaming failed:', error.message)
} finally {
  // Clean disconnect
  await client.disconnectFromStream()
}
```

## Advanced Configuration

### High-Frequency Trading Setup

For high-frequency trading applications, you can create a specialized client with advanced configurations like caching, circuit breakers, and rate limiting:

```typescript
import { createHighFrequencyTradingClient } from "jsr:@albedosehen/alpaca-markets-client"

const hftClient = createHighFrequencyTradingClient(
  client,
  {
    cacheConfig: { enabled: true, defaultTtlMs: 30000 },
    circuitBreakerConfig: { failureThreshold: 2, timeoutMs: 5000 },
    rateLimiterConfig: { requestsPerSecond: 200 }
  }
)
```

### Custom Configuration

Creating a custom configuration is easy with the `createDefaultAlpacaConfig` function. You can specify your API keys, environment (paper or live), and additional options like caching, circuit breakers, and streaming settings.

```typescript
const advancedConfig = createDefaultAlpacaConfig({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key'
}, 'paper', {
  trading: {
    enabled: true,
    cacheConfig: { enabled: true, defaultTtlMs: 60000 },
    circuitBreakerConfig: { failureThreshold: 5, timeoutMs: 15000 }
  },
  streaming: {
    enabled: true,
    autoConnect: true,
    eventHandlers: {
      onMessage: (msg) => console.log('Market update:', msg),
      onError: (err) => console.error('Stream error:', err),
      onConnect: () => console.log('Streaming connected'),
      onDisconnect: () => console.log('Streaming disconnected')
    }
  }
})

const client = new AlpacaClient(advancedConfig)
```

## Error Handling

The client provides enhanced error handling with categorized errors and operational context:

```typescript
import { AlpacaError, ErrorEnrichment } from "jsr:@albedosehen/alpaca-markets-client"

try {
  const account = await client.trading.getAccount()
} catch (error) {
  if (error instanceof AlpacaError) {
    console.log(`Error category: ${error.category}`)
    console.log(`Is retryable: ${error.isRetryable}`)
    console.log(`Status: ${error.status}`)

    // Handle specific error categories
    switch (error.category) {
      case 'rate_limit':
        console.log(`Rate limit reset: ${error.rateLimitReset}`)
        break
      case 'network':
        console.log('Network error - consider retry')
        break
      case 'authentication':
        console.log('Check your API credentials')
        break
    }
  }
}
```

## Validation and Assertions

The client includes a robust validation system:

```typescript
import { assert } from "jsr:@albedosehen/alpaca-markets-client"

// Validation with descriptive errors
try {
  assert(qty > 0, 'Quantity must be positive', {
    field: 'qty',
    received: qty,
    expected: 'positive number'
  })

  assert(symbols.length <= 100, 'Too many symbols requested', {
    field: 'symbols',
    received: symbols.length,
    expected: 'maximum 100 symbols'
  })
} catch (error) {
  console.error('Validation failed:', error.message)
  console.error('Context:', error.context)
}
```

## Environment Configuration

Set up environment variables for easy credential management:

```bash
# Paper Trading
export APCA_API_PAPER_KEY="your-paper-api-key"
export APCA_API_PAPER_SECRET_KEY="your-paper-secret-key"

# Live Trading
export APCA_API_LIVE_KEY="your-live-api-key"
export APCA_API_LIVE_SECRET="your-live-secret-key"
```

```typescript
import { getCredentialsWithAutoDetection } from "jsr:@albedosehen/alpaca-markets-client"

// Automatically detect and load credentials
try {
  const { credentials, detectedEnvironment } = getCredentialsWithAutoDetection()
  console.log(`Using ${detectedEnvironment} credentials`)

  const config = createDefaultAlpacaConfig(credentials, detectedEnvironment)
  const client = new AlpacaClient(config)
} catch (error) {
  console.error('Failed to load credentials:', error.message)
}
```

## Reliability and Performance

### Circuit Breaker Pattern

Use a circuit breaker to prevent cascading failures in your application:

```typescript
import { CircuitBreaker } from "jsr:@albedosehen/alpaca-markets-client"

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  timeoutMs: 30000,
  resetTimeoutMs: 60000
}, logger)

// Execute with circuit breaker protection
try {
  await circuitBreaker.execute(() => client.trading.getAccount())
} catch (error) {
  console.error('Circuit breaker activated:', error.message)
}
```

### Request Deduplication

Deduplicate your requests to Alpaca Markets to avoid unnecessary API calls and remain within your rate limits:

```typescript
import { RequestDeduplicator } from "jsr:@albedosehen/alpaca-markets-client"

const deduplicator = new RequestDeduplicator({
  windowMs: 1000,
  maxConcurrent: 10
}, logger)

// Automatic deduplication of identical requests
const result = await deduplicator.execute(
  'getAccount',
  () => client.trading.getAccount()
)
```

### Caching

The cache system allows you to cache expensive operations and reduce API calls easily with a simple API:

```typescript
import { CacheFactory } from "jsr:@albedosehen/alpaca-markets-client"

const cache = CacheFactory.create(logger, {
  defaultTtlMs: 300000, // 5 minutes
  maxSize: 1000
})

// Cache expensive operations
const cachedAccount = cache.get('account')
if (!cachedAccount) {
  const account = await client.trading.getAccount()
  cache.set('account', account)
}
```

## TypeScript Support

I chose Deno for default TypeScript support. So if you use Deno, you're good to go. I don't currently have any plans to support NPM/Node.js.

```typescript
import type {
  Account,
  Order,
  Position,
  Bar,
  Trade,
  Quote,
  AlpacaClientConfig,
  CreateOrderRequest
} from "jsr:@albedosehen/alpaca-markets-client"

// Type-safe order creation
const orderRequest: CreateOrderRequest = {
  symbol: 'NVDA',
  qty: '10',
  side: 'buy',
  type: 'limit',
  time_in_force: 'day',
  limit_price: '150.00'
}

const order: Order = await client.trading.createOrder(orderRequest)
```

## Support

This client is provided as-is. For support, please open an issue on GitHub. You assume all risks associated with using this library, including any financial risks related to trading operations.

---

## Contributing & Development

Contributions are welcome! If you find a bug or have a feature request, please open an issue on GitHub. Pull requests are also welcome!

### License

MIT License - see [LICENSE](LICENSE) for details.

---

[![Build Status](https://img.shields.io/badge/Build-passing-brightgreen.svg)](https://github.com/albedosehen/stoat) [![Deno Version](https://img.shields.io/badge/Deno-v2.4.1-green)](https://deno.land/x/stoat@v1.0.0) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
