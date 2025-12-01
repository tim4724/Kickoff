import { test, expect } from './fixtures'
import { movePlayer, getPlayerPosition, disableAI, disableAutoSwitch } from './helpers/test-utils'

test.describe('Gameplay Mechanics (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 60000 })

    // Enter Single Player
    await page.evaluate(() => {
        (window as any).__menuButtons.singlePlayer.emit('pointerup');
    })
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 60000 })

    // Disable AI and AutoSwitch for deterministic testing
    await disableAI(page)
    await disableAutoSwitch(page)
  });

  test('Player movement', async ({ page }) => {
    const startPos = await getPlayerPosition(page)

    // Move Right
    await movePlayer(page, 'ArrowRight', 500)

    const endPos = await getPlayerPosition(page)

    expect(endPos.x).toBeGreaterThan(startPos.x)
    expect(endPos.y).toBeCloseTo(startPos.y, 1) // Should barely move Y
  });

})
