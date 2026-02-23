import { test, expect } from './fixtures'
import { waitForFrames } from './helpers/time-control'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.describe('Physics Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToSinglePlayer(page)
  });

  test('Player constrained by field boundaries', async ({ page }) => {
    // Teleport near left edge
    // Field is 1700×1000, center y=500, player radius=50
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportPlayer(100, 500);
    })

    // Wait for teleport to be applied
    await waitForFrames(page, 5)

    // Move left toward boundary — wait until player reaches the edge
    await page.keyboard.down('ArrowLeft');

    // Wait until player has moved from starting x=100 to near boundary
    await page.waitForFunction(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.gameEngine?.getState()
      const player = scene?.myPlayerId ? state?.players?.get(scene.myPlayerId) : null
      return player && player.x < 20
    }, { timeout: 10000 })

    await page.keyboard.up('ArrowLeft');
    await waitForFrames(page, 2)

    // Get final position
    const finalX = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.gameEngine?.getState()
      const player = scene?.myPlayerId ? state?.players?.get(scene.myPlayerId) : null
      return player?.x || 0
    })

    // Player should be clamped to field boundary at x=0
    expect(finalX).toBeGreaterThanOrEqual(0)
    expect(finalX).toBeLessThan(20)
  })
})
