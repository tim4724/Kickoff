
import { test, expect } from '@playwright/test'
import { generateTestRoomId } from './helpers/room-utils'

test.describe('Fullscreen Click Bleed', () => {
  test('clicking fullscreen button should not trigger menu buttons underneath', async ({
    page,
    context,
    browserName,
  }, testInfo) => {
    // Mobile browsers are where the fullscreen prompt appears
    test.skip(browserName !== 'chromium', 'Test is only relevant for mobile simulation')

    // Each test needs a unique room ID to run in isolation
    const roomId = generateTestRoomId(testInfo.workerIndex)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/#${roomId}`)

    // Wait until the menu is loaded before interacting
    await page.waitForFunction(() => (window as any).__menuLoaded, null, { timeout: 15000 })

    // Check that the fullscreen splash is visible
    const fullscreenButton = page.locator('button', { hasText: 'TAP TO ENTER FULLSCREEN' })
    await expect(fullscreenButton).toBeVisible({ timeout: 15000 })

    // Listen for navigation events
    let navigated = false
    page.on('framenavigated', () => {
      navigated = true
    })

    // Click the fullscreen button
    await fullscreenButton.click({ force: true })

    // Wait a moment to see if any navigation occurs
    await page.waitForTimeout(500)

    // Assert that no navigation occurred
    expect(navigated).toBe(false)
  })
})
