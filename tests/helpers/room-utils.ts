import { Page } from '@playwright/test'

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

  return roomId
}
