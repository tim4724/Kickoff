import { test, expect } from './fixtures'
import { getServerState, shoot } from './helpers/test-utils'
import { waitForFrames } from './helpers/time-control'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.describe('Goal Scoring (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToSinglePlayer(page)
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
    await waitForFrames(page, 30)
    await page.keyboard.up('ArrowRight');

    // Shoot
    await shoot(page);

    // Wait for goal to register
    await page.waitForFunction(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.gameEngine?.getState()
      return state?.scoreBlue === 1
    }, { timeout: 10000 })

    const goalState = await getServerState(page)
    expect(goalState.scoreBlue).toBe(1)

    // Wait for ball to reset to center after goal pause
    await page.waitForFunction(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.gameEngine?.getState()
      if (!state?.ball) return false
      const dx = state.ball.x - 850
      const dy = state.ball.y - 500
      return Math.sqrt(dx * dx + dy * dy) < 50
    }, { timeout: 10000 })

    const resetState = await getServerState(page)
    expect(resetState.ball.x).toBeCloseTo(850, 10)
    expect(resetState.ball.y).toBeCloseTo(500, 10)
  })
})
