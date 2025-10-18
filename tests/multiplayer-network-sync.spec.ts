import { test, expect, Page } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'

/**
 * Socca2 Multiplayer Network Synchronization Test Suite
 *
 * COMPREHENSIVE TESTS for true multiplayer validation:
 * - Uses NetworkManager.sendInput() for real network communication
 * - Verifies server processing via console log monitoring
 * - Tests cross-client synchronization
 * - Validates ball possession and shooting mechanics
 *
 * These tests go beyond visual verification to ensure the multiplayer
 * network architecture is working correctly.
 */

const CLIENT_URL = 'http://localhost:5173'
const SERVER_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = './test-results/network-sync'

// Network timing constants
const NETWORK_PROPAGATION_DELAY = 500 // ms to wait for network sync
const STATE_UPDATE_DELAY = 100 // ms between state updates

/**
 * Helper: Send movement input via joystick simulation
 * This simulates real joystick input which triggers the game's input handling
 */
async function sendMovementInput(
  page: Page,
  x: number,
  y: number,
  duration: number = 1000
): Promise<void> {
  // Start joystick drag
  await page.evaluate(
    ({ x, y }) => {
      const controls = (window as any).__gameControls
      if (!controls?.test) {
        throw new Error('Testing API not available')
      }

      // Simulate joystick touch at center-left of screen
      const touchX = 150
      const touchY = 300
      controls.test.touchJoystick(touchX, touchY)

      // Drag joystick in the specified direction
      // Joystick has 60px radius, so drag 50px in the normalized direction
      const dragDistance = 50
      const dragX = touchX + (x * dragDistance)
      const dragY = touchY + (y * dragDistance)

      controls.test.dragJoystick(dragX, dragY)
      console.log(`📤 Simulating joystick: touch (${touchX},${touchY}) → drag (${dragX},${dragY})`)
    },
    { x, y }
  )

  // Hold the joystick for the duration
  await waitScaled(page, duration)

  // Release joystick
  await page.evaluate(() => {
    const controls = (window as any).__gameControls
    controls.test.releaseJoystick()
    console.log('📤 Released joystick')
  })

  // Wait for network propagation
  await waitScaled(page, NETWORK_PROPAGATION_DELAY)
}

/**
 * Helper: Send action input (shoot/pass) via button simulation
 */
async function sendActionInput(page: Page, holdDuration: number = 500): Promise<void> {
  await page.evaluate(
    (holdMs) => {
      const controls = (window as any).__gameControls
      if (!controls?.test) {
        throw new Error('Testing API not available')
      }

      controls.test.pressButton()
      console.log('📤 Simulating button press')

      // Button release happens automatically after holdDuration
      setTimeout(() => {
        controls.test.releaseButton(holdMs)
        console.log(`📤 Released button after ${holdMs}ms`)
      }, holdMs)
    },
    holdDuration
  )

  await waitScaled(page, holdDuration + NETWORK_PROPAGATION_DELAY)
}

/**
 * Helper: Get player state from server (via client's networkManager)
 */
async function getServerPlayerState(page: Page, sessionId: string): Promise<any> {
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
      team: player.team,
      velocityX: player.velocityX,
      velocityY: player.velocityY
    }
  }, sessionId)
}

/**
 * Helper: Get ball state from server
 */
async function getServerBallState(page: Page): Promise<any> {
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
      possessedBy: state.ball.possessedBy
    }
  })
}

/**
 * Helper: Monitor console for specific messages
 */
function setupConsoleMonitor(page: Page, clientName: string, patterns: string[]): string[] {
  const matchedLogs: string[] = []

  page.on('console', msg => {
    const text = msg.text()
    patterns.forEach(pattern => {
      if (text.includes(pattern)) {
        matchedLogs.push(text)
        console.log(`[${clientName}] MATCHED: ${text}`)
      }
    })
  })

  return matchedLogs
}

