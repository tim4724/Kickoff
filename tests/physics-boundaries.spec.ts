import { test, expect } from './fixtures'
import { getPlayerPosition, disableAI, getServerState } from './helpers/test-utils'
import { waitScaled } from './helpers/time-control'

test.describe('Physics Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 30000 })
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 30000 })
    await disableAI(page)
  });

  test.skip('Player constrained by field boundaries', async ({ page }) => {
    // Get the player ID for server state lookup
    const myPlayerId = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.myPlayerId || ''
    })

    // Teleport near left edge
    // Field is 1700×1000, center y=500, player radius=50
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportPlayer(100, 500);
    })

    // Wait for teleport to be applied
    await waitScaled(page, 300)

    // Move left toward boundary
    await page.keyboard.down('ArrowLeft');
    await waitScaled(page, 1000);
    await page.keyboard.up('ArrowLeft');

    // Wait for position to settle
    await waitScaled(page, 300)

    // Get player position from server state
    const playerX = await page.evaluate((playerId) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState() || scene?.gameEngine?.getState()
      const player = state?.players?.get(playerId)
      return player?.x || 0
    }, myPlayerId)

    // Should be clamped to player radius (50)
    // Player center should not go below radius
    expect(playerX).toBeGreaterThan(40)
  })
})
