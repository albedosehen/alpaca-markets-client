import { assertEquals, assertExists } from '@std/assert'
import { MappingService } from '../../services/mapping.service.ts'
import { MetadataCache } from '../../services/metadata-cache.service.ts'
import type { TradeRaw } from '../../types/trade.ts'

// TODO(@albedosehen): Convert this to use describe/it testing convention.
Deno.test('MappingService - Basic Enhanced Trade', async () => {
  const metadataCacheConfig = {
    ttlMs: 60000,
    useFallbackDefaults: true,
    maxRetries: 3,
  }
  const metadataCache = new MetadataCache(metadataCacheConfig)
  const mappingServiceConfig = {
    defaultEnhancementConfig: {
      includeExchangeNames: true,
      includeTapeDescriptions: true,
      includeConditionNames: true,
      includeConditionDescriptions: false,
      includeMappingStatus: false,
      logUnmappedCodes: false,
    },
    validateOutput: true,
    cacheEnhancements: false,
  }
  const mappingService = new MappingService(metadataCache, mappingServiceConfig)

  const tradeData = {
    timestamp: new Date('2024-01-01T10:00:00Z'),
    exchange: 'N',
    price: 150.25,
    size: 100,
    conditions: ['@', 'F'],
    tradeId: 12345,
    tape: 'A',
    symbol: 'NVDA',
  }

  const enhanced = await mappingService.enhanceTrade(tradeData)

  assertEquals(enhanced.symbol, 'NVDA')
  assertEquals(enhanced.price, 150.25)
  assertEquals(enhanced.size, 100)
  assertExists(enhanced.hasMappings)

  console.log('Enhanced trade:', enhanced)
})

Deno.test('MappingService - Batched Enhanced Trades', async () => {
  const metadataCacheConfig = {
    ttlMs: 60000,
    useFallbackDefaults: true,
    maxRetries: 3,
  }
  const metadataCache = new MetadataCache(metadataCacheConfig)
  const mappingServiceConfig = {
    defaultEnhancementConfig: {
      includeExchangeNames: true,
      includeTapeDescriptions: true,
      includeConditionNames: true,
      includeConditionDescriptions: false,
      includeMappingStatus: false,
      logUnmappedCodes: false,
    },
    validateOutput: true,
    cacheEnhancements: false,
  }
  const mappingService = new MappingService(metadataCache, mappingServiceConfig)

  const sampleTrades = [
    {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      exchange: 'N',
      price: 150.25,
      size: 100,
      conditions: ['@'],
      tradeId: 12345,
      tape: 'A',
      symbol: 'NVDA',
    },
    {
      timestamp: new Date('2024-01-01T10:01:00Z'),
      exchange: 'Q',
      price: 75.50,
      size: 200,
      conditions: ['F'],
      tradeId: 12346,
      tape: 'A',
      symbol: 'MSFT',
    },
  ]

  const enhanced = await mappingService.enhanceTrades(sampleTrades)

  assertEquals(enhanced.length, 2)
  assertEquals(enhanced[0].symbol, 'NVDA')
  assertEquals(enhanced[1].symbol, 'MSFT')

  console.log('Enhanced trades:', enhanced)
})

Deno.test('MappingService - Enhanced Trade Mapping', async () => {
  const metadataCacheConfig = {
    ttlMs: 60000,
    useFallbackDefaults: true,
    maxRetries: 3,
  }
  const metadataCache = new MetadataCache(metadataCacheConfig)
  const mappingServiceConfig = {
    defaultEnhancementConfig: {
      includeExchangeNames: true,
      includeTapeDescriptions: true,
      includeConditionNames: true,
      includeConditionDescriptions: false,
      includeMappingStatus: false,
      logUnmappedCodes: false,
    },
    validateOutput: true,
    cacheEnhancements: false,
  }
  const mappingService = new MappingService(metadataCache, mappingServiceConfig)

  const rawTrade: TradeRaw = {
    t: '2024-01-01T10:00:00Z',
    x: 'N',
    p: 150.25,
    s: 100,
    c: ['@', 'F'],
    i: 12345,
    z: 'A',
  }

  // Convert raw trade to basic trade first
  const basicTrade = {
    timestamp: new Date(rawTrade.t),
    exchange: rawTrade.x,
    price: rawTrade.p,
    size: rawTrade.s,
    conditions: rawTrade.c,
    tradeId: rawTrade.i,
    tape: rawTrade.z,
    symbol: 'NVDA',
  }

  const enhanced = await mappingService.enhanceTrade(basicTrade)

  assertEquals(enhanced.symbol, 'NVDA')
  assertEquals(enhanced.price, 150.25)
  assertEquals(enhanced.exchange, 'N')
  assertEquals(enhanced.tape, 'A')
  assertExists(enhanced.hasMappings)

  console.log('Mapped enhanced trade:', enhanced)
})

Deno.test('MappingService - Cache Statistics', () => {
  const metadataCacheConfig = {
    ttlMs: 60000,
    useFallbackDefaults: true,
    maxRetries: 3,
  }
  const metadataCache = new MetadataCache(metadataCacheConfig)
  const mappingServiceConfig = {
    defaultEnhancementConfig: {
      includeExchangeNames: true,
      includeTapeDescriptions: true,
      includeConditionNames: true,
      includeConditionDescriptions: false,
      includeMappingStatus: false,
      logUnmappedCodes: false,
    },
    validateOutput: true,
    cacheEnhancements: false,
  }
  const mappingService = new MappingService(metadataCache, mappingServiceConfig)

  const stats = mappingService.getCacheStats()
  assertExists(stats)
  assertEquals(stats.size, 0) // Initially empty
  assertExists(stats.keys)

  console.log('Cache stats:', stats)
})
