import { Page } from '@playwright/test'

/**
 * Deterministic Wait Utilities
 *
 * These helpers wait for specific game conditions instead of arbitrary time periods.
 * They eliminate non-determinism caused by browser throttling during parallel test execution.
 */

/**
 * Wait for ball to be possessed by any player
 * @param page - Playwright page
 * @param options - Optional configuration
 * @returns Session ID of player who has possession, or null if timeout
 */
export async function waitForBallPossession(
  page: Page,
  options: { timeout?: number; by?: string } = {}
): Promise<string | null> {
  const { timeout = 10000, by } = options

  try {
    const possessor = await page.waitForFunction(
      (expectedPlayer) => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
        const currentPossessor = state?.ball?.possessedBy

        // If we're waiting for a specific player
        if (expectedPlayer) {
          return currentPossessor === expectedPlayer
        }

        // Otherwise, just wait for any possession
        return currentPossessor !== '' && currentPossessor !== null && currentPossessor !== undefined
      },
      by,
      { timeout }
    )

    // Get the actual possessor ID
    return await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
      return state?.ball?.possessedBy || null
    })
  } catch (error) {
    return null
  }
}

/**
 * Wait for ball to be released (no possession)
 */
export async function waitForBallRelease(
  page: Page,
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 5000 } = options

  try {
    await page.waitForFunction(
      () => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
        const possessor = state?.ball?.possessedBy
        return possessor === '' || possessor === null || possessor === undefined
      },
      { timeout }
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Wait for ball velocity to exceed minimum threshold
 * Useful for verifying shooting worked
 */
export async function waitForBallMoving(
  page: Page,
  minVelocity: number = 100,
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 5000 } = options

  try {
    await page.waitForFunction(
      (minVel) => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
        const ball = state?.ball
        if (!ball) return false

        const velocity = Math.sqrt(
          (ball.velocityX || 0) ** 2 + (ball.velocityY || 0) ** 2
        )
        return velocity >= minVel
      },
      minVelocity,
      { timeout }
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Wait for game phase to change
 */
export async function waitForGamePhase(
  page: Page,
  expectedPhase: 'waiting' | 'playing' | 'ended',
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 10000 } = options

  try {
    await page.waitForFunction(
      (phase) => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
        return state?.phase === phase
      },
      expectedPhase,
      { timeout }
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Wait for player to be within distance of target position
 */
export async function waitForPlayerNearPosition(
  page: Page,
  targetX: number,
  targetY: number,
  maxDistance: number = 50,
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 10000 } = options

  try {
    await page.waitForFunction(
      ({ x, y, dist }) => {
        const scene = (window as any).__gameControls?.scene
        const player = scene?.player
        if (!player) return false

        const dx = player.x - x
        const dy = player.y - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance <= dist
      },
      { x: targetX, y: targetY, dist: maxDistance },
      { timeout }
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Wait for score to change
 */
export async function waitForScore(
  page: Page,
  expectedBlue: number,
  expectedRed: number,
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 10000 } = options

  try {
    await page.waitForFunction(
      ({ blue, red }) => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.() || scene?.gameEngine?.getState?.()
        return state?.scoreBlue === blue && state?.scoreRed === red
      },
      { blue: expectedBlue, red: expectedRed },
      { timeout }
    )
    return true
  } catch (error) {
    return false
  }
}

/**
 * Wait for N game frames to pass (deterministic!)
 * This uses the game engine's frame counter, not real time.
 */
export async function waitForFrames(
  page: Page,
  frameCount: number
): Promise<void> {
  const startFrame = await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    // Get current frame from engine if available
    return scene?.gameEngine?.frameCount || scene?.time?.now || 0
  })

  const targetFrame = startFrame + frameCount

  await page.waitForFunction(
    (target) => {
      const scene = (window as any).__gameControls?.scene
      const currentFrame = scene?.gameEngine?.frameCount || scene?.time?.now || 0
      return currentFrame >= target
    },
    targetFrame,
    { timeout: frameCount * 100 } // Generous timeout: 100ms per frame
  )
}

/**
 * Wait for both clients to see the same ball possession state
 * Useful for multiplayer sync tests
 */
export async function waitForPossessionSync(
  client1: Page,
  client2: Page,
  options: { timeout?: number } = {}
): Promise<boolean> {
  const { timeout = 5000 } = options

  try {
    // Poll both clients until they agree
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const [possessor1, possessor2] = await Promise.all([
        client1.evaluate(() => {
          const scene = (window as any).__gameControls?.scene
          const state = scene?.networkManager?.getState()
          return state?.ball?.possessedBy
        }),
        client2.evaluate(() => {
          const scene = (window as any).__gameControls?.scene
          const state = scene?.networkManager?.getState()
          return state?.ball?.possessedBy
        })
      ])

      if (possessor1 === possessor2) {
        return true
      }

      // Wait a frame before checking again
      await new Promise(resolve => setTimeout(resolve, 16))
    }
    return false
  } catch (error) {
    return false
  }
}
