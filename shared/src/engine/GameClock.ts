/**
 * GameClock - Controllable time system for deterministic testing
 *
 * Provides a unified time source that can be:
 * - Real-time (production)
 * - Accelerated (fast tests)
 * - Manually stepped (deterministic tests)
 *
 * Usage:
 *   Production: GameClock.useRealTime()
 *   Fast tests:  GameClock.setTimeScale(10) // 10x speed
 *   Manual:      GameClock.useMockTime(); GameClock.tick(16.67)
 */

type TimerCallback = () => void

interface ScheduledTimer {
  id: number
  callback: TimerCallback
  delay: number
  elapsed: number
}

export class GameClock {
  private static instance: GameClock

  // Mode
  private useMock: boolean = false
  private timeScale: number = 1.0
  private paused: boolean = false

  // Mock time state
  private mockTime: number = 0
  private lastRealTime: number = 0

  // Scaled time tracking (for real-time mode with time scale)
  private scaledTime: number = 0

  // Scheduled timers
  private nextTimerId: number = 1
  private timers: Map<number, ScheduledTimer> = new Map()

  private constructor() {
    this.lastRealTime = this.getRealTime()
    this.scaledTime = 0
  }

  static getInstance(): GameClock {
    if (!GameClock.instance) {
      GameClock.instance = new GameClock()
    }
    return GameClock.instance
  }

  /**
   * Get current time in milliseconds
   */
  now(): number {
    if (this.useMock) {
      return this.mockTime
    }

    // In real-time mode, update scaled time (only if not paused)
    const currentRealTime = this.getRealTime()
    const realDelta = currentRealTime - this.lastRealTime
    this.lastRealTime = currentRealTime

    // Only advance time if not paused
    if (!this.paused) {
      this.scaledTime += realDelta * this.timeScale
    }

    return this.scaledTime
  }

  /**
   * Get elapsed time since last call (for delta time calculations)
   * @deprecated Use now() directly for time-based calculations
   */
  getDeltaTime(): number {
    const currentTime = this.now()
    return currentTime - this.scaledTime
  }

  /**
   * Schedule a callback after a delay (milliseconds)
   * Returns a timer ID that can be used to cancel
   */
  setTimeout(callback: TimerCallback, delay: number): number {
    if (!this.useMock) {
      // Use real setTimeout but apply time scale
      const scaledDelay = delay / this.timeScale
      const realTimerId = setTimeout(callback, scaledDelay) as unknown as number
      return realTimerId
    }

    // Mock mode: manually manage timers
    const timer: ScheduledTimer = {
      id: this.nextTimerId++,
      callback,
      delay,
      elapsed: 0,
    }
    this.timers.set(timer.id, timer)
    return timer.id
  }

  /**
   * Cancel a scheduled timer
   */
  clearTimeout(timerId: number): void {
    if (!this.useMock) {
      clearTimeout(timerId)
      return
    }

    this.timers.delete(timerId)
  }

  /**
   * Advance mock time by delta milliseconds
   * Executes any timers that expire during this period
   */
  tick(deltaMs: number): void {
    if (!this.useMock) {
      console.warn('GameClock.tick() called in real-time mode, ignored')
      return
    }

    this.mockTime += deltaMs

    // Check and execute expired timers
    const expiredTimers: ScheduledTimer[] = []

    this.timers.forEach((timer) => {
      timer.elapsed += deltaMs
      if (timer.elapsed >= timer.delay) {
        expiredTimers.push(timer)
      }
    })

    // Execute callbacks and remove timers
    expiredTimers.forEach((timer) => {
      this.timers.delete(timer.id)
      timer.callback()
    })
  }

  /**
   * Enable mock time mode (for tests)
   */
  useMockTime(): void {
    this.useMock = true
    this.mockTime = 0
    this.timers.clear()
    console.log('🕐 GameClock: Mock time enabled')
  }

  /**
   * Enable real time mode (for production)
   */
  useRealTime(): void {
    this.useMock = false
    this.timers.clear()
    this.lastRealTime = this.getRealTime()
    this.scaledTime = 0
    console.log('🕐 GameClock: Real time enabled')
  }

  /**
   * Set time scale multiplier (e.g., 10 = 10x speed)
   * Works in both real and mock modes
   */
  setTimeScale(scale: number): void {
    if (scale <= 0) {
      throw new Error('Time scale must be positive')
    }
    this.timeScale = scale
    console.log(`🕐 GameClock: Time scale set to ${scale}x`)
  }

  /**
   * Reset time scale to 1x
   */
  resetTimeScale(): void {
    this.timeScale = 1.0
  }

  /**
   * Get current mock time (for debugging)
   */
  getMockTime(): number {
    return this.mockTime
  }

  /**
   * Check if in mock mode
   */
  isMockMode(): boolean {
    return this.useMock
  }

  /**
   * Get current time scale
   */
  getTimeScale(): number {
    return this.timeScale
  }

  /**
   * Pause the clock (time stops advancing)
   */
  pause(): void {
    this.paused = true
    console.log('⏸️ GameClock: Paused')
  }

  /**
   * Resume the clock (time continues advancing)
   */
  resume(): void {
    if (this.paused) {
      // Reset lastRealTime to prevent time jump
      this.lastRealTime = this.getRealTime()
      this.paused = false
      console.log('▶️ GameClock: Resumed')
    }
  }

  /**
   * Check if clock is paused
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * Reset clock state (for test isolation)
   */
  reset(): void {
    this.mockTime = 0
    this.scaledTime = 0
    this.lastRealTime = this.getRealTime()
    this.timers.clear()
    this.timeScale = 1.0
    this.paused = false
    console.log('🕐 GameClock: Reset')
  }

  // Private helper to get real time
  private getRealTime(): number {
    // Use performance.now() if available (browser), otherwise Date.now()
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now()
    }
    return Date.now()
  }
}

// Convenience functions for global access
export const gameClock = GameClock.getInstance()

/**
 * Helper for tests to set up mock time
 */
export function setupMockTime(): void {
  gameClock.useMockTime()
  gameClock.reset()
}

/**
 * Helper for tests to tear down mock time
 */
export function teardownMockTime(): void {
  gameClock.useRealTime()
  gameClock.resetTimeScale()
}

/**
 * Helper for tests to advance time
 */
export function advanceTime(ms: number): void {
  gameClock.tick(ms)
}
