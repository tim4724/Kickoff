import { Page } from '@playwright/test'

/**
 * Wait Utilities for Test Reliability
 *
 * These functions replace arbitrary `waitForTimeout()` calls with
 * condition-based waits, improving test reliability and speed.
 */

/**
 * Wait for game scene to be initialized
 * @param page Playwright page
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForGameScene(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene !== undefined && scene !== null
  }, { timeout })
}

/**
 * Wait for multiplayer connection to establish
 * @param page Playwright page
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForMultiplayerConnection(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.networkManager?.getRoom() !== undefined
  }, { timeout })
}

/**
 * Wait for match to start (phase = 'playing')
 * @param page Playwright page
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForMatchStart(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return state?.phase === 'playing'
  }, { timeout })
}

/**
 * Wait for player to have possession of ball
 * @param page Playwright page
 * @param sessionId Player session ID (optional, uses mySessionId if not provided)
 * @param timeout Maximum wait time in ms (default: 5000)
 */
export async function waitForBallPossession(page: Page, sessionId?: string, timeout = 5000): Promise<void> {
  await page.waitForFunction((sid) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    const playerId = sid || scene?.mySessionId
    return state?.ball?.possessedBy === playerId
  }, sessionId, { timeout })
}

/**
 * Wait for ball to be released (no possession)
 * @param page Playwright page
 * @param timeout Maximum wait time in ms (default: 5000)
 */
export async function waitForBallRelease(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return state?.ball?.possessedBy === '' || state?.ball?.possessedBy === null
  }, { timeout })
}

/**
 * Wait for ball to move (position changes)
 * @param page Playwright page
 * @param initialX Initial X position
 * @param initialY Initial Y position
 * @param minDistance Minimum distance moved (default: 10px)
 * @param timeout Maximum wait time in ms (default: 5000)
 */
export async function waitForBallMovement(
  page: Page,
  initialX: number,
  initialY: number,
  minDistance = 10,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ x, y, dist }) => {
      const scene = (window as any).__gameControls?.scene
      const ball = scene?.ball
      if (!ball) return false

      const dx = ball.x - x
      const dy = ball.y - y
      return Math.sqrt(dx * dx + dy * dy) > dist
    },
    { x: initialX, y: initialY, dist: minDistance },
    { timeout }
  )
}

/**
 * Wait for player to move (position changes)
 * Uses controlledPlayerId to track the actively controlled player
 * @param page Playwright page
 * @param initialX Initial X position
 * @param initialY Initial Y position
 * @param minDistance Minimum distance moved (default: 10px)
 * @param timeout Maximum wait time in ms (default: 5000)
 */
export async function waitForPlayerMovement(
  page: Page,
  initialX: number,
  initialY: number,
  minDistance = 10,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ x, y, dist }) => {
      const scene = (window as any).__gameControls?.scene
      // Use controlledPlayerId because that's the player being moved by input
      const controlledPlayerId = scene?.controlledPlayerId || scene?.myPlayerId
      const player = scene?.players?.get(controlledPlayerId)
      if (!player) return false

      const dx = player.x - x
      const dy = player.y - y
      return Math.sqrt(dx * dx + dy * dy) > dist
    },
    { x: initialX, y: initialY, dist: minDistance },
    { timeout }
  )
}

/**
 * Wait for remote player to appear
 * @param page Playwright page
 * @param remoteSessionId Remote player session ID
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForRemotePlayer(page: Page, remoteSessionId: string, timeout = 10000): Promise<void> {
  await page.waitForFunction((sid) => {
    const scene = (window as any).__gameControls?.scene
    return scene?.remotePlayers?.has(sid)
  }, remoteSessionId, { timeout })
}

/**
 * Wait for specific number of players in game
 * @param page Playwright page
 * @param count Expected player count
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForPlayerCount(page: Page, count: number, timeout = 10000): Promise<void> {
  await page.waitForFunction((expectedCount) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return state?.players?.size === expectedCount
  }, count, { timeout })
}

/**
 * Wait for score to change
 * @param page Playwright page
 * @param initialBlueScore Initial blue team score
 * @param initialRedScore Initial red team score
 * @param timeout Maximum wait time in ms (default: 10000)
 */
export async function waitForScoreChange(
  page: Page,
  initialBlueScore: number,
  initialRedScore: number,
  timeout = 10000
): Promise<void> {
  await page.waitForFunction(
    ({ blue, red }) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.scoreBlue !== blue || state?.scoreRed !== red
    },
    { blue: initialBlueScore, red: initialRedScore },
    { timeout }
  )
}

/**
 * Wait for timer to start counting down
 * @param page Playwright page
 * @param timeout Maximum wait time in ms (default: 5000)
 */
export async function waitForTimerStart(page: Page, timeout = 5000): Promise<void> {
  // Get initial time
  const initialTime = await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return state?.matchTime || 120
  })

  // Wait for time to decrease
  await page.waitForFunction((initial) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return state?.matchTime < initial
  }, initialTime, { timeout })
}

/**
 * Wait for controlled player to change (after switching)
 * @param page Playwright page
 * @param previousControlledId Previous controlled player ID
 * @param timeout Maximum wait time in ms (default: 2000)
 */
export async function waitForPlayerSwitch(page: Page, previousControlledId: string, timeout = 2000): Promise<void> {
  await page.waitForFunction((prevId) => {
    const scene = (window as any).__gameControls?.scene
    return scene?.controlledPlayerId !== prevId
  }, previousControlledId, { timeout })
}
