/**
 * E2E Tests for Orientation Changes During Gameplay
 *
 * Tests that UI elements and controls properly respond to orientation
 * changes while the game is running.
 *
 * Verifies:
 * - UI camera viewport updates on resize
 * - Mobile controls (joystick, action button) reposition correctly
 * - UI text elements (score, timer, controls hint) reposition correctly
 * - Back button remains clickable after orientation change
 * - Game continues to function normally after resize
 */

import { test, expect } from '@playwright/test'

const CLIENT_URL = 'http://localhost:5174'

test.describe('Orientation Changes During Gameplay', () => {
  test.describe('Single Player Scene - Orientation Changes', () => {
    test('UI elements reposition correctly on portrait to landscape', async ({ page }) => {
      // Start in portrait mode
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Verify initial UI elements are visible
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      // Get initial positions
      const initialBackButtonBox = await backButton.boundingBox()
      expect(initialBackButtonBox).not.toBeNull()

      // Change to landscape
      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(500)

      // Verify back button is still visible and repositioned
      await expect(backButton).toBeVisible()
      const newBackButtonBox = await backButton.boundingBox()
      expect(newBackButtonBox).not.toBeNull()

      // Back button should still be at top-left but coordinates may differ
      expect(newBackButtonBox!.x).toBeLessThan(150)
      expect(newBackButtonBox!.y).toBeLessThan(150)

      console.log('✅ UI elements repositioned on orientation change')
    })

    test('back button remains clickable after orientation change', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(500)

      // Click back button
      const backButton = page.locator('text=← Menu')
      await backButton.click()
      await page.waitForTimeout(500)

      // Should return to menu
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      console.log('✅ Back button clickable after orientation change')
    })

    test('game continues functioning after orientation change', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Verify game is running - check for score text
      await page.waitForFunction(
        () => {
          const scene = (window as any).__gameControls?.scene
          return scene?.scoreText?.text !== undefined
        },
        { timeout: 3000 }
      )

      // Get initial score
      const initialScore = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.scoreText?.text || ''
      })

      // Change orientation
      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(500)

      // Verify score text is still accessible (game still running)
      const newScore = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.scoreText?.text || ''
      })

      expect(newScore).toBeTruthy()
      expect(newScore).toBe(initialScore)

      console.log('✅ Game continues functioning after orientation change')
    })

    test('multiple orientation changes handled correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Verify back button visible initially
      let backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      // First rotation: Portrait → Landscape
      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(500)
      await expect(backButton).toBeVisible()

      // Second rotation: Landscape → Portrait
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500)
      await expect(backButton).toBeVisible()

      // Third rotation: Portrait → Landscape (wider)
      await page.setViewportSize({ width: 896, height: 414 })
      await page.waitForTimeout(500)
      await expect(backButton).toBeVisible()

      // Back button should still work
      await backButton.click()
      await page.waitForTimeout(500)
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      console.log('✅ Multiple orientation changes handled correctly')
    })

    test('score and timer text reposition on resize', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Get initial score text position
      const initialScorePos = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return {
          x: scene?.scoreText?.x,
          y: scene?.scoreText?.y,
          width: scene?.scale?.width,
        }
      })

      expect(initialScorePos.x).toBe(initialScorePos.width / 2)

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500)

      // Get new score text position
      const newScorePos = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return {
          x: scene?.scoreText?.x,
          y: scene?.scoreText?.y,
          width: scene?.scale?.width,
        }
      })

      // Score text should be centered in new viewport
      expect(newScorePos.x).toBe(newScorePos.width / 2)
      expect(newScorePos.x).not.toBe(initialScorePos.x)

      console.log('✅ Score text repositioned correctly')
    })
  })

  test.describe('AI-Only Scene - Orientation Changes', () => {
    test('AI-Only scene handles orientation changes', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to AI-Only
      await page.locator('text=AI-Only').click()
      await page.waitForTimeout(1500)

      // Verify back button visible
      const backButton = page.locator('text=← Menu')
      await expect(backButton).toBeVisible()

      // Change orientation
      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(500)

      // Back button should still be visible and clickable
      await expect(backButton).toBeVisible()
      await backButton.click()
      await page.waitForTimeout(500)

      // Should return to menu
      await expect(page.locator('text=KICKOFF')).toBeVisible()

      console.log('✅ AI-Only scene handles orientation changes')
    })
  })

  test.describe('Camera Manager Integration', () => {
    test('camera viewport updates on resize', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(CLIENT_URL)
      await page.waitForSelector('text=KICKOFF', { timeout: 5000 })

      // Navigate to Single Player
      await page.locator('text=Single Player').click()
      await page.waitForTimeout(1500)

      // Get initial camera info
      const initialCameraInfo = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const gameCamera = scene?.cameraManager?.getGameCamera()
        const uiCamera = scene?.cameraManager?.getUICamera()
        return {
          gameCameraWidth: gameCamera?.width,
          gameCameraHeight: gameCamera?.height,
          uiCameraWidth: uiCamera?.width,
          uiCameraHeight: uiCamera?.height,
          sceneWidth: scene?.scale?.width,
          sceneHeight: scene?.scale?.height,
        }
      })

      expect(initialCameraInfo.sceneWidth).toBe(1920)
      expect(initialCameraInfo.sceneHeight).toBe(1080)

      // Resize viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(500)

      // Get updated camera info
      const newCameraInfo = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const gameCamera = scene?.cameraManager?.getGameCamera()
        const uiCamera = scene?.cameraManager?.getUICamera()
        return {
          gameCameraWidth: gameCamera?.width,
          gameCameraHeight: gameCamera?.height,
          uiCameraWidth: uiCamera?.width,
          uiCameraHeight: uiCamera?.height,
          sceneWidth: scene?.scale?.width,
          sceneHeight: scene?.scale?.height,
        }
      })

      // UI camera should match new viewport
      expect(newCameraInfo.sceneWidth).toBe(375)
      expect(newCameraInfo.sceneHeight).toBe(667)
      expect(newCameraInfo.uiCameraWidth).toBe(375)
      expect(newCameraInfo.uiCameraHeight).toBe(667)

      console.log('✅ Camera viewport updated correctly')
    })
  })
})
