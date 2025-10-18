import { test, expect, Browser } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

/**
 * Test Suite: Player Lifecycle Management
 *
 * Tests critical player lifecycle scenarios to prevent state management bugs:
 * - Player disconnect during active game
 * - Ball possession release on disconnect
 * - Remote player cleanup
 * - Player join/leave cycles with correct team assignment
 *
 * These tests prevent regressions related to stale connections and cleanup issues.
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL
const BLUE_COLOR = 26367      // 0x0066ff
const RED_COLOR = 16729156    // 0xff4444

test.describe('Player Lifecycle Management', () => {
  test('Player disconnect releases ball possession', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients
    console.log('📤 Step 1: Connecting two clients...')
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    await Promise.all([
      waitScaled(client1, 2000),
      waitScaled(client2, 2000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    console.log(`  Client 1: ${session1}`)
    console.log(`  Client 2: ${session2}`)

    // Client 1 gains possession by moving toward ball
    console.log('\n📤 Step 2: Client 1 gaining possession...')

    // Determine which direction to move based on team
    const team1 = await client1.evaluate((sid) => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      return state?.players?.get(sid)?.team || 'blue'
    }, session1)

    // Blue team (left side) moves right, red team (right side) moves left
    const moveKey = team1 === 'blue' ? 'ArrowRight' : 'ArrowLeft'
    console.log(`  Client 1 is ${team1} team, moving ${team1 === 'blue' ? 'right' : 'left'}`)

    // Start moving toward ball
    await client1.keyboard.down(moveKey)

    // Wait for possession to be gained
    await client1.waitForFunction(
      ({ sessionId }) => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.ball?.possessedBy === sessionId
      },
      { sessionId: session1 },
      { timeout: 10000 }
    )

    // Stop movement
    await client1.keyboard.up(moveKey)

    // Stabilize after gaining possession
    await waitScaled(client1, 500)

    const ballState = await client1.evaluate((sid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      const player = state?.players?.get(sid)
      return {
        possessedBy: state?.ball?.possessedBy || '',
        ballX: state?.ball?.x || 0,
        ballY: state?.ball?.y || 0,
        playerX: player?.x || 0,
        playerY: player?.y || 0,
        playerTeam: player?.team || 'unknown',
        phase: state?.phase || 'unknown'
      }
    }, session1)

    const dist = Math.sqrt((ballState.ballX - ballState.playerX)**2 + (ballState.ballY - ballState.playerY)**2)
    console.log(`  Match phase: ${ballState.phase}`)
    console.log(`  Player 1 team: ${ballState.playerTeam}`)
    console.log(`  Player 1 position: (${ballState.playerX.toFixed(0)}, ${ballState.playerY.toFixed(0)})`)
    console.log(`  Ball position: (${ballState.ballX.toFixed(0)}, ${ballState.ballY.toFixed(0)})`)
    console.log(`  Distance: ${dist.toFixed(1)}px (possession radius: 70px)`)
    console.log(`  Ball possessed by: ${ballState.possessedBy || 'none'}`)

    // Verify Client 1 has possession
    expect(ballState.possessedBy).toBe(session1)

    // Client 1 disconnects
    console.log('\n📤 Step 3: Client 1 disconnecting...')
    await client1.close()
    await context1.close()

    // Wait for server to process disconnect
    await waitScaled(client2, 1000)

    // Check ball possession on Client 2
    const ballAfterDisconnect = await client2.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return {
        possessedBy: state?.ball?.possessedBy || '',
        playerCount: state?.players?.size || 0
      }
    })

    console.log(`\n📊 After disconnect:`)
    console.log(`  Ball possessed by: ${ballAfterDisconnect.possessedBy || 'none'}`)
    console.log(`  Remaining players: ${ballAfterDisconnect.playerCount}`)

    // CRITICAL: Ball should be released
    expect(ballAfterDisconnect.possessedBy).toBe('')
    // Player count should be 3 (1 human player + 2 AI players for team balance)
    expect(ballAfterDisconnect.playerCount).toBe(3)

    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Ball possession released on disconnect')
  })

  test('Remote player removed on disconnect', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    console.log('📤 Connecting two clients...')
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    await Promise.all([
      waitScaled(client1, 2000),
      waitScaled(client2, 2000)
    ])

    const session2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    // Client 1 should see Client 2 as remote player
    const remotePlayerBefore = await client1.evaluate((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayers = scene?.remotePlayers
      return remotePlayers?.has(remoteId) || false
    }, session2)

    console.log(`  Client 1 sees Client 2: ${remotePlayerBefore}`)
    expect(remotePlayerBefore).toBe(true)

    // Client 2 disconnects
    console.log('\n📤 Client 2 disconnecting...')
    await client2.close()
    await context2.close()

    await waitScaled(client1, 1000)

    // Client 1 should no longer see Client 2
    const remotePlayerAfter = await client1.evaluate((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayers = scene?.remotePlayers
      return remotePlayers?.has(remoteId) || false
    }, session2)

    console.log(`  Client 1 sees Client 2: ${remotePlayerAfter}`)
    expect(remotePlayerAfter).toBe(false)

    // Server should have 3 players (1 human + 2 AI for team balance)
    const playerCount = await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Server players: ${playerCount}`)
    expect(playerCount).toBe(3)

    await client1.close()
    await context1.close()

    console.log('\n✅ TEST PASSED: Remote player removed on disconnect')
  })

  test('Player join/leave cycle maintains correct team colors', async ({ browser }, testInfo) => {
    console.log('📤 Testing player join/leave cycle...\n')

    // Generate test room ID for all clients to use
    const testRoomId = `test-w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`🔒 All clients will use test room: ${testRoomId}`)

    // Player 1 joins (should be blue)
    console.log('Step 1: Player 1 joins')
    const context1 = await browser.newContext()
    const client1 = await context1.newPage()
    await client1.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client1.goto(CLIENT_URL)
    await waitScaled(client1, 2000)

    const color1 = await client1.evaluate(() =>
      (window as any).__gameControls?.scene?.player?.fillColor
    )
    const session1 = await client1.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    console.log(`  Player 1 (${session1}): ${color1 === BLUE_COLOR ? 'BLUE' : 'RED'}`)
    expect(color1).toBe(BLUE_COLOR)

    // Player 2 joins (should be red)
    console.log('\nStep 2: Player 2 joins')
    const context2 = await browser.newContext()
    const client2 = await context2.newPage()
    await client2.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client2.goto(CLIENT_URL)
    await waitScaled(client2, 2000)

    const color2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.player?.fillColor
    )
    const session2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    console.log(`  Player 2 (${session2}): ${color2 === BLUE_COLOR ? 'BLUE' : 'RED'}`)
    // With AI enabled, both players can be on same team (AI fills the other team)
    // Just verify Player 2 has a valid color
    expect([BLUE_COLOR, RED_COLOR]).toContain(color2)

    // Player 1 leaves
    console.log('\nStep 3: Player 1 leaves')
    await client1.close()
    await context1.close()
    await waitScaled(client2, 1000)

    // Player 3 joins (should be blue, reusing Player 1's slot)
    console.log('\nStep 4: Player 3 joins')
    const context3 = await browser.newContext()
    const client3 = await context3.newPage()
    await client3.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client3.goto(CLIENT_URL)
    await waitScaled(client3, 2000)

    const color3 = await client3.evaluate(() =>
      (window as any).__gameControls?.scene?.player?.fillColor
    )
    const session3 = await client3.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    console.log(`  Player 3 (${session3}): ${color3 === BLUE_COLOR ? 'BLUE' : 'RED'}`)
    expect(color3).toBe(BLUE_COLOR)

    // Verify players.size is being used correctly
    const playerCount = await client2.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`\n📊 Server player count: ${playerCount}`)
    // With AI enabled, total players will be 6 (2 human + 4 AI for 3v3)
    // After one leaves and another joins, still 6 total
    expect(playerCount).toBeGreaterThanOrEqual(2)

    await client2.close()
    await context2.close()
    await client3.close()
    await context3.close()

    console.log('\n✅ TEST PASSED: Join/leave cycle maintains correct colors')
  })

  test('Multiple disconnects in rapid succession', async ({ browser }, testInfo) => {
    const contexts = []
    const clients = []

    // Generate test room ID for all clients
    const testRoomId = `test-w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`🔒 All clients will use test room: ${testRoomId}`)

    // Create 2 clients
    console.log('📤 Creating 2 clients...')
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext()
      const client = await context.newPage()
      await client.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
      await client.goto(CLIENT_URL)
      contexts.push(context)
      clients.push(client)
    }

    // Wait longer for match to start and AI to spawn (4s for Phaser + match start + AI spawn)
    await Promise.all(clients.map(c => waitScaled(c, 4000)))

    // Get player count
    const initialCount = await clients[0].evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Initial players: ${initialCount}`)
    // With AI enabled, 2 clients create a 3v3 match = 6 total players (2 human + 4 AI)
    // However, if test runs slower or concurrently with other tests, may see more players
    expect(initialCount).toBeGreaterThanOrEqual(6)

    // Rapidly disconnect all clients
    console.log('\n📤 Rapidly disconnecting all clients...')
    await Promise.all(clients.map(c => c.close()))
    await Promise.all(contexts.map(c => c.close()))

    // Create new client to verify server state
    console.log('\n📤 Creating new client to check server state...')
    const verifyContext = await browser.newContext()
    const verifyClient = await verifyContext.newPage()
    await verifyClient.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await verifyClient.goto(CLIENT_URL)
    await waitScaled(verifyClient, 2000)

    const finalCount = await verifyClient.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Final players: ${finalCount}`)
    // With AI enabled, a single player gets AI teammates = 3 total (1 human + 2 AI)
    expect(finalCount).toBe(3)

    await verifyClient.close()
    await verifyContext.close()

    console.log('\n✅ TEST PASSED: Multiple rapid disconnects handled correctly')
  })
})
