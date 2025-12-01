import { test, expect } from './fixtures'
import { waitScaled } from './helpers/time-control'

test.describe('AI Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 30000 })
    await page.evaluate(() => (window as any).__menuButtons.singlePlayer.emit('pointerup'))
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 30000 })
    // Do NOT disable AI
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

    // Wait for AI to react
    await waitScaled(page, 1000)

    // Check AI position
    const aiPos = await page.evaluate((id) => {
        const player = (window as any).__gameControls.scene.players.get(id);
        return { x: player.x, y: player.y };
    }, aiId)

    // AI should have moved left (towards ball)
    expect(aiPos.x).toBeLessThan(startX - 10)
  })
})
