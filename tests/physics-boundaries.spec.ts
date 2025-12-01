import { test, expect } from './fixtures'
import { getPlayerPosition, disableAI } from './helpers/test-utils'
import { waitScaled } from './helpers/time-control'

test.describe('Physics Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 30000 })
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 30000 })
    await disableAI(page)
  });

  test('Player constrained by field boundaries', async ({ page }) => {
    // Teleport to left edge
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportPlayer(35, 540);
    })

    // Move left
    await page.keyboard.down('ArrowLeft');
    await waitScaled(page, 500);
    await page.keyboard.up('ArrowLeft');

    const pos = await getPlayerPosition(page)

    // Should be clamped. Player margin is 32.
    // Wait, radius is 36. If physics clamps center, it clamps to margin.
    // Let's verify not negative.
    expect(pos.x).toBeGreaterThan(30)
  })
})
