import { test, expect } from './fixtures'
import { disableAI, disableAutoSwitch, getServerState } from './helpers/test-utils'
import { waitScaled } from './helpers/time-control'

test.describe('Goal Scoring (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true)
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene')
    await disableAI(page)
    await disableAutoSwitch(page)
  });

  test('Score a goal and verify reset', async ({ page }) => {
    const initialState = await getServerState(page)
    expect(initialState.scoreBlue).toBe(0)

    // Teleport ball near RED goal (Right side)
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportBall(1800, 540);
        // Give velocity towards goal
        controls.scene.gameEngine.state.ball.velocityX = 1000;
    })

    // Wait for goal processing
    await waitScaled(page, 1000)

    const goalState = await getServerState(page)
    expect(goalState.scoreBlue).toBe(1)

    // Positions should reset after delay (2000ms pause)
    await waitScaled(page, 3000)

    const resetState = await getServerState(page)
    // Ball should be at center (960, 540)
    // Allow some variance as it might drift slightly if not perfectly reset or physics active
    expect(resetState.ball.x).toBeCloseTo(960, 10)
    expect(resetState.ball.y).toBeCloseTo(540, 10)
  })
})
