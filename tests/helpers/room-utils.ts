import { Page } from '@playwright/test'
import { waitScaled } from './time-control'

/**
 * Navigate to Single Player scene
 *
 * Waits for menu and button to be fully ready before clicking,
 * then waits for scene to be fully initialized.
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 */
export async function navigateToSinglePlayer(
  page: Page,
  options: {
    disableAI?: boolean
    disableAutoSwitch?: boolean
    timeout?: number
  } = {}
): Promise<void> {
  const { disableAI = true, disableAutoSwitch = true, timeout = 30000 } = options

  // Wait for menu AND button to be fully ready (not just menu loaded)
  await page.waitForFunction(
    () => {
      const menuLoaded = (window as any).__menuLoaded === true
      const button = (window as any).__menuButtons?.singlePlayer
      // Ensure button exists and is interactive
      return menuLoaded && button && button.interactive === true
    },
    { timeout }
  )

  // Click the single player button (emit both events like a real click)
  await page.evaluate(() => {
    const button = (window as any).__menuButtons.singlePlayer
    button.emit('pointerdown')
    button.emit('pointerup')
  })

  // Wait for scene transition
  await page.waitForFunction(
    () => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene',
    { timeout }
  )

  // Wait for scene to be fully initialized with players
  await page.waitForFunction(
    () => {
      const scene = (window as any).__gameControls?.scene
      return scene?.myPlayerId && scene?.players?.size > 0
    },
    { timeout: 10000 }
  )

  // Disable AI if requested
  if (disableAI) {
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      if (controls?.test?.setAIEnabled) {
        controls.test.setAIEnabled(false)
      }
    })
  }

  // Disable auto-switch if requested
  if (disableAutoSwitch) {
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      if (controls?.test?.setAutoSwitchEnabled) {
        controls.test.setAutoSwitchEnabled(false)
      }
    })
  }
}

/**
 * Test Room Isolation Utilities
 *
 * These helpers ensure each test runs in an isolated Colyseus room,
 * preventing cross-test contamination and enabling parallel execution.
 */

/**
 * Counter to ensure unique room IDs even within the same millisecond
 */
let roomIdCounter = 0

/**
 * Generate unique room ID for test isolation
 *
 * Format: test-w{workerIndex}-{counter}-{timestamp}-{random}
 *
 * Uses multiple sources of uniqueness to prevent collisions:
 * - Auto-incrementing counter (unique per process)
 * - Worker index (unique per parallel worker)
 * - Timestamp (unique per millisecond)
 * - Random string (additional entropy)
 *
 * @param workerIndex - Playwright worker index (0, 1, 2, ...)
 * @returns Unique room ID string
 */
export function generateTestRoomId(workerIndex: number): string {
  const counter = roomIdCounter++
  const timestamp = Date.now()
  // Use crypto.randomUUID if available, otherwise fallback to Math.random
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `test-w${workerIndex}-${counter}-${timestamp}-${random}`
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
    window.__testRoomId = id
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
    // Check for unified player system - should have myPlayerId and players map
    return scene?.scene?.key === 'SinglePlayerScene' && scene?.myPlayerId && scene?.players?.size > 0
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
  timeoutMs: number = 30000
): Promise<void> {
  await page.waitForFunction(() => {
    const scene = window.__gameControls?.scene
    // Player is ready when we have myPlayerId and it exists in the players map
    // myPlayerId format: "sessionId-p1" (includes the -p1 suffix)
    return scene?.myPlayerId && scene?.networkManager?.getState()?.players?.has(scene.myPlayerId)
  }, { timeout: timeoutMs })
}

/**
 * Gracefully disconnect from a room before closing context
 *
 * This ensures the server-side cleanup happens properly before
 * the browser context is closed.
 *
 * @param page - Playwright page object
 */
export async function disconnectFromRoom(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.getRoom()
      if (room) {
        room.leave()
      }
    })
    // Brief wait for disconnection to propagate
    await page.waitForTimeout(100)
  } catch {
    // Page might already be closed or room might not exist
  }
}

/**
 * Clean up test context with proper disconnection
 *
 * Use this in test cleanup to ensure proper resource cleanup.
 * Wraps context.close() with graceful disconnection.
 *
 * @param page - Playwright page object
 * @param context - Browser context to close
 */
export async function cleanupTestContext(
  page: Page,
  context: { close: () => Promise<void> }
): Promise<void> {
  await disconnectFromRoom(page)
  await context.close()
}

/**
 * Wait for a specific player count in the room
 *
 * Useful for verifying players have joined or left.
 *
 * @param page - Playwright page object
 * @param expectedCount - Expected number of players
 * @param timeoutMs - Maximum wait time (default: 10000ms)
 */
export async function waitForPlayerCountInRoom(
  page: Page,
  expectedCount: number,
  timeoutMs: number = 10000
): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size === count
    },
    expectedCount,
    { timeout: timeoutMs }
  )
}
