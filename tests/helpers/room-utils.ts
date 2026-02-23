import { Page } from '@playwright/test'

/**
 * Navigate to Single Player scene
 *
 * Waits for menu and button to be fully ready before clicking,
 * then waits for scene to be fully initialized.
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
    { timeout }
  )

  if (disableAI) {
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      if (controls?.test?.setAIEnabled) {
        controls.test.setAIEnabled(false)
      }
    })
  }

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
 * Counter to ensure unique room IDs even within the same millisecond
 */
let roomIdCounter = 0

/**
 * Generate unique room ID for test isolation
 */
export function generateTestRoomId(workerIndex: number): string {
  const counter = roomIdCounter++
  const timestamp = Date.now()
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `test-w${workerIndex}-${counter}-${timestamp}-${random}`
}

/**
 * Setup multiple clients in the same isolated room
 */
export async function setupMultiClientTest(
  pages: Page[],
  url: string,
  workerIndex: number
): Promise<string> {
  const roomId = generateTestRoomId(workerIndex)

  // Set room ID for all pages via init script
  await Promise.all(
    pages.map(page =>
      page.addInitScript((id) => {
        (window as any).__testRoomId = id
      }, roomId)
    )
  )

  // Navigate all pages
  await Promise.all(
    pages.map(page => page.goto(url))
  )

  // Wait for all players to be ready
  await Promise.all(
    pages.map(page =>
      page.waitForFunction(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.myPlayerId && scene?.networkManager?.getState()?.players?.has(scene.myPlayerId)
      }, { timeout: 30000 })
    )
  )

  return roomId
}

/**
 * Clean up test context — close context which forces disconnect
 */
export async function cleanupTestContext(
  page: Page,
  context: { close: () => Promise<void> }
): Promise<void> {
  await context.close()
}
