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

test.describe('Responsive UI and Navigation', () => {

  test.describe('Responsive MenuScene', () => {

    test('menu loads and displays correctly on desktop', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })

      // Wait for menu to load
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Verify all buttons are visible
      await expect(page.locator('text=Single Player')).toBeVisible()
      await expect(page.locator('text=Multiplayer')).toBeVisible()
      await expect(page.locator('text=AI-Only')).toBeVisible()

      console.log('✅ Desktop menu loaded successfully')
    })

    test('menu adapts to mobile portrait orientation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)

      // Wait for menu to load
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Verify buttons are still visible and clickable
      const singlePlayerBtn = page.locator('text=Single Player')
      await expect(singlePlayerBtn).toBeVisible()

      // Check that button is within viewport
      const box = await singlePlayerBtn.boundingBox()
      expect(box).not.toBeNull()
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(375)
      }

      console.log('✅ Mobile portrait layout working')
    })

    test('menu adapts to mobile landscape orientation', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 })
      await page.goto(CLIENT_URL)

      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Verify all buttons are visible
      await expect(page.locator('text=Single Player')).toBeVisible()
      await expect(page.locator('text=Multiplayer')).toBeVisible()

      console.log('✅ Mobile landscape layout working')
    })

    test('menu responds to viewport resize', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Get initial button position
      const button = page.locator('text=Single Player')
      const initialBox = await button.boundingBox()

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500) // Wait for resize to apply

      // Verify button repositioned
      const newBox = await button.boundingBox()
      expect(newBox).not.toBeNull()

      // Position should have changed
      expect(newBox?.y).not.toBe(initialBox?.y)

      console.log('✅ Resize handling working')
    })
  })

  test.describe('URL Routing', () => {

    test('menu starts at #/menu by default', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Check URL hash
      const url = page.url()
      expect(url).toContain('#/menu')

      console.log('✅ Default route is #/menu')
    })

    test('clicking Single Player updates URL to #/singleplayer', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Click Single Player button
      await page.locator('text=Single Player').click()

      // Wait for URL to update
      await page.waitForTimeout(500)

      // Verify URL changed
      const url = page.url()
      expect(url).toContain('#/singleplayer')

      console.log('✅ Single Player navigation updates URL')
    })

    test('clicking AI-Only updates URL to #/ai-only', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Click AI-Only button
      await page.locator('text=AI-Only').click()

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

      // Menu title should NOT be visible (we're in game scene)
      const menuTitle = page.locator('text=KICKOFF')
      await expect(menuTitle).not.toBeVisible()

      // URL should still have the hash
      expect(page.url()).toContain('#/singleplayer')

      console.log('✅ Direct URL navigation working')
    })

    test('invalid URL redirects to menu', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/invalid-route`)

      // Should redirect to menu
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // URL should be updated to #/menu
      await page.waitForTimeout(500)
      expect(page.url()).toContain('#/menu')

      console.log('✅ Invalid route redirects to menu')
    })
  })

  test.describe('Back Button Navigation', () => {

    test('back button appears in SinglePlayerScene', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)

      // Look for back button (← Menu)
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      console.log('✅ Back button visible in SinglePlayerScene')
    })

    test('back button appears in AIOnlyScene', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to AI-Only
      await page.locator('text=AI-Only').click()
      await page.waitForTimeout(1000)

      // Look for back button
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      console.log('✅ Back button visible in AIOnlyScene')
    })

    test('clicking back button returns to menu', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)

      // Click back button
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(500)

      // Should be back at menu
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button returns to menu')
    })

    test('back button updates URL correctly', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Verify we're at singleplayer
      expect(page.url()).toContain('#/singleplayer')

      // Click back button
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(500)

      // URL should update to menu
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button updates URL')
    })

    test('browser back button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/singleplayer')

      // Use browser back button
      await page.goBack()
      await page.waitForTimeout(1000)

      // Should be back at menu
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      expect(page.url()).toContain('#/menu')

      console.log('✅ Browser back button working')
    })

    test('browser forward button navigates correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to AI-Only
      await page.locator('text=AI-Only').click()
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
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      console.log('✅ Browser forward button working')
    })

    test('back button works after viewport resize', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)

      // Resize viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500)

      // Back button should still be visible and clickable
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      // Click it
      await backButton.click()
      await page.waitForTimeout(500)

      // Should return to menu
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      console.log('✅ Back button works after resize')
    })

    test('back button clicks do not activate joystick (mobile)', async ({ page }) => {
      // Set mobile viewport to trigger mobile controls
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)

      // Get back button position
      const backButton = page.locator('text=← Menu')
      const buttonBox = await backButton.boundingBox()
      expect(buttonBox).not.toBeNull()

      // Click back button and verify it returns to menu (not blocked by joystick)
      await backButton.click()
      await page.waitForTimeout(500)

      // Should be back at menu (confirms back button click worked)
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      expect(page.url()).toContain('#/menu')

      console.log('✅ Back button not blocked by joystick')
    })

    test('back button touch events work correctly in top-left corner', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Back button should be visible at (10, 10)
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      // Touch at back button coordinates (simulate mobile touch)
      await page.touchscreen.tap(60, 30) // Center of back button (10 + 100/2, 10 + 40/2)
      await page.waitForTimeout(500)

      // Should return to menu (not activate joystick)
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      expect(page.url()).toContain('#/menu')

      console.log('✅ Touch events in top-left corner work for back button')
    })
  })

  test.describe('Scene Overlap Prevention', () => {

    test('only one scene active at a time - menu to game', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Verify menu is visible
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)

      // Menu should NOT be visible anymore (scene switched properly)
      await expect(page.locator('text=KICKOFF')).not.toBeVisible()

      // Back button should be visible (we're in game scene)
      await expect(page.locator('text=← Menu')).toBeVisible()

      console.log('✅ No scene overlap when navigating menu to game')
    })

    test('only one scene active at a time - game to menu', async ({ page }) => {
      await page.goto(`${CLIENT_URL}#/singleplayer`)
      await page.waitForTimeout(1000)

      // Back button should be visible (we're in game scene)
      await expect(page.locator('text=← Menu')).toBeVisible()

      // Menu should NOT be visible
      await expect(page.locator('text=KICKOFF')).not.toBeVisible()

      // Click back to menu
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(500)

      // Menu should be visible
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      // Back button should NOT be visible anymore
      await expect(page.locator('text=← Menu')).not.toBeVisible()

      console.log('✅ No scene overlap when navigating game to menu')
    })

    test('rapid scene transitions handle correctly', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Rapidly navigate between scenes
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(200)
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(200)
      await page.locator('text=AI-Only').click()
      await page.waitForTimeout(200)
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(500)

      // Should end up at menu with no overlapping scenes
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      expect(page.url()).toContain('#/menu')

      console.log('✅ Rapid transitions handle correctly without overlap')
    })

    test('browser back/forward does not cause scene overlap', async ({ page }) => {
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate forward to game
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)
      await expect(page.locator('text=← Menu')).toBeVisible()
      await expect(page.locator('text=KICKOFF')).not.toBeVisible()

      // Browser back to menu
      await page.goBack()
      await page.waitForTimeout(1000)
      await expect(page.locator('text=KICKOFF')).toBeVisible()
      await expect(page.locator('text=← Menu')).not.toBeVisible()

      // Browser forward to game
      await page.goForward()
      await page.waitForTimeout(1000)
      await expect(page.locator('text=← Menu')).toBeVisible()
      await expect(page.locator('text=KICKOFF')).not.toBeVisible()

      console.log('✅ Browser navigation does not cause scene overlap')
    })
  })

  test.describe('Integration Tests', () => {

    test('complete navigation flow', async ({ page }) => {
      // Start at menu
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })
      expect(page.url()).toContain('#/menu')

      // Go to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('#/singleplayer')

      // Go back to menu
      await page.locator('text=← Menu').click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain('#/menu')

      // Go to AI-Only
      await page.locator('text=AI-Only').click()
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
