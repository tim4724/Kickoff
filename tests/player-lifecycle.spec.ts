import { test, expect, Browser } from '@playwright/test'

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

const CLIENT_URL = 'http://localhost:5173'
const BLUE_COLOR = 26367      // 0x0066ff
const RED_COLOR = 16729156    // 0xff4444

test.describe('Player Lifecycle Management', () => {
  test('Player disconnect releases ball possession', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients
    console.log('📤 Step 1: Connecting two clients...')
    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    console.log(`  Client 1: ${session1}`)
    console.log(`  Client 2: ${session2}`)

    // Client 1 gains possession
    console.log('\n📤 Step 2: Client 1 gaining possession...')
    await client1.keyboard.down('ArrowRight')
    await client1.waitForTimeout(2000)
    await client1.keyboard.up('ArrowRight')
    await client1.waitForTimeout(500)

    const ballState = await client2.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return {
        possessedBy: state?.ball?.possessedBy || '',
        x: state?.ball?.x || 0,
        y: state?.ball?.y || 0
      }
    })

    console.log(`  Ball possessed by: ${ballState.possessedBy}`)
    console.log(`  Ball position: (${ballState.x}, ${ballState.y})`)

    // Verify Client 1 has possession
    expect(ballState.possessedBy).toBe(session1)

    // Client 1 disconnects
    console.log('\n📤 Step 3: Client 1 disconnecting...')
    await client1.close()
    await context1.close()

    // Wait for server to process disconnect
    await client2.waitForTimeout(1000)

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
    // Player count should be 1
    expect(ballAfterDisconnect.playerCount).toBe(1)

    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Ball possession released on disconnect')
  })

  test('Remote player removed on disconnect', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    console.log('📤 Connecting two clients...')
    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
    ])

    const session2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    // Client 1 should see Client 2 as remote player
    const remotePlayerBefore = await client1.evaluate((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayers = Array.from(scene?.remotePlayers?.values() || [])
      return remotePlayers.find((p: any) => p.sessionId === remoteId) !== undefined
    }, session2)

    console.log(`  Client 1 sees Client 2: ${remotePlayerBefore}`)
    expect(remotePlayerBefore).toBe(true)

    // Client 2 disconnects
    console.log('\n📤 Client 2 disconnecting...')
    await client2.close()
    await context2.close()

    await client1.waitForTimeout(1000)

    // Client 1 should no longer see Client 2
    const remotePlayerAfter = await client1.evaluate((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayers = Array.from(scene?.remotePlayers?.values() || [])
      return remotePlayers.find((p: any) => p.sessionId === remoteId) !== undefined
    }, session2)

    console.log(`  Client 1 sees Client 2: ${remotePlayerAfter}`)
    expect(remotePlayerAfter).toBe(false)

    // Server should have 1 player
    const playerCount = await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Server players: ${playerCount}`)
    expect(playerCount).toBe(1)

    await client1.close()
    await context1.close()

    console.log('\n✅ TEST PASSED: Remote player removed on disconnect')
  })

  test('Player join/leave cycle maintains correct team colors', async ({ browser }) => {
    console.log('📤 Testing player join/leave cycle...\n')

    // Player 1 joins (should be blue)
    console.log('Step 1: Player 1 joins')
    const context1 = await browser.newContext()
    const client1 = await context1.newPage()
    await client1.goto(CLIENT_URL)
    await client1.waitForTimeout(2000)

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
    await client2.goto(CLIENT_URL)
    await client2.waitForTimeout(2000)

    const color2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.player?.fillColor
    )
    const session2 = await client2.evaluate(() =>
      (window as any).__gameControls?.scene?.mySessionId
    )

    console.log(`  Player 2 (${session2}): ${color2 === BLUE_COLOR ? 'BLUE' : 'RED'}`)
    expect(color2).toBe(RED_COLOR)

    // Player 1 leaves
    console.log('\nStep 3: Player 1 leaves')
    await client1.close()
    await context1.close()
    await client2.waitForTimeout(1000)

    // Player 3 joins (should be blue, reusing Player 1's slot)
    console.log('\nStep 4: Player 3 joins')
    const context3 = await browser.newContext()
    const client3 = await context3.newPage()
    await client3.goto(CLIENT_URL)
    await client3.waitForTimeout(2000)

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
    expect(playerCount).toBe(2)

    await client2.close()
    await context2.close()
    await client3.close()
    await context3.close()

    console.log('\n✅ TEST PASSED: Join/leave cycle maintains correct colors')
  })

  test('Multiple disconnects in rapid succession', async ({ browser }) => {
    const contexts = []
    const clients = []

    // Create 2 clients
    console.log('📤 Creating 2 clients...')
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext()
      const client = await context.newPage()
      await client.goto(CLIENT_URL)
      contexts.push(context)
      clients.push(client)
    }

    await Promise.all(clients.map(c => c.waitForTimeout(2000)))

    // Get player count
    const initialCount = await clients[0].evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Initial players: ${initialCount}`)
    expect(initialCount).toBe(2)

    // Rapidly disconnect all clients
    console.log('\n📤 Rapidly disconnecting all clients...')
    await Promise.all(clients.map(c => c.close()))
    await Promise.all(contexts.map(c => c.close()))

    // Create new client to verify server state
    console.log('\n📤 Creating new client to check server state...')
    const verifyContext = await browser.newContext()
    const verifyClient = await verifyContext.newPage()
    await verifyClient.goto(CLIENT_URL)
    await verifyClient.waitForTimeout(2000)

    const finalCount = await verifyClient.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      return state?.players?.size || 0
    })

    console.log(`  Final players: ${finalCount}`)
    expect(finalCount).toBe(1)

    await verifyClient.close()
    await verifyContext.close()

    console.log('\n✅ TEST PASSED: Multiple rapid disconnects handled correctly')
  })
})
