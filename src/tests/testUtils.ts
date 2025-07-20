/**
 * Test utilities for Alpaca Markets API tests
 * Provides comprehensive mock/spy cleanup, timer management, and test isolation
 */

import { restore, type Spy, spy, stub } from '@std/testing/mock'

// Global test state tracking
interface TestState {
  spies: Set<unknown>
  stubs: Set<unknown>
  timers: Set<number>
  intervals: Set<number>
  timeouts: Set<number>
  mockObjects: Set<MockObject>
  asyncOperations: Set<Promise<unknown>>
}

interface MockObject {
  reset: () => void
  destroy?: () => void
}

// Global test state
const globalTestState: TestState = {
  spies: new Set(),
  stubs: new Set(),
  timers: new Set(),
  intervals: new Set(),
  timeouts: new Set(),
  mockObjects: new Set(),
  asyncOperations: new Set(),
}

/**
 * Test global spy
 */
export function createTrackedSpy<T = unknown, A extends unknown[] = unknown[], R = unknown>(
  func?: (this: T, ...args: A) => R,
): Spy<T, A, R> {
  const spyInstance = func ? spy(func) : spy() as Spy<T, A, R>
  globalTestState.spies.add(spyInstance as unknown)
  return spyInstance
}

/**
 * Test global stub
 */
export function createTrackedStub<T, P extends keyof T>(
  object: T,
  property: P,
  func?: unknown,
): unknown {
  const stubInstance = func ? stub(object, property, func as never) : stub(object, property)
  globalTestState.stubs.add(stubInstance as unknown)
  return stubInstance
}

/**
 * Test global timeout
 */
export function createTrackedTimer(callback: () => void, delay: number): number {
  const timerId = setTimeout(() => {
    globalTestState.timers.delete(timerId)
    callback()
  }, delay)
  globalTestState.timers.add(timerId)
  return timerId
}

/**
 * Test global interval
 */
export function createTrackedInterval(callback: () => void, delay: number): number {
  const intervalId = setInterval(callback, delay)
  globalTestState.intervals.add(intervalId)
  return intervalId
}

/**
 * Test global timeout
 */
export function trackAsyncOperation<T>(promise: Promise<T>): Promise<T> {
  globalTestState.asyncOperations.add(promise)
  return promise.finally(() => {
    globalTestState.asyncOperations.delete(promise)
  })
}

/**
 * AlpacaMarketClient mock implementation
 */
export class MockAlpacaMarketClient implements MockObject {
  public request = createTrackedSpy((_endpoint: string, _options?: unknown): Promise<unknown> => Promise.resolve({}))
  public getConfig = createTrackedSpy(() => ({ timeout: 30000 }))

  constructor() {
    globalTestState.mockObjects.add(this)
  }

  reset(): void {
    this.request.calls.length = 0
    this.getConfig.calls.length = 0
  }
}

/**
 * Mock WebSocket
 */
export class MockWebSocket implements MockObject {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  public messageQueue: string[] = []
  private closeCode = 1000
  private closeReason = ''
  private autoConnect = true
  private timers: Set<number> = new Set()

  constructor(_url: string) {
    globalTestState.mockObjects.add(this)
    if (this.autoConnect) {
      const timerId = createTrackedTimer(() => this.simulateConnect(), 10)
      this.timers.add(timerId)
    }
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    this.messageQueue.push(data)
  }

  close(code = 1000, reason = ''): void {
    this.closeCode = code
    this.closeReason = reason
    this.readyState = MockWebSocket.CLOSING
    const timerId = createTrackedTimer(() => this.simulateClose(), 10)
    this.timers.add(timerId)
  }

  simulateConnect(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(
      new CloseEvent('close', {
        code: this.closeCode,
        reason: this.closeReason,
        wasClean: this.closeCode === 1000,
      }),
    )
  }

  simulateMessage(data: unknown): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify(data),
        }),
      )
    }
  }

  simulateError(): void {
    this.onerror?.(new Event('error'))
  }

  getLastSentMessage(): unknown {
    const lastMessage = this.messageQueue[this.messageQueue.length - 1]
    return lastMessage ? JSON.parse(lastMessage) : null
  }

  getSentMessages(): unknown[] {
    return this.messageQueue.map((msg) => JSON.parse(msg))
  }

  setAutoConnect(value: boolean): void {
    this.autoConnect = value
  }

  clearMessages(): void {
    this.messageQueue = []
  }

  reset(): void {
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onclose = null
    this.onmessage = null
    this.onerror = null
    this.messageQueue = []
    this.closeCode = 1000
    this.closeReason = ''
    this.autoConnect = true

    // Clear any timers this WebSocket created
    for (const timerId of this.timers) {
      clearTimeout(timerId)
      globalTestState.timers.delete(timerId)
    }
    this.timers.clear()
  }

  destroy(): void {
    this.reset()
    globalTestState.mockObjects.delete(this)
  }
}

/**
 * Creates a mock AlpacaMarketClient instance
 */
export function createMockAlpacaMarketClient(): MockAlpacaMarketClient {
  return new MockAlpacaMarketClient()
}

/**
 * Creates a mock WebSocket instance
 */
export function createMockWebSocket(url: string): MockWebSocket {
  return new MockWebSocket(url)
}

