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
      GameClock.getInstance().setTimeScale(scale)
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
      GameClock.getInstance().useMockTime()
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
      GameClock.getInstance().useRealTime()
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
      GameClock.getInstance().tick(delta)
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
 * Wait for real-world time (scaled by time scale)
 * This replaces waitForTimeout with scale-aware waiting
 * @param page Playwright page
 * @param ms Milliseconds to wait (will be divided by time scale)
 */
export async function waitScaled(page: Page, ms: number): Promise<void> {
  const timeScale = await page.evaluate(() => {
    const { GameClock } = (window as any)
    return GameClock ? GameClock.getInstance().getTimeScale() : 1
  })

  const actualWaitMs = ms / timeScale
  await page.waitForTimeout(actualWaitMs)
}

/**
 * Reset time scale to 1x normal speed
 * @param page Playwright page
 */
export async function resetTimeScale(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { GameClock } = (window as any)
    if (GameClock) {
      GameClock.getInstance().resetTimeScale()
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
    return GameClock ? GameClock.getInstance().getTimeScale() : 1
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
    return GameClock ? GameClock.getInstance().isMockMode() : false
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
    return GameClock ? GameClock.getInstance().getMockTime() : 0
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
      // Small delay to allow game to process
      await page.waitForTimeout(1)
    }
  } else {
    // Use scaled waiting for real-time or accelerated mode
    await waitScaled(page, durationMs)
  }
}
