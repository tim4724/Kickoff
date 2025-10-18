import { Page } from '@playwright/test'
import { waitScaled } from './time-control'

/**
 * Test Room Isolation Utilities
 *
 * These helpers ensure each test runs in an isolated Colyseus room,
 * preventing cross-test contamination and enabling parallel execution.
 */

/**
 * Generate unique room ID for test isolation
 *
 * Format: test-w{workerIndex}-{timestamp}-{random}
 *
 * @param workerIndex - Playwright worker index (0, 1, 2, ...)
 * @returns Unique room ID string
 */
export function generateTestRoomId(workerIndex: number): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `test-w${workerIndex}-${timestamp}-${random}`
}

/**
 * Set test room ID before page navigation
 *
 * This sets the window.__testRoomId variable that NetworkManager
 * will use to join the specified room.
 *
 * @param page - Playwright page object
 * @param roomId - Room ID to join
 */
export async function setTestRoomId(page: Page, roomId: string): Promise<void> {
  await page.addInitScript((id) => {
    ;(window as any).__testRoomId = id
  }, roomId)
}

/**
 * Setup isolated test environment
 *
 * Combines room ID generation, setup, and navigation into one call.
 * Use this for simple single-client tests.
 *
 * @param page - Playwright page object
 * @param url - URL to navigate to
 * @param workerIndex - Playwright worker index
 * @returns The generated room ID (useful for logging/debugging)
 *
 * @example
 * ```typescript
 * test('my test', async ({ page }, testInfo) => {
 *   const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
 *   console.log(`🔒 Test isolated in room: ${roomId}`)
 *   // ... rest of test
 * })
 * ```
 */
export async function setupIsolatedTest(
  page: Page,
  url: string,
  workerIndex: number
): Promise<string> {
  const roomId = generateTestRoomId(workerIndex)
  await setTestRoomId(page, roomId)
  await page.goto(url)

  // Wait for player to be ready (server confirms initialization)
  await waitForPlayerReady(page)

  return roomId
}

/**
 * Setup multiple clients in the same isolated room
 *
 * Use this for multiplayer tests where multiple clients need to
 * interact in the same room.
 *
 * @param pages - Array of Playwright page objects
 * @param url - URL to navigate all pages to
 * @param workerIndex - Playwright worker index
 * @returns The shared room ID
 *
 * @example
 * ```typescript
 * test('multiplayer test', async ({ browser }, testInfo) => {
 *   const context1 = await browser.newContext()
 *   const context2 = await browser.newContext()
 *   const client1 = await context1.newPage()
 *   const client2 = await context2.newPage()
 *
 *   const roomId = await setupMultiClientTest(
 *     [client1, client2],
 *     CLIENT_URL,
 *     testInfo.workerIndex
 *   )
 *
 *   // Both clients now in same isolated room
 * })
 * ```
 */
export async function setupMultiClientTest(
  pages: Page[],
  url: string,
  workerIndex: number
): Promise<string> {
  const roomId = generateTestRoomId(workerIndex)

  // Set room ID for all pages
  await Promise.all(
    pages.map(page => setTestRoomId(page, roomId))
  )

  // Navigate all pages
  await Promise.all(
    pages.map(page => page.goto(url))
  )

  // Wait for all players to be ready (server confirms initialization)
  await Promise.all(
    pages.map(page => waitForPlayerReady(page))
  )

  return roomId
}

/**
 * Setup single-player test environment
 *
 * Navigates to the client and starts single-player scene (no multiplayer).
 * Use this for tests that only need physics/gameplay without networking.
 *
 * @param page - Playwright page object
 * @param url - URL to navigate to
 * @returns Promise that resolves when single-player scene is ready
 *
 * @example
 * ```typescript
 * test('physics test', async ({ page }) => {
 *   await setupSinglePlayerTest(page, CLIENT_URL)
 *   // ... test single-player physics
 * })
 * ```
 */
export async function setupSinglePlayerTest(
  page: Page,
  url: string
): Promise<void> {
  await page.goto(url)

  // Wait for Phaser game instance to be available
  await page.waitForFunction(() => {
    const game = (window as any).game
    return game && game.scene && game.scene.scenes && game.scene.scenes.length > 0
  }, { timeout: 10000 })

  // Start SinglePlayerScene
  await page.evaluate(() => {
    const game = (window as any).game
    if (game && game.scene) {
      game.scene.start('SinglePlayerScene')
      game.scene.stop('MenuScene') // Stop menu scene
    }
  })

  // Wait for single-player scene to be ready and expose test API
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.scene?.key === 'SinglePlayerScene' && scene?.player
  }, { timeout: 10000 })

  // Small delay for scene initialization
  await waitScaled(page, 500)
}

/**
 * Wait for player_ready message from server
 *
 * This ensures the player is fully initialized on the server before
 * proceeding with tests. Prevents race conditions with team assignment
 * and session ID availability.
 *
 * @param page - Playwright page object
 * @param timeoutMs - Maximum time to wait (default: 10000ms)
 * @returns Promise that resolves when player is ready
 */
export async function waitForPlayerReady(
  page: Page,
  timeoutMs: number = 10000
): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    // Player is ready when we have both sessionId and it exists in the players map
    return scene?.mySessionId && scene?.networkManager?.getState()?.players?.has(scene.mySessionId)
  }, { timeout: timeoutMs })
}
