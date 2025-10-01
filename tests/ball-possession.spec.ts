import { test, expect, Page } from '@playwright/test'

/**
 * Test: Ball Possession Mechanics
 *
 * OBSERVED BEHAVIOR: Yellow circle (possession indicator) appears when player
 * is near ball, but ball does NOT stick to/follow the player.
 *
 * This test verifies the EXPECTED behavior:
 * 1. Possession indicator shows when player is within POSSESSION_RADIUS
 * 2. Server assigns possession (possessedBy field set)
 * 3. Ball "magnetizes" to player and follows movement (ball sticks 25px in front)
 * 4. Ball position updates as player moves with possession
 * 5. Possession releases when player moves too far or shoots
 */

const CLIENT_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = './test-results/ball-possession'
const POSSESSION_RADIUS = 50 // Must match GAME_CONFIG.POSSESSION_RADIUS
const MAGNETISM_DISTANCE = 25 // Distance ball stays in front of player

/**
 * Helper: Move player towards ball to gain possession
 */
async function movePlayerToBall(
  page: Page,
  playerPos: { x: number; y: number },
  ballPos: { x: number; y: number },
  duration: number = 1000
): Promise<void> {
  const dx = ballPos.x - playerPos.x
  const dy = ballPos.y - playerPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist === 0) return

  // Normalize direction
  const dirX = dx / dist
  const dirY = dy / dist

  console.log(`📤 Moving ${dist.toFixed(1)}px towards ball`)

  // Touch and drag joystick at start
  await page.evaluate(
    ({ x, y }) => {
      const controls = (window as any).__gameControls
      if (!controls?.test) throw new Error('Testing API not available')

      const touchX = 150
      const touchY = 300
      controls.test.touchJoystick(touchX, touchY)

      // Maximum drag for full velocity
      const dragDistance = 80
      const dragX = touchX + x * dragDistance
      const dragY = touchY + y * dragDistance

      controls.test.dragJoystick(dragX, dragY)
      console.log(`📤 Joystick dragged to (${dragX.toFixed(1)}, ${dragY.toFixed(1)})`)
    },
    { x: dirX, y: dirY }
  )

  // Hold for entire duration to continuously apply velocity
  await page.waitForTimeout(duration)

  // Release joystick
  await page.evaluate(() => {
    const controls = (window as any).__gameControls
    controls.test.releaseJoystick()
  })

  await page.waitForTimeout(300)
}

/**
 * Helper: Get ball state from server
 */
async function getBallState(page: Page): Promise<{
  x: number
  y: number
  velocityX: number
  velocityY: number
  possessedBy: string
}> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state?.ball) return null

    return {
      x: state.ball.x,
      y: state.ball.y,
      velocityX: state.ball.velocityX,
      velocityY: state.ball.velocityY,
      possessedBy: state.ball.possessedBy || ''
    }
  })
}

/**
 * Helper: Get player state from server
 */
async function getPlayerState(page: Page, sessionId: string): Promise<{
  x: number
  y: number
  team: string
}> {
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state?.players) return null

    const player = state.players.get(sid)
    if (!player) return null

    return {
      x: player.x,
      y: player.y,
      team: player.team
    }
  }, sessionId)
}

/**
 * Helper: Check possession indicator visibility
 */
async function isPossessionIndicatorVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.possessionIndicator) return false

    return scene.possessionIndicator.alpha > 0.1
  })
}

