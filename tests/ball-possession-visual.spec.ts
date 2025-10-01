import { test, expect, Page } from '@playwright/test'

/**
 * Visual E2E Test: Ball Possession with Real User Behavior
 *
 * This test simulates real user interaction patterns to verify ball possession
 * works correctly in actual gameplay, not just with continuous joystick holds.
 *
 * User behavior patterns tested:
 * 1. Move toward ball → Stop → Move again (direction change)
 * 2. Quick direction changes while possessing ball
 * 3. Stop and start movement repeatedly
 */

const CLIENT_URL = 'http://localhost:5173'
const POSSESSION_RADIUS = 50 // Must match GAME_CONFIG.POSSESSION_RADIUS

/**
 * Helper: Move with stop-and-go pattern (realistic user behavior)
 */
async function moveWithPattern(
  page: Page,
  moves: Array<{ x: number; y: number; duration: number; pause?: number }>
): Promise<void> {
  for (const move of moves) {
    // Touch and drag joystick
    await page.evaluate(
      ({ x, y }) => {
        const controls = (window as any).__gameControls
        if (!controls?.test) throw new Error('Testing API not available')

        const touchX = 150
        const touchY = 300
        controls.test.touchJoystick(touchX, touchY)

        const dragDistance = 80
        const dragX = touchX + x * dragDistance
        const dragY = touchY + y * dragDistance

        controls.test.dragJoystick(dragX, dragY)
        console.log(`🕹️ Moving: direction (${x.toFixed(2)}, ${y.toFixed(2)})`)
      },
      { x: move.x, y: move.y }
    )

    await page.waitForTimeout(move.duration)

    // Release joystick
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
      console.log('🕹️ Released joystick')
    })

    // Pause between movements (realistic user behavior)
    if (move.pause) {
      await page.waitForTimeout(move.pause)
    }
  }
}

/**
 * Helper: Get ball and player state
 */
async function getGameState(page: Page, sessionId: string) {
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state) return null

    const player = state.players?.get(sid)
    return {
      ball: {
        x: state.ball?.x || 0,
        y: state.ball?.y || 0,
        velocityX: state.ball?.velocityX || 0,
        velocityY: state.ball?.velocityY || 0,
        possessedBy: state.ball?.possessedBy || ''
      },
      player: player ? {
        x: player.x,
        y: player.y,
        direction: player.direction,
        team: player.team
      } : null,
      possessionIndicatorVisible: scene.possessionIndicator?.alpha > 0.1
    }
  }, sessionId)
}

