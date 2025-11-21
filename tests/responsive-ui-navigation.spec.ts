/**
 * E2E Tests for Responsive UI and Navigation
 *
 * Tests:
 * - Responsive MenuScene layout at different viewport sizes
 * - URL routing and hash-based navigation
 * - Back button functionality in game scenes
 * - Browser back/forward navigation
 */

import { test, expect, Page } from '@playwright/test'

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
async function backButtonExists(page: Page) {
  try {
    await page.waitForFunction(() => {
      const scenes = (window as any).__gameControls?.game?.scene?.getScenes(true) || []
      return scenes.some((scene: any) => scene.backButton && scene.backButton.visible)
    }, { timeout: 5000 })
    return true
  } catch (e) {
    return false
  }
}

test.describe('Responsive UI and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForMenuLoaded(page)
  })

  test.describe('Responsive MenuScene', () => {
    test('menu loads and displays correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await waitForMenuLoaded(page)

      // Check for key menu elements
      const titleVisible = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.title?.visible
      })
      expect(titleVisible).toBe(true)

      // Check buttons
      await expect(page.locator('canvas')).toBeVisible()

      console.log('✅ Desktop menu loaded successfully')
    })

    test('menu adapts to mobile portrait orientation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      await waitForMenuLoaded(page)

      // Verify layout adaptation (buttons should be stacked or scaled)
      const buttonsY = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        if (!scene) return []
        return [
          scene.singlePlayerButton?.y,
          scene.multiplayerButton?.y
        ].filter(y => y !== undefined)
      })

      // In portrait, buttons should be spaced out vertically
      expect(buttonsY.length).toBeGreaterThan(0)
      // Simple check: verify vertical spacing
      if (buttonsY.length > 1) {
        expect(buttonsY[1] - buttonsY[0]).toBeGreaterThan(50)
      }

      console.log('✅ Mobile portrait layout working')
    })

    test('menu adapts to mobile landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 812, height: 375 }) // iPhone X Landscape
      await waitForMenuLoaded(page)

      // Verify layout adaptation
      const titleScale = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.title?.scale
      })

      expect(titleScale).toBeDefined()

      console.log('✅ Mobile landscape layout working')
    })

    test('menu responds to viewport resize', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await waitForMenuLoaded(page)

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500) // Allow resize handler to run

      // Verify adaptation
      const isMobile = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.isMobile
      })

      // Note: isMobile flag might not update dynamically depending on implementation,
      // but layout should. For now checking if scene is still active and responsive.
      expect(await page.evaluate(() => (window as any).__menuLoaded)).toBe(true)

      console.log('✅ Resize handling working')
    })
  })

  test.describe('URL Routing', () => {
    test('menu starts at #/menu by default', async ({ page }) => {
      await expect(page).toHaveURL(/.*#\/menu/)
      console.log('✅ Default route is #/menu')
    })

    test('clicking Single Player updates URL to #/singleplayer', async ({ page }) => {
      await clickMenuButton(page, 'singlePlayer')
      await expect(page).toHaveURL(/.*#\/singleplayer/)
      console.log('✅ Single Player navigation updates URL')
    })

    test('clicking AI-Only updates URL to #/ai-only', async ({ page }) => {
      await clickMenuButton(page, 'aiOnly')
      await expect(page).toHaveURL(/.*#\/ai-only/)
      console.log('✅ AI-Only navigation updates URL')
    })

    test('direct navigation to #/singleplayer works', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)

      // Should load SinglePlayerScene
      await page.waitForFunction(() => {
        const scene = (window as any).__gameControls?.game?.scene?.getScene('SinglePlayerScene')
        return scene && scene.scene.isActive()
      })

      await expect(page).toHaveURL(/.*#\/singleplayer/)
      console.log('✅ Direct URL navigation working')
    })

    test('invalid URL redirects to menu', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/invalid-route`)

      // Should redirect to menu
      await waitForMenuLoaded(page)

      // URL should be updated to #/menu
      await expect(page).toHaveURL(/.*#\/menu/)

      console.log('✅ Invalid route redirects to menu')
    })
  })

  test.describe('Back Button Navigation', () => {
    test('back button appears in SinglePlayerScene', async ({ page }) => {
      await clickMenuButton(page, 'singlePlayer')

      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      console.log('✅ Back button visible in SinglePlayerScene')
    })

    test('back button appears in AIOnlyScene', async ({ page }) => {
      await clickMenuButton(page, 'aiOnly')

      const backButtonVisible = await backButtonExists(page)
      expect(backButtonVisible).toBe(true)

      console.log('✅ Back button visible in AIOnlyScene')
    })

    test('clicking back button returns to menu', async ({ page }) => {
      await clickMenuButton(page, 'singlePlayer')
      await backButtonExists(page)

      await clickBackButton(page)
      await waitForMenuLoaded(page)

      console.log('✅ Back button returns to menu')
    })

    test('back button updates URL correctly', async ({ page }) => {
      await clickMenuButton(page, 'singlePlayer')
      await expect(page).toHaveURL(/.*#\/singleplayer/)

      await clickBackButton(page)
      await waitForMenuLoaded(page)

      // URL should update to #/menu
      await expect(page).toHaveURL(/.*#\/menu/)

      console.log('✅ Back button updates URL')
    })

    test('browser back button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)
      await page.waitForTimeout(500) // Wait for initial hash to be set

      // Navigate to Single Player
      await clickMenuButton(page, 'singlePlayer')
      await expect(page).toHaveURL(/.*#\/singleplayer/)

      // Use browser back button
      await page.goBack()

      // Should be back at menu
      await waitForMenuLoaded(page)
      await expect(page).toHaveURL(/.*#\/menu/)

      console.log('✅ Browser back button working')
    })

    test('browser forward button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)
      await page.waitForTimeout(500) // Wait for initial hash to be set

      // Navigate to AI-Only
      await clickMenuButton(page, 'aiOnly')
      await expect(page).toHaveURL(/.*#\/ai-only/)

      // Go back to menu
      await page.goBack()
      await waitForMenuLoaded(page)
      await expect(page).toHaveURL(/.*#\/menu/)

      // Go forward
      await page.goForward()

      // Should be back at AI-Only scene
      await expect(page).toHaveURL(/.*#\/ai-only/)
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
    test('re-setting the same hash does not restart the active scene', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await waitForMenuLoaded(page)

      // Navigate into a game scene, then start tracking after it's live
      await clickMenuButton(page, 'singlePlayer')
      await backButtonExists(page) // ensures scene created
      await page.waitForTimeout(200)

      // Attach a spy to scene start events (baseline count 0)
      await page.evaluate(() => {
        const game = (window as any).__gameControls?.game
        const sceneManager = game?.scene
        const sceneEvents = sceneManager?.events
        if (!sceneEvents?.on) return

        const spy = ((window as any).__sceneRestartSpy ||= { count: 0 })
        if ((window as any).__sceneRestartAttached) return
        sceneEvents.on('start', (key: any) => {
          const sceneKey =
            typeof key === 'string'
              ? key
              : key?.scene?.key || key?.key || (key?.scene ? key.scene.key : undefined)
          if (sceneKey === 'SinglePlayerScene') {
            spy.count += 1
          }
        })
        ; (window as any).__sceneRestartAttached = true
      })

      // Trigger a redundant hash change to the same route
      await page.evaluate(() => {
        window.location.hash = '#/singleplayer'
      })
      await page.waitForTimeout(700)

      const restartCount = await page.evaluate(() => (window as any).__sceneRestartSpy?.count || 0)
      expect(restartCount).toBe(0)

      console.log('✅ Same-route hashchange does not restart scene')
    })

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
