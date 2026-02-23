import { test, expect } from './fixtures'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.describe('AI Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Keep AI enabled for this test
    await navigateToSinglePlayer(page, { disableAI: false, disableAutoSwitch: false })
  });

  test('AI player moves towards ball', async ({ page }) => {
    // Target Red Forward (player2-p1)
    const aiId = 'player2-p1'
    const ballX = 1000
    const ballY = 540
    const startX = ballX + 200

    // Teleport ball and AI
    await page.evaluate(({ id, bx, by, px }) => {
        const controls = (window as any).__gameControls;
        controls.test.teleportBall(bx, by);
        controls.test.teleportPlayer(px, by, id); // Place AI to the right
    }, { id: aiId, bx: ballX, by: ballY, px: startX })

    // Wait for AI to move toward ball (condition-based, no arbitrary frame count)
    await page.waitForFunction(
      ({ id, threshold }) => {
        const player = (window as any).__gameControls?.scene?.players?.get(id)
        return player && player.x < threshold
      },
      { id: aiId, threshold: startX - 10 },
      { timeout: 10000 }
    )

    const aiPos = await page.evaluate((id) => {
        const player = (window as any).__gameControls.scene.players.get(id);
        return { x: player.x, y: player.y };
    }, aiId)

    expect(aiPos.x).toBeLessThan(startX - 10)
  })
})