/**
 * Comprehensive cleanup function for test state
 */
export async function cleanupTestState(): Promise<void> {
  // Wait for all async operations to complete
  if (globalTestState.asyncOperations.size > 0) {
    try {
      await Promise.allSettled([...globalTestState.asyncOperations])
    } catch (error) {
      console.warn('Some async operations failed during cleanup:', error)
    }
  }

  // Clear all timers
  for (const timerId of globalTestState.timers) {
    clearTimeout(timerId)
  }
  globalTestState.timers.clear()

  // Clear all intervals
  for (const intervalId of globalTestState.intervals) {
    clearInterval(intervalId)
  }
  globalTestState.intervals.clear()

  // Clear all timeouts
  for (const timeoutId of globalTestState.timeouts) {
    clearTimeout(timeoutId)
  }
  globalTestState.timeouts.clear()

  // Reset all mock objects
  for (const mockObject of globalTestState.mockObjects) {
    try {
      mockObject.reset()
      if (mockObject.destroy) {
        mockObject.destroy()
      }
    } catch (error) {
      console.warn('Failed to reset/destroy mock object:', error)
    }
  }

  // Restore all stubs
  for (const stubInstance of globalTestState.stubs) {
    try {
      const stub = stubInstance as { restore: () => void; restored?: boolean }
      if (!stub.restored) {
        stub.restore()
      }
    } catch (error) {
      console.warn('Failed to restore stub:', error)
    }
  }
  globalTestState.stubs.clear()

  // Clear spy references (spies don't need explicit cleanup)
  globalTestState.spies.clear()

  // Clear async operations
  globalTestState.asyncOperations.clear()

  // Call global restore to clean up any remaining stubs
  restore()
}

/**
 * Resets test state without destroying objects (for beforeEach)
 */
export function resetTestState(): void {
  // Reset all mock objects
  for (const mockObject of globalTestState.mockObjects) {
    try {
      mockObject.reset()
    } catch (error) {
      console.warn('Failed to reset mock object:', error)
    }
  }

  // Clear completed async operations
  const completedOps = [...globalTestState.asyncOperations].filter((promise) => {
    // Check if promise is settled (this is a bit hacky but works)
    let isSettled = false
    promise.then(() => {
      isSettled = true
    }, () => {
      isSettled = true
    })
    return isSettled
  })

  for (const op of completedOps) {
    globalTestState.asyncOperations.delete(op)
  }
}

/**
 * Helper to wait for all pending async operations
 */
export async function waitForAsyncOperations(timeout = 5000): Promise<void> {
  const startTime = Date.now()

  while (globalTestState.asyncOperations.size > 0) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for ${globalTestState.asyncOperations.size} async operations to complete`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Helper to check for resource leaks
 */
export function checkForLeaks(): { timers: number; intervals: number; asyncOps: number } {
  return {
    timers: globalTestState.timers.size,
    intervals: globalTestState.intervals.size,
    asyncOps: globalTestState.asyncOperations.size,
  }
}

/**
 * Creates a test isolator that ensures proper setup and teardown
 */
export function createTestIsolator() {
  return {
    async beforeEach(): Promise<void> {
      resetTestState()
    },

    async afterEach(): Promise<void> {
      await cleanupTestState()

      // Check for leaks after cleanup
      const leaks = checkForLeaks()
      if (leaks.timers > 0 || leaks.intervals > 0 || leaks.asyncOps > 0) {
        console.warn('Resource leaks detected after cleanup:', leaks)
      }
    },
  }
}

/**
 * Utility to create a fetch stub with proper cleanup
 */
export function createMockFetch(response: Response | Promise<Response> | (() => Response | Promise<Response>)) {
  return createTrackedStub(globalThis, 'fetch', () => {
    if (typeof response === 'function') {
      return Promise.resolve(response())
    }
    return Promise.resolve(response)
  })
}

/**
 * Utility to wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const startTime = Date.now()

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/**
 * Creates a promise that resolves after a delay (tracked)
 */
export function delay(ms: number): Promise<void> {
  return trackAsyncOperation(
    new Promise<void>((resolve) => {
      createTrackedTimer(() => resolve(), ms)
    }),
  )
}

/**
 * Utility for testing WebSocket connections with proper cleanup
 */
export function setupMockWebSocket(): {
  MockWebSocket: typeof MockWebSocket
  originalWebSocket: typeof globalThis.WebSocket
  restore: () => void
} {
  const originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket

  return {
    MockWebSocket,
    originalWebSocket,
    restore: () => {
      globalThis.WebSocket = originalWebSocket
    },
  }
}

/**
 * Mock logger
 */
// export class MockLogger implements MockObject {
//   public trace = createTrackedSpy(() => {})
//   public debug = createTrackedSpy(() => {})
//   public info = createTrackedSpy(() => {})
//   public warn = createTrackedSpy(() => {})
//   public error = createTrackedSpy(() => {})

//   constructor() {
//     globalTestState.mockObjects.add(this)
//   }

//   reset(): void {
//     this.trace.calls.length = 0
//     this.debug.calls.length = 0
//     this.info.calls.length = 0
//     this.warn.calls.length = 0
//     this.error.calls.length = 0
//   }
// }

// export function createMockLogger(): MockLogger {
//   return new MockLogger()
// }
