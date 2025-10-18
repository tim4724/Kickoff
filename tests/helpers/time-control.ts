import { Page } from '@playwright/test'

/**
 * Time Control Utilities for Deterministic Testing
 *
 * These utilities allow tests to:
 * - Speed up game time (10x, 100x, etc.)
 * - Manually advance time frame-by-frame
 * - Make tests deterministic and faster
 */

/**
 * Enable accelerated time for faster tests
 * @param page Playwright page
 * @param timeScale Time acceleration multiplier (e.g., 10 = 10x speed)
 */
export async function setTimeScale(page: Page, timeScale: number): Promise<void> {
  await page.evaluate((scale) => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.setTimeScale(scale)
      console.log(`🕐 Time scale set to ${scale}x`)
    } else {
      console.warn('⚠️ GameClock not available')
    }
  }, timeScale)
}

/**
 * Enable mock time mode for manual control
 * @param page Playwright page
 */
export async function enableMockTime(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.useMockTime()
      console.log('🕐 Mock time enabled')
    } else {
      console.warn('⚠️ GameClock not available')
    }
  })
}

/**
 * Disable mock time and return to real time
 * @param page Playwright page
 */
export async function disableMockTime(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.useRealTime()
      console.log('🕐 Real time restored')
    } else {
      console.warn('⚠️ GameClock not available')
    }
  })
}

/**
 * Manually advance time in mock mode
 * @param page Playwright page
 * @param deltaMs Time to advance in milliseconds
 */
export async function advanceTime(page: Page, deltaMs: number): Promise<void> {
  await page.evaluate((delta) => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.tick(delta)
    } else {
      console.warn('⚠️ GameClock not available')
    }
  }, deltaMs)
}

/**
 * Advance time by a single physics frame (16.67ms)
 * @param page Playwright page
 */
export async function advanceOneFrame(page: Page): Promise<void> {
  await advanceTime(page, 16.67)
}

/**
 * Advance time by multiple frames
 * @param page Playwright page
 * @param numFrames Number of frames to advance
 */
export async function advanceFrames(page: Page, numFrames: number): Promise<void> {
  await advanceTime(page, 16.67 * numFrames)
}

/**
 * Wait for game time duration (NOT real time)
 * With 10x time acceleration, game runs 10x faster, so we wait LESS real time
 *
 * Example: waitScaled(page, 1000) with 10x acceleration
 *   - Game time: 1000ms passes in the game
 *   - Real time: 100ms actual wait (1000ms / 10)
 *
 * @param page Playwright page
 * @param gameTimeMs Game time milliseconds to wait
 */
export async function waitScaled(page: Page, gameTimeMs: number): Promise<void> {
  const timeScale = await page.evaluate(() => {
    const GameClock = (window as any).GameClock
    // GameClock is the singleton instance, not a class
    return GameClock ? GameClock.getTimeScale() : 1
  })

  // With time acceleration, game runs faster, so we wait LESS real time
  const realTimeMs = gameTimeMs / timeScale
  await page.waitForTimeout(realTimeMs)
}

/**
 * Reset time scale to 1x normal speed
 * @param page Playwright page
 */
export async function resetTimeScale(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.resetTimeScale()
      console.log('🕐 Time scale reset to 1x')
    }
  })
}

/**
 * Get current time scale
 * @param page Playwright page
 * @returns Current time scale multiplier
 */
export async function getTimeScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const { GameClock } = (window as any)
    return GameClock ? GameClock.getTimeScale() : 1
  })
}

/**
 * Check if in mock time mode
 * @param page Playwright page
 * @returns True if in mock mode
 */
export async function isMockMode(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const { GameClock } = (window as any)
    return GameClock ? GameClock.isMockMode() : false
  })
}

/**
 * Get current mock time value
 * @param page Playwright page
 * @returns Current mock time in milliseconds
 */
export async function getMockTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const { GameClock } = (window as any)
    return GameClock ? GameClock.getMockTime() : 0
  })
}

/**
 * Setup time control for a test
 * Call this at the start of tests that need time control
 * @param pages Array of pages to set up
 * @param options Time control options
 */
export async function setupTimeControl(
  pages: Page[],
  options: {
    mode?: 'realtime' | 'accelerated' | 'mock'
    timeScale?: number
  } = {}
): Promise<void> {
  const { mode = 'realtime', timeScale = 1 } = options

  for (const page of pages) {
    if (mode === 'mock') {
      await enableMockTime(page)
    } else if (mode === 'accelerated') {
      await setTimeScale(page, timeScale)
    }
    // 'realtime' mode is default, no setup needed
  }

  console.log(`⏱️ Time control setup: mode=${mode}, scale=${timeScale}x`)
}

/**
 * Teardown time control after a test
 * Call this in afterEach to clean up
 * @param pages Array of pages to tear down
 */
export async function teardownTimeControl(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await disableMockTime(page)
    await resetTimeScale(page)
  }
}

/**
 * Helper to run game for a specific duration with time control
 * @param page Playwright page
 * @param durationMs Duration in game time (not real time)
 * @param frameMs Frame duration (default 16.67ms = 60fps)
 */
export async function runGameFor(
  page: Page,
  durationMs: number,
  frameMs: number = 16.67
): Promise<void> {
  const isMock = await isMockMode(page)

  if (isMock) {
    // Manual stepping in mock mode
    const numFrames = Math.ceil(durationMs / frameMs)
    for (let i = 0; i < numFrames; i++) {
      await advanceTime(page, frameMs)
      // Small delay to allow game to process (real-time, not scaled)
      await new Promise(resolve => setTimeout(resolve, 1))
    }
  } else {
    // Use scaled waiting for real-time or accelerated mode
    await waitScaled(page, durationMs)
  }
}
