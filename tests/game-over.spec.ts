import { test, expect } from './fixtures'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.describe('Game Over (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToSinglePlayer(page, { disableAI: true, disableAutoSwitch: false })
  });

  test('Match ends when timer reaches zero', async ({ page }) => {
    // Set timer to 2 seconds
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.scene.gameEngine.state.matchTime = 2;
    })

    // Wait for match to end (poll instead of fixed wait — CI runners are slower)
    await page.waitForFunction(() => {
      const controls = (window as any).__gameControls
      return controls?.scene?.gameEngine?.state?.phase === 'ended'
    }, { timeout: 15000 })

    const matchEnded = await page.evaluate(() => {
        return (window as any).__gameControls.scene.matchEnded
    })
    expect(matchEnded).toBe(true)

    // Click to return to menu
    await page.click('canvas', { position: { x: 500, y: 500 } })

    await page.waitForFunction(() => (window as any).__menuLoaded === true)
  })
})