test.describe('Ball Possession Mechanics', () => {
  let client1: Page
  let client2: Page
  let client1SessionId: string
  let client2SessionId: string

  test.beforeAll(async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    client1 = await context1.newPage()
    client2 = await context2.newPage()

    client1.on('console', msg => console.log(`[Client 1] ${msg.text()}`))
    client2.on('console', msg => console.log(`[Client 2] ${msg.text()}`))
    client1.on('pageerror', err => console.error('[Client 1 ERROR]:', err.message))
    client2.on('pageerror', err => console.error('[Client 2 ERROR]:', err.message))

    await Promise.all([client1.goto(CLIENT_URL), client2.goto(CLIENT_URL)])
    await Promise.all([client1.waitForTimeout(2000), client2.waitForTimeout(2000)])

    // Wait for connections
    const MAX_RETRIES = 8
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      client1SessionId = await client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      client2SessionId = await client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      if (client1SessionId && client2SessionId) {
        console.log(`✅ Both clients connected after ${attempt}s`)
        break
      }

      if (attempt < MAX_RETRIES) {
        await Promise.all([client1.waitForTimeout(1000), client2.waitForTimeout(1000)])
      }
    }

    if (!client1SessionId || !client2SessionId) {
      throw new Error('Failed to establish connections')
    }

    // Wait for match to start
    await client1.waitForTimeout(2000)
    await client2.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await client1?.close()
    await client2?.close()
  })

  test('Ball Possession: Indicator, Server State, and Magnetism', async () => {
    console.log('\n🧪 TEST: Ball Possession Mechanics')
    console.log('=' .repeat(70))

    // Get initial positions
    const player1Initial = await getPlayerState(client1, client1SessionId)
    const ballInitial = await getBallState(client1)

    console.log('\n📊 INITIAL STATE:')
    console.log(`  Player 1: (${player1Initial.x}, ${player1Initial.y})`)
    console.log(`  Ball: (${ballInitial.x}, ${ballInitial.y})`)
    console.log(`  Ball possessed by: ${ballInitial.possessedBy || 'none'}`)

    // Calculate distance to ball
    const dx = ballInitial.x - player1Initial.x
    const dy = ballInitial.y - player1Initial.y
    const distToBall = Math.sqrt(dx * dx + dy * dy)

    console.log(`  Distance to ball: ${distToBall.toFixed(1)}px`)

    // STEP 1: Move player towards ball to gain possession
    console.log('\n📤 STEP 1: Moving player 1 towards ball...')
    await movePlayerToBall(client1, player1Initial, ballInitial, 20000)

    // Wait for possession to register
    await client1.waitForTimeout(1000)

    // STEP 2: Check possession indicator visibility
    console.log('\n👁️ STEP 2: Checking possession indicator...')
    const indicatorVisible = await isPossessionIndicatorVisible(client1)
    console.log(`  Possession indicator visible: ${indicatorVisible}`)

    // STEP 3: Check server possession state
    console.log('\n🔍 STEP 3: Checking server possession state...')
    const ballAfterMove = await getBallState(client1)
    const player1AfterMove = await getPlayerState(client1, client1SessionId)

    console.log(`  Ball position: (${ballAfterMove.x}, ${ballAfterMove.y})`)
    console.log(`  Ball possessed by: ${ballAfterMove.possessedBy || 'none'}`)
    console.log(`  Player 1 position: (${player1AfterMove.x}, ${player1AfterMove.y})`)

    const distAfterMove = Math.sqrt(
      (ballAfterMove.x - player1AfterMove.x) ** 2 +
      (ballAfterMove.y - player1AfterMove.y) ** 2
    )
    console.log(`  Distance player-to-ball: ${distAfterMove.toFixed(1)}px`)

    // ASSERTION 1: Possession indicator shows when player is near ball
    console.log('\n✓ ASSERTION 1: Possession indicator visibility')
    if (distAfterMove < POSSESSION_RADIUS) {
      expect(indicatorVisible).toBe(true)
      console.log('  ✅ Indicator correctly shows when within possession radius')
    } else {
      console.log(`  ⚠️  Player not close enough (${distAfterMove.toFixed(1)}px > ${POSSESSION_RADIUS}px)`)
    }

    // ASSERTION 2: Server assigns possession
    console.log('\n✓ ASSERTION 2: Server possession assignment')
    expect(ballAfterMove.possessedBy).toBeTruthy()
    expect(ballAfterMove.possessedBy).toBe(client1SessionId)
    console.log(`  ✅ Server correctly assigned possession to ${client1SessionId}`)

    // ASSERTION 3: Ball "magnetizes" to player (sticks at fixed distance)
    console.log('\n✓ ASSERTION 3: Ball magnetism (ball follows player)')
    expect(distAfterMove).toBeLessThan(50) // Should be around 25px (MAGNETISM_DISTANCE)
    expect(distAfterMove).toBeGreaterThan(10) // Not exactly at player position
    console.log(`  ✅ Ball magnetized at ${distAfterMove.toFixed(1)}px from player`)

    // STEP 4: Move player with possession and verify ball follows
    console.log('\n📤 STEP 4: Moving player with possession...')

    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(200, 300) // Move right
    })

    await client1.waitForTimeout(1500)

    const player1Moving = await getPlayerState(client1, client1SessionId)
    const ballMoving = await getBallState(client1)

    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
    })

    await client1.waitForTimeout(500)

    const player1AfterMovement = await getPlayerState(client1, client1SessionId)
    const ballAfterMovement = await getBallState(client1)

    console.log(`  Player moved from (${player1AfterMove.x}, ${player1AfterMove.y}) to (${player1AfterMovement.x}, ${player1AfterMovement.y})`)
    console.log(`  Ball moved from (${ballAfterMove.x}, ${ballAfterMove.y}) to (${ballAfterMovement.x}, ${ballAfterMovement.y})`)

    const playerMovedX = Math.abs(player1AfterMovement.x - player1AfterMove.x)
    const ballMovedX = Math.abs(ballAfterMovement.x - ballAfterMove.x)

    console.log(`  Player X movement: ${playerMovedX.toFixed(1)}px`)
    console.log(`  Ball X movement: ${ballMovedX.toFixed(1)}px`)

    // ASSERTION 4: Ball follows player movement
    console.log('\n✓ ASSERTION 4: Ball follows player movement')
    expect(ballAfterMovement.possessedBy).toBe(client1SessionId)
    expect(playerMovedX).toBeGreaterThan(10) // Player should have moved
    expect(ballMovedX).toBeGreaterThan(5) // Ball should have moved with player

    const distDuringMovement = Math.sqrt(
      (ballAfterMovement.x - player1AfterMovement.x) ** 2 +
      (ballAfterMovement.y - player1AfterMovement.y) ** 2
    )
    expect(distDuringMovement).toBeLessThan(50) // Ball stays close to player
    console.log(`  ✅ Ball followed player, maintaining ${distDuringMovement.toFixed(1)}px distance`)

    // ASSERTION 5: Ball velocity is zero while possessed
    console.log('\n✓ ASSERTION 5: Ball velocity while possessed')
    expect(ballAfterMovement.velocityX).toBe(0)
    expect(ballAfterMovement.velocityY).toBe(0)
    console.log('  ✅ Ball velocity is zero (moves with player, not independently)')

    // Take screenshots for visual verification
    await client1.screenshot({ path: `${SCREENSHOT_DIR}/possession-client1.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/possession-client2.png` })

    console.log('\n✅ TEST PASSED: Ball possession mechanics working correctly')
    console.log('=' .repeat(70))
  })
})
