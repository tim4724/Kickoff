/**
 * E2E Tests for Responsive UI and Navigation
 *
 * Tests:
 * - Responsive MenuScene layout at different viewport sizes
 * - URL routing and hash-based navigation
 * - Back button functionality in game scenes
 * - Browser back/forward navigation
 */

import { test, expect } from '@playwright/test'

const CLIENT_URL = 'http://localhost:5174'

/**
 * Wait for MenuScene to load by checking the window.__menuLoaded flag
 * This is more reliable than waitForSelector('text=KICKOFF') since Phaser text is rendered in canvas
 */
async function waitForMenuLoaded(page: any, timeout = 10000) {
  await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout })
}

/**
 * Click a menu button by name using coordinates
 * Phaser canvas buttons can't be clicked via text selectors, so we use coordinates instead
 */
async function clickMenuButton(page: any, buttonName: 'singlePlayer' | 'multiplayer' | 'aiOnly') {
  const button = await page.evaluate((name: string) => {
    return (window as any).__menuButtons?.[name]
  }, buttonName)

  if (!button) {
    throw new Error(`Menu button "${buttonName}" not found in window.__menuButtons`)
  }

  // Click the center of the button
  await page.mouse.click(button.x, button.y)
}

/**
 * Click the back button in game scenes
 * Back button is a canvas element at coordinates (10, 10) with size 100x40
 */
async function clickBackButton(page: any) {
  // Click center of back button (at 10,10 with 100x40 size)
  await page.mouse.click(60, 30)
}

/**
 * Check if back button exists in current scene
 * Back button is canvas-rendered so we check via game scene API
 */
async function backButtonExists(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.backButton !== undefined && scene?.backButton !== null
  })
}