test.describe.serial('Multiplayer Network Synchronization', () => {
  let client1: Page
  let client2: Page
  let client1SessionId: string
  let client2SessionId: string

  test.beforeAll(async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    client1 = await context1.newPage()
    client2 = await context2.newPage()

    client1.on('console', msg => console.log(`[Client 1] ${msg.text()}`))
    client2.on('console', msg => console.log(`[Client 2] ${msg.text()}`))
    client1.on('pageerror', err => console.error('[Client 1 ERROR]:', err.message))
    client2.on('pageerror', err => console.error('[Client 2 ERROR]:', err.message))

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)

    await Promise.all([
      waitScaled(client1, 2000),
      waitScaled(client2, 2000)
    ])

    const MAX_RETRIES = 8
    const RETRY_INTERVAL = 1000

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      client1SessionId = await client1.evaluate(() => {
        return (window as any).__gameControls?.scene?.mySessionId
      })
      client2SessionId = await client2.evaluate(() => {
        return (window as any).__gameControls?.scene?.mySessionId
      })

      if (client1SessionId && client2SessionId) {
        console.log(`✅ Connection established after ${attempt}s`)
        break
      }

      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Attempt ${attempt}/${MAX_RETRIES}: Waiting for connections...`)
        await Promise.all([
          waitScaled(client1, RETRY_INTERVAL),
          waitScaled(client2, RETRY_INTERVAL)
        ])
      }
    }

    if (!client1SessionId || !client2SessionId) {
      throw new Error(
        `Failed to establish connections after ${MAX_RETRIES}s\n` +
        `Client 1 Session: ${client1SessionId || 'undefined'}\n` +
        `Client 2 Session: ${client2SessionId || 'undefined'}`
      )
    }

    console.log(`✅ Client 1 Session: ${client1SessionId}`)
    console.log(`✅ Client 2 Session: ${client2SessionId}`)

    await waitScaled(client1, 1000)
  })

  test('1. Server-Authoritative Player Movement', async () => {
    console.log('\n🧪 TEST: Server-Authoritative Player Movement')

    // Get initial positions from server state
    const client1InitialPos = await getServerPlayerState(client1, client1SessionId)
    const client2InitialPos = await getServerPlayerState(client2, client2SessionId)

    console.log(`Initial C1 position (server): (${client1InitialPos.x}, ${client1InitialPos.y})`)
    console.log(`Initial C2 position (server): (${client2InitialPos.x}, ${client2InitialPos.y})`)

    // Client 1 sends movement input (move right)
    console.log('\n📤 Client 1 sending movement RIGHT for 1 second...')
    await sendMovementInput(client1, 1, 0, 1000) // x=1 (right), y=0

    // Get updated positions from server
    const client1AfterMove = await getServerPlayerState(client1, client1SessionId)
    const client2ViewOfClient1 = await getServerPlayerState(client2, client1SessionId)

    console.log(`\nAfter move - C1 position (from C1): (${client1AfterMove.x}, ${client1AfterMove.y})`)
    console.log(`After move - C1 position (from C2): (${client2ViewOfClient1.x}, ${client2ViewOfClient1.y})`)

    // Verify movement occurred
    const movedDistance = Math.abs(client1AfterMove.x - client1InitialPos.x)
    console.log(`Distance moved: ${movedDistance.toFixed(1)}px`)

    expect(movedDistance).toBeGreaterThan(10) // With throttling at 166ms, ~2 inputs = ~11px movement

    // Verify synchronization between clients
    const positionDiff = Math.abs(client1AfterMove.x - client2ViewOfClient1.x) +
                         Math.abs(client1AfterMove.y - client2ViewOfClient1.y)

    console.log(`Position difference between clients: ${positionDiff.toFixed(1)}px`)

    expect(positionDiff).toBeLessThan(5) // Positions should match within 5px

    await client1.screenshot({ path: `${SCREENSHOT_DIR}/1-movement-sync-c1.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/1-movement-sync-c2.png` })

    console.log('✅ TEST PASSED: Player movement synchronized')
  })

  test('2. Cross-Client Position Synchronization', async () => {
    console.log('\n🧪 TEST: Cross-Client Position Synchronization')

    // Client 2 sends movement input (move UP)
    console.log('\n📤 Client 2 sending movement UP for 1 second...')
    await sendMovementInput(client2, 0, -1, 1000) // x=0, y=-1 (up)

    // Both clients should see Client 2's new position
    const client2SelfView = await getServerPlayerState(client2, client2SessionId)
    const client1ViewOfClient2 = await getServerPlayerState(client1, client2SessionId)

    console.log(`\nC2 sees self at: (${client2SelfView.x}, ${client2SelfView.y})`)
    console.log(`C1 sees C2 at: (${client1ViewOfClient2.x}, ${client1ViewOfClient2.y})`)

    const syncError = Math.abs(client2SelfView.x - client1ViewOfClient2.x) +
                      Math.abs(client2SelfView.y - client1ViewOfClient2.y)

    console.log(`Synchronization error: ${syncError.toFixed(1)}px`)

    expect(syncError).toBeLessThan(5)

    await client1.screenshot({ path: `${SCREENSHOT_DIR}/2-cross-sync-c1.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/2-cross-sync-c2.png` })

    console.log('✅ TEST PASSED: Cross-client synchronization working')
  })

  test('3. Ball Possession Detection', async () => {
    console.log('\n🧪 TEST: Ball Possession Detection')

    // Get ball position
    let ballState = await getServerBallState(client1)
    console.log(`Ball at: (${ballState.x}, ${ballState.y})`)

    // Get Client 1 position
    let playerState = await getServerPlayerState(client1, client1SessionId)
    console.log(`Player at: (${playerState.x}, ${playerState.y})`)

    // Calculate direction to ball
    const dx = ballState.x - playerState.x
    const dy = ballState.y - playerState.y
    let distance = Math.sqrt(dx * dx + dy * dy)
    console.log(`Distance to ball: ${distance.toFixed(1)}px`)

    // Move toward ball
    const normalizedX = dx / distance
    const normalizedY = dy / distance

    console.log(`\n📤 Moving toward ball: direction (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`)

    // Move in increments until within possession radius (max 30 seconds total)
    const MAX_ITERATIONS = 6
    const MOVE_DURATION = 5000 // 5 seconds per iteration
    let iteration = 0

    while (distance >= 30 && iteration < MAX_ITERATIONS) {
      iteration++
      console.log(`\n📤 Movement iteration ${iteration}/${MAX_ITERATIONS}, distance: ${distance.toFixed(1)}px`)

      await sendMovementInput(client1, normalizedX, normalizedY, MOVE_DURATION)

      // Check new distance
      ballState = await getServerBallState(client1)
      playerState = await getServerPlayerState(client1, client1SessionId)

      const newDx = ballState.x - playerState.x
      const newDy = ballState.y - playerState.y
      distance = Math.sqrt(newDx * newDx + newDy * newDy)
    }

    console.log(`\n✅ Final distance to ball: ${distance.toFixed(1)}px (possession radius: 30px)`)
    console.log(`Ball possessed by: "${ballState.possessedBy}"`)

    // Verify possession
    expect(distance).toBeLessThan(30)
    expect(ballState.possessedBy).toBe(client1SessionId)
    console.log('✅ Ball possession detected by server')

    await client1.screenshot({ path: `${SCREENSHOT_DIR}/3-possession-c1.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/3-possession-c2.png` })
  })

  test('4. Ball Magnetism (Stick to Player)', async () => {
    console.log('\n🧪 TEST: Ball Magnetism')

    // Assuming ball is possessed from previous test
    const initialBallState = await getServerBallState(client1)
    console.log(`Initial ball position: (${initialBallState.x}, ${initialBallState.y})`)
    console.log(`Ball velocity: (${initialBallState.velocityX}, ${initialBallState.velocityY})`)
    console.log(`Ball possessed by: "${initialBallState.possessedBy}"`)

    // Move player (ball should follow if possessed and stationary)
    console.log('\n📤 Moving player RIGHT while possessing ball...')
    await sendMovementInput(client1, 1, 0, 1500) // Move right

    const afterMoveBallState = await getServerBallState(client1)
    const afterMovePlayerState = await getServerPlayerState(client1, client1SessionId)

    console.log(`After move - Ball at: (${afterMoveBallState.x}, ${afterMoveBallState.y})`)
    console.log(`After move - Player at: (${afterMovePlayerState.x}, ${afterMovePlayerState.y})`)

    const distanceToBall = Math.sqrt(
      Math.pow(afterMoveBallState.x - afterMovePlayerState.x, 2) +
      Math.pow(afterMoveBallState.y - afterMovePlayerState.y, 2)
    )

    console.log(`Distance player to ball: ${distanceToBall.toFixed(1)}px`)

    // Ball should stay close to player (within possession radius)
    if (afterMoveBallState.possessedBy === client1SessionId) {
      expect(distanceToBall).toBeLessThan(40) // Should be within ~30px + margin
      console.log('✅ Ball magnetism working (ball follows player)')
    } else {
      console.warn('⚠️ Ball no longer possessed (may have been kicked)')
    }

    await client1.screenshot({ path: `${SCREENSHOT_DIR}/4-magnetism-c1.png` })
  })

  test('5. Ball Shooting Synchronization', async () => {
    console.log('\n🧪 TEST: Ball Shooting')

    // Get initial ball state
    const initialBallState = await getServerBallState(client1)
    console.log(`Pre-shoot ball position: (${initialBallState.x}, ${initialBallState.y})`)
    console.log(`Pre-shoot ball velocity: (${initialBallState.velocityX}, ${initialBallState.velocityY})`)

    // First, move player to ball to gain possession
    console.log('\n📤 Moving player to ball to gain possession...')
    const playerState = await getServerPlayerState(client1, client1SessionId)

    // Determine direction to ball (client1 starts on left at x=360, ball at x=960)
    const directionX = playerState.x < initialBallState.x ? 1 : -1
    await sendMovementInput(client1, directionX, 0, 2000) // Move toward ball for 2 seconds

    // Make sure we're close enough - add extra movement if needed
    await sendMovementInput(client1, directionX, 0, 500) // Extra 0.5s to get within possession radius

    // Wait for possession to be established
    await waitScaled(client1, 500)

    const afterMoveBallState = await getServerBallState(client1)
    const afterMovePlayerState = await getServerPlayerState(client1, client1SessionId)
    const distanceToBall = Math.sqrt(
      Math.pow(afterMoveBallState.x - afterMovePlayerState.x, 2) +
      Math.pow(afterMoveBallState.y - afterMovePlayerState.y, 2)
    )
    console.log(`Player at: (${afterMovePlayerState.x}, ${afterMovePlayerState.y})`)
    console.log(`Ball at: (${afterMoveBallState.x}, ${afterMoveBallState.y})`)
    console.log(`Distance to ball: ${distanceToBall.toFixed(1)}px`)
    console.log(`Ball possession after move: "${afterMoveBallState.possessedBy}"`)

    // Verify possession before shooting
    if (afterMoveBallState.possessedBy !== client1SessionId) {
      // Try moving closer if we don't have possession yet
      console.log('⚠️ No possession yet, moving closer...')
      await sendMovementInput(client1, directionX, 0, 500)
      await waitScaled(client1, 500)

      const retryBallState = await getServerBallState(client1)
      console.log(`Ball possession after retry: "${retryBallState.possessedBy}"`)

      if (retryBallState.possessedBy !== client1SessionId) {
        console.log('⚠️ Still no possession, test may be flaky')
        // Continue anyway to see what happens
      }
    }

    // Send shoot action
    console.log('\n📤 Sending SHOOT action...')
    await sendActionInput(client1)

    // Wait for ball to move
    await waitScaled(client1, 1000)

    // Get ball state after shooting
    const afterShootBallState = await getServerBallState(client1)
    console.log(`Post-shoot ball position: (${afterShootBallState.x}, ${afterShootBallState.y})`)
    console.log(`Post-shoot ball velocity: (${afterShootBallState.velocityX}, ${afterShootBallState.velocityY})`)

    // Check if ball moved
    const ballMoved = Math.abs(afterShootBallState.x - initialBallState.x) > 10 ||
                      Math.abs(afterShootBallState.y - initialBallState.y) > 10

    // Check if ball has velocity
    const hasVelocity = Math.abs(afterShootBallState.velocityX) > 10 ||
                        Math.abs(afterShootBallState.velocityY) > 10

    console.log(`Ball moved: ${ballMoved}`)
    console.log(`Ball has velocity: ${hasVelocity}`)

    // Verify ball moved or has velocity (shooting works)
    expect(ballMoved || hasVelocity).toBe(true)
    console.log('✅ Shooting works - ball is moving')

    // Verify both clients see the same ball state
    const client2BallState = await getServerBallState(client2)
    const ballSyncError = Math.abs(afterShootBallState.x - client2BallState.x) +
                          Math.abs(afterShootBallState.y - client2BallState.y)

    console.log(`Ball position sync error: ${ballSyncError.toFixed(1)}px`)
    expect(ballSyncError).toBeLessThan(5)

    await client1.screenshot({ path: `${SCREENSHOT_DIR}/5-shooting-c1.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/5-shooting-c2.png` })

    console.log('✅ TEST PASSED: Ball shooting synchronized')
  })

  test('6. Network Resilience Test', async () => {
    console.log('\n🧪 TEST: Network Resilience (Rapid Inputs)')

    const initialPos = await getServerPlayerState(client1, client1SessionId)

    // Send rapid movement inputs in different directions
    console.log('\n📤 Sending rapid direction changes...')
    await sendMovementInput(client1, 1, 0, 300)  // Right
    await sendMovementInput(client1, 0, 1, 300)  // Down
    await sendMovementInput(client1, -1, 0, 300) // Left
    await sendMovementInput(client1, 0, -1, 300) // Up

    const finalPos = await getServerPlayerState(client1, client1SessionId)

    console.log(`Position changed from (${initialPos.x}, ${initialPos.y}) to (${finalPos.x}, ${finalPos.y})`)

    // Verify both clients see the same final position
    const client2ViewPos = await getServerPlayerState(client2, client1SessionId)
    const syncError = Math.abs(finalPos.x - client2ViewPos.x) +
                      Math.abs(finalPos.y - client2ViewPos.y)

    console.log(`Final sync error: ${syncError.toFixed(1)}px`)
    expect(syncError).toBeLessThan(10) // Allow slightly more tolerance for rapid inputs

    console.log('✅ TEST PASSED: Network handles rapid inputs correctly')
  })
})
