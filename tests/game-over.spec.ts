import { test, expect } from './fixtures'
import { disableAI, getServerState } from './helpers/test-utils'
import { waitScaled } from './helpers/time-control'

test.describe('Game Over (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 30000 })
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 30000 })
    await disableAI(page)
  });

  test('Match ends when timer reaches zero', async ({ page }) => {
    // Set timer to 2 seconds
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.scene.gameEngine.state.matchTime = 2;
    })

    // Wait for match end
    await waitScaled(page, 3000)

    // Check if phase is ended
    const state = await getServerState(page)
    expect(state.phase).toBe('ended')

    const matchEnded = await page.evaluate(() => {
        return (window as any).__gameControls.scene.matchEnded
    })
    expect(matchEnded).toBe(true)

    // Click to return to menu
    await page.click('canvas', { position: { x: 500, y: 500 } })

    await page.waitForFunction(() => (window as any).__menuLoaded === true)
  })
})
