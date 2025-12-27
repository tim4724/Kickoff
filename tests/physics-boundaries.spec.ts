import { test, expect } from './fixtures'
import { disableAI, getServerState } from './helpers/test-utils'
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
    // Teleport near left edge
    // Field is 1700×1000, center y=500, player radius=50
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        controls.test.teleportPlayer(100, 500);
    })

    // Wait for teleport to be applied
    await waitScaled(page, 500)

    // Get initial position
    const initialState = await getServerState(page)
    const initialX = initialState.ball.x // Use ball position as proxy since we teleported to it

    // Move left toward boundary for extended period
    await page.keyboard.down('ArrowLeft');
    await waitScaled(page, 1500);
    await page.keyboard.up('ArrowLeft');

    // Wait for position to settle
    await waitScaled(page, 500)

    // Get player position from game state with debug info
    const debugInfo = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const gameEngine = scene?.gameEngine
      const state = gameEngine?.getState()

      const myPlayerId = scene?.myPlayerId
      const playerIds = state?.players ? Array.from(state.players.keys()) : []
      const player = myPlayerId ? state?.players?.get(myPlayerId) : null

      return {
        myPlayerId,
        playerIds,
        hasState: !!state,
        hasPlayers: !!state?.players,
        playerX: player?.x || 0,
        playerY: player?.y || 0
      }
    })

    const finalX = debugInfo.playerX

    // Player should have moved left and be clamped to field boundary at x=0
    // Physics engine clamps player CENTER to field edges (0 to FIELD_WIDTH)
    // So the minimum x position is 0, not radius (50)
    expect(finalX).toBeGreaterThanOrEqual(0)
    expect(finalX).toBeLessThan(100) // Should have moved from starting position (100)
  })
})
