import { test, expect } from './fixtures'
import { disableAI, disableAutoSwitch, getServerState, shoot } from './helpers/test-utils'
import { waitScaled } from './helpers/time-control'

test.describe('Goal Scoring (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 60000 })
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 60000 })
    await disableAI(page)
    await disableAutoSwitch(page)
  });

  test('Score a goal and verify reset', async ({ page }) => {
    const initialState = await getServerState(page)
    expect(initialState.scoreBlue).toBe(0)

    // Teleport ball near RED goal (Right side)
    // Field is 1700×1000, so right goal is at x=1700, center y=500
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportBall(1600, 500);
        controls.test.teleportPlayer(1550, 500);
    })

    // Move to capture
    await page.keyboard.down('ArrowRight');
    await waitScaled(page, 500);
    await page.keyboard.up('ArrowRight');

    // Shoot
    await shoot(page);

    // Wait for goal processing
    await waitScaled(page, 3000)

    const goalState = await getServerState(page)
    expect(goalState.scoreBlue).toBe(1)

    // Positions should reset after delay (2000ms pause)
    await waitScaled(page, 3000)

    const resetState = await getServerState(page)
    // Ball should be at center (850, 500) for 1700×1000 field
    // Allow some variance as it might drift slightly if not perfectly reset or physics active
    expect(resetState.ball.x).toBeCloseTo(850, 10)
    expect(resetState.ball.y).toBeCloseTo(500, 10)
  })
})