test.describe('Responsive UI and Navigation', () => {

  test.describe('Responsive MenuScene', () => {

    test('menu loads and displays correctly on desktop', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })

      // Wait for menu to load
      await waitForMenuLoaded(page)

      // Verify all buttons exist in __menuButtons API (canvas-rendered buttons)
      const buttons = await page.evaluate(() => (window as any).__menuButtons)
      expect(buttons).toBeDefined()
      expect(buttons.singlePlayer).toBeDefined()
      expect(buttons.multiplayer).toBeDefined()
      expect(buttons.aiOnly).toBeDefined()

      console.log('✅ Desktop menu loaded successfully')
    })

    test('menu adapts to mobile portrait orientation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)

      // Wait for menu to load
      await waitForMenuLoaded(page)

      // Verify buttons exist and are positioned within viewport (canvas-rendered)
      const button = await page.evaluate(() => {
        const btn = (window as any).__menuButtons?.singlePlayer
        return btn ? { x: btn.x, y: btn.y } : null
      })

      expect(button).not.toBeNull()
      expect(button.x).toBeGreaterThanOrEqual(0)
      expect(button.x).toBeLessThanOrEqual(375)

      console.log('✅ Mobile portrait layout working')
    })

    test('menu adapts to mobile landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 })
      await page.goto(CLIENT_URL)

      await waitForMenuLoaded(page)

      // Verify all buttons exist in __menuButtons API (canvas-rendered)
      const buttons = await page.evaluate(() => (window as any).__menuButtons)
      expect(buttons).toBeDefined()
      expect(buttons.singlePlayer).toBeDefined()
      expect(buttons.multiplayer).toBeDefined()

      console.log('✅ Mobile landscape layout working')
    })

    test('menu responds to viewport resize', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })
      await waitForMenuLoaded(page)

      // Get initial button position from canvas
      const initialPos = await page.evaluate(() => {
        return (window as any).__menuButtons?.singlePlayer
      })

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(1000) // Wait longer for resize to apply and buttons to reposition

      // Get new button position
      const newPos = await page.evaluate(() => {
        return (window as any).__menuButtons?.singlePlayer
      })

      expect(newPos).toBeDefined()
      // Position should have changed after resize
      // Use a range check since exact pixel positions may vary
      const yDiff = Math.abs(newPos.y - initialPos.y)
      expect(yDiff).toBeGreaterThan(10) // Should move by at least 10px

      console.log('✅ Resize handling working')
    })
  })

  test.describe('URL Routing', () => {

    test('menu starts at #/menu by default', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Wait for router to set hash
      await page.waitForTimeout(500)

      // Check URL hash
      const url = page.url()
      expect(url).toContain('#/menu')

      console.log('✅ Default route is #/menu')
    })

    test('clicking Single Player updates URL to #/singleplayer', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Click Single Player button
      await clickMenuButton(page, 'singlePlayer')

      // Wait for URL to update
      await page.waitForTimeout(500)

      // Verify URL changed
      const url = page.url()
      expect(url).toContain('#/singleplayer')

      console.log('✅ Single Player navigation updates URL')
    })

    test('clicking AI-Only updates URL to #/ai-only', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Click AI-Only button
      await clickMenuButton(page, 'aiOnly')

      // Wait for URL to update
      await page.waitForTimeout(500)

      // Verify URL changed
      const url = page.url()
      expect(url).toContain('#/ai-only')

      console.log('✅ AI-Only navigation updates URL')
    })

    test('direct navigation to #/singleplayer works', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)

      // Wait for scene to load (no menu should be visible)
      await page.waitForTimeout(1000)

      // Menu should NOT be loaded (we're in game scene)
      const menuLoaded = await page.evaluate(() => (window as any).__menuLoaded)
      expect(menuLoaded).toBeFalsy()

      // URL should still have the hash
      expect(page.url()).toContain('#/singleplayer')

      console.log('✅ Direct URL navigation working')
    })

    test('invalid URL redirects to menu', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/invalid-route`)

      // Should redirect to menu
      await waitForMenuLoaded(page)

      // URL should be updated to #/menu
      await page.waitForTimeout(500)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Invalid route redirects to menu')
    })
  })

  test.describe('Back Button Navigation', () => {

    test('back button appears in SinglePlayerScene', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)

      // Verify back button exists via game scene (canvas-rendered)
      const backButtonExists = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.backButton !== undefined && scene?.backButton !== null
      })
      expect(backButtonExists).toBe(true)

      console.log('✅ Back button visible in SinglePlayerScene')
    })

    test('back button appears in AIOnlyScene', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate to AI-Only
      await clickMenuButton(page, 'aiOnly')
      await page.waitForTimeout(1000)

      // Verify back button exists via game scene (canvas-rendered)
      const backButtonExists = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.backButton !== undefined && scene?.backButton !== null
      })
      expect(backButtonExists).toBe(true)

      console.log('✅ Back button visible in AIOnlyScene')
    })

    test('clicking back button returns to menu', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)

      // Click back button (canvas element at top-left: 10, 10)
      await page.mouse.click(60, 30) // Center of 100x40 button at (10,10)
      await page.waitForTimeout(500)

      // Should be back at menu
      await waitForMenuLoaded(page)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button returns to menu')
    })

    test('back button updates URL correctly', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Verify we're at singleplayer
      expect(page.url()).toContain('#/singleplayer')

      // Click back button
      await clickBackButton(page)
      await page.waitForTimeout(500)

      // URL should update to menu
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button updates URL')
    })

    test('browser back button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)
      await page.waitForTimeout(500) // Wait for initial hash to be set

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/singleplayer')

      // Use browser back button
      await page.goBack()
      await page.waitForTimeout(1000)

      // Should be back at menu
      await waitForMenuLoaded(page)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Browser back button working')
    })

    test('browser forward button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)
      await page.waitForTimeout(500) // Wait for initial hash to be set

      // Navigate to AI-Only
      await clickMenuButton(page, 'aiOnly')
      await page.waitForTimeout(1000)

      // Go back to menu
      await page.goBack()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/menu')

      // Go forward
      await page.goForward()
      await page.waitForTimeout(1000)

      // Should be back at AI-Only scene
      expect(page.url()).toContain('#/ai-only')
      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      console.log('✅ Browser forward button working')
    })

    test('back button works after viewport resize', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })
      await waitForMenuLoaded(page)

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)

      // Resize viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500)

      // Back button should still be visible and clickable
      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      // Click it
      await clickBackButton(page)
      await page.waitForTimeout(500)

      // Should return to menu
      await waitForMenuLoaded(page)

      console.log('✅ Back button works after resize')
    })

    test('back button clicks do not activate joystick (mobile)', async ({ page }) => {
      // Set mobile viewport to trigger mobile controls
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)

      // Verify back button exists
      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      // Click back button and verify it returns to menu (not blocked by joystick)
      await clickBackButton(page)
      await page.waitForTimeout(500)

      // Should be back at menu (confirms back button click worked)
      await waitForMenuLoaded(page)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button not blocked by joystick')
    })

    test('back button touch events work correctly in top-left corner', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Back button should be visible at (10, 10)
      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      // Click at back button coordinates (mouse click simulates touch interaction)
      await page.mouse.click(60, 30) // Center of back button (10 + 100/2, 10 + 40/2)
      await page.waitForTimeout(500)

      // Should return to menu (not activate joystick)
      await waitForMenuLoaded(page)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Touch events in top-left corner work for back button')
    })
  })

  test.describe('Scene Overlap Prevention', () => {

    test('only one scene active at a time - menu to game', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Verify menu is visible
      await waitForMenuLoaded(page)

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)

      // Menu should NOT be visible anymore (scene switched properly)
      await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 5000 })

      // Back button should be visible (we're in game scene)
      expect(await backButtonExists(page)).toBe(true)

      console.log('✅ No scene overlap when navigating menu to game')
    })

    test('only one scene active at a time - game to menu', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Back button should be visible (we're in game scene)
      expect(await backButtonExists(page)).toBe(true)

      // Menu should NOT be visible
      await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 5000 })

      // Click back to menu
      await clickBackButton(page)

      // Menu should be visible
      await waitForMenuLoaded(page)

      // Wait a bit longer for scene shutdown to complete
      await page.waitForTimeout(500)

      // Back button should NOT be visible anymore
      expect(await backButtonExists(page)).toBe(false)

      console.log('✅ No scene overlap when navigating game to menu')
    })

    test('rapid scene transitions handle correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Rapidly navigate between scenes
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(200)
      await clickBackButton(page)
      await page.waitForTimeout(200)
      await clickMenuButton(page, 'aiOnly')
      await page.waitForTimeout(200)
      await clickBackButton(page)
      await page.waitForTimeout(500)

      // Should end up at menu with no overlapping scenes
      await waitForMenuLoaded(page)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Rapid transitions handle correctly without overlap')
    })

    test('browser back/forward does not cause scene overlap', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate forward to game
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)
      expect(await backButtonExists(page)).toBe(true)
      await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 5000 })

      // Browser back to menu
      await page.goBack()
      await page.waitForTimeout(1000)
      await waitForMenuLoaded(page)
      expect(await backButtonExists(page)).toBe(false)

      // Browser forward to game
      await page.goForward()
      await page.waitForTimeout(1000)
      expect(await backButtonExists(page)).toBe(true)
      await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 5000 })

      console.log('✅ Browser navigation does not cause scene overlap')
    })
  })

  test.describe('Integration Tests', () => {

    test('complete navigation flow', async ({ page }) => {
      // Start at menu
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)
      await page.waitForTimeout(500) // Wait for initial hash to be set
      expect(page.url()).toContain('#/menu')

      // Go to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/singleplayer')

      // Go back to menu
      await clickBackButton(page)
      await page.waitForTimeout(500)
      expect(page.url()).toContain('#/menu')

      // Go to AI-Only
      await clickMenuButton(page, 'aiOnly')
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/ai-only')

      // Use browser back to return to menu
      await page.goBack()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Complete navigation flow working')
    })
  })
})