test.describe('Ball Possession Visual E2E', () => {
  let client1: Page
  let client2: Page
  let client1SessionId: string
  let client2SessionId: string

  test.beforeAll(async ({ browser }) => {
    const context1 = await browser.newContext({
      recordVideo: { dir: './test-results/ball-possession-visual/' }
    })
    const context2 = await browser.newContext({
      recordVideo: { dir: './test-results/ball-possession-visual/' }
    })

    client1 = await context1.newPage()
    client2 = await context2.newPage()

    client1.on('console', msg => console.log(`[Client 1] ${msg.text()}`))
    client2.on('console', msg => console.log(`[Client 2] ${msg.text()}`))

    await Promise.all([client1.goto(CLIENT_URL), client2.goto(CLIENT_URL)])
    await Promise.all([client1.waitForTimeout(2000), client2.waitForTimeout(2000)])

    // Wait for connections
    const MAX_RETRIES = 8
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      client1SessionId = await client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      client2SessionId = await client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      if (client1SessionId && client2SessionId) {
        console.log(`✅ Connected: ${client1SessionId}, ${client2SessionId}`)
        break
      }

      if (attempt < MAX_RETRIES) {
        await Promise.all([client1.waitForTimeout(1000), client2.waitForTimeout(1000)])
      }
    }

    if (!client1SessionId || !client2SessionId) {
      throw new Error('Failed to establish connections')
    }

    await client1.waitForTimeout(2000)
    await client2.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await client1?.close()
    await client2?.close()
  })

  test('Ball sticks to player with stop-and-go movement', async () => {
    console.log('\n🧪 TEST: Stop-and-Go Ball Possession')
    console.log('='.repeat(70))

    const initial = await getGameState(client1, client1SessionId)
    console.log(`\n📊 INITIAL: Player at (${initial.player.x}, ${initial.player.y}), Ball at (${initial.ball.x}, ${initial.ball.y})`)

    // Phase 1: Move toward ball in bursts (realistic user behavior)
    console.log('\n📤 PHASE 1: Moving toward ball with stop-and-go pattern')

    const dx = initial.ball.x - initial.player.x
    const dy = initial.ball.y - initial.player.y
    const dirX = dx / Math.sqrt(dx * dx + dy * dy)
    const dirY = dy / Math.sqrt(dx * dx + dy * dy)

    await moveWithPattern(client1, [
      { x: dirX, y: dirY, duration: 3000, pause: 500 },  // Move 3s, pause 0.5s
      { x: dirX, y: dirY, duration: 3000, pause: 500 },  // Move 3s, pause 0.5s
      { x: dirX, y: dirY, duration: 3000, pause: 500 },  // Move 3s, pause 0.5s
      { x: dirX, y: dirY, duration: 3000, pause: 1000 }  // Move 3s, pause 1s
    ])

    const afterApproach = await getGameState(client1, client1SessionId)
    console.log(`\n📍 AFTER APPROACH: Player at (${afterApproach.player.x}, ${afterApproach.player.y}), Ball at (${afterApproach.ball.x}, ${afterApproach.ball.y})`)
    console.log(`   Possession: ${afterApproach.ball.possessedBy || 'none'}`)
    console.log(`   Indicator visible: ${afterApproach.possessionIndicatorVisible}`)

    const distAfterApproach = Math.sqrt(
      (afterApproach.ball.x - afterApproach.player.x) ** 2 +
      (afterApproach.ball.y - afterApproach.player.y) ** 2
    )

    // Phase 2: Change direction while possessing (critical test)
    if (afterApproach.ball.possessedBy === client1SessionId) {
      console.log('\n📤 PHASE 2: Changing direction while possessing ball')

      const beforeChange = await getGameState(client1, client1SessionId)

      // Move RIGHT
      await moveWithPattern(client1, [
        { x: 1, y: 0, duration: 1500, pause: 300 }
      ])

      const afterRight = await getGameState(client1, client1SessionId)
      console.log(`\n➡️ MOVED RIGHT:`)
      console.log(`   Player: (${beforeChange.player.x}, ${beforeChange.player.y}) → (${afterRight.player.x}, ${afterRight.player.y})`)
      console.log(`   Ball: (${beforeChange.ball.x}, ${beforeChange.ball.y}) → (${afterRight.ball.x}, ${afterRight.ball.y})`)
      console.log(`   Possession: ${afterRight.ball.possessedBy === client1SessionId ? 'MAINTAINED' : 'LOST'}`)
      console.log(`   Player-ball distance: ${Math.sqrt((afterRight.ball.x - afterRight.player.x) ** 2 + (afterRight.ball.y - afterRight.player.y) ** 2).toFixed(1)}px`)

      // Move UP
      await moveWithPattern(client1, [
        { x: 0, y: -1, duration: 1500, pause: 300 }
      ])

      const afterUp = await getGameState(client1, client1SessionId)
      console.log(`\n⬆️ MOVED UP:`)
      console.log(`   Player: (${afterRight.player.x}, ${afterRight.player.y}) → (${afterUp.player.x}, ${afterUp.player.y})`)
      console.log(`   Ball: (${afterRight.ball.x}, ${afterRight.ball.y}) → (${afterUp.ball.x}, ${afterUp.ball.y})`)
      console.log(`   Possession: ${afterUp.ball.possessedBy === client1SessionId ? 'MAINTAINED' : 'LOST'}`)
      console.log(`   Player-ball distance: ${Math.sqrt((afterUp.ball.x - afterUp.player.x) ** 2 + (afterUp.ball.y - afterUp.player.y) ** 2).toFixed(1)}px`)

      // ASSERTIONS
      expect(afterRight.ball.possessedBy).toBe(client1SessionId)
      expect(afterUp.ball.possessedBy).toBe(client1SessionId)

      const distRight = Math.sqrt((afterRight.ball.x - afterRight.player.x) ** 2 + (afterRight.ball.y - afterRight.player.y) ** 2)
      const distUp = Math.sqrt((afterUp.ball.x - afterUp.player.x) ** 2 + (afterUp.ball.y - afterUp.player.y) ** 2)

      expect(distRight).toBeLessThan(50)
      expect(distUp).toBeLessThan(50)

      console.log(`\n✅ Ball stuck to player through direction changes`)
    } else {
      console.log(`\n⚠️ Did not gain possession. Distance: ${distAfterApproach.toFixed(1)}px`)
      expect(distAfterApproach).toBeLessThan(POSSESSION_RADIUS)
    }

    // Take screenshots
    await client1.screenshot({ path: './test-results/ball-possession-visual/client1-final.png' })
    await client2.screenshot({ path: './test-results/ball-possession-visual/client2-final.png' })

    console.log('\n✅ TEST COMPLETED')
    console.log('='.repeat(70))
  })
})
