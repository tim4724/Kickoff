import { test, expect, Page, Browser } from '@playwright/test'

/**
 * Test: Two-Client Cross-Visibility Synchronization
 *
 * This test validates that what Client 2 SEES for Client 1's player matches
 * Client 1's actual intended movement.
 *
 * Purpose: This is the CRITICAL test that catches the user-reported issue:
 * "The player moves much faster on the client compared to the server state"
 *
 * What we're testing:
 * - Client 1 moves their player
 * - Client 2 observes Client 1's remote player sprite
 * - Assert: Client 2 sees Client 1 at approximately the same position
 *           that Client 1's server authoritative position shows
 */

const CLIENT_URL = 'http://localhost:5173'

/**
 * Helper: Get local player position and server state
 */
async function getLocalPlayerData(page: Page, sessionId: string) {
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state) return null

    const serverPlayer = state.players?.get(sid)

    return {
      clientSprite: { x: scene.player.x, y: scene.player.y },
      serverState: { x: serverPlayer?.x || 0, y: serverPlayer?.y || 0 }
    }
  }, sessionId)
}

/**
 * Helper: Get what remote client sees for a specific player
 * Includes retry logic to handle timing issues
 */
async function getRemotePlayerView(page: Page, targetSessionId: string) {
  // Retry up to 3 times with 100ms delays if remote sprite isn't ready
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await page.evaluate((sid) => {
      const scene = (window as any).__gameControls?.scene
      if (!scene?.networkManager) return null

      const state = scene.networkManager.getState()
      if (!state) return null

      // What remote client's sprite shows
      const remoteSprite = scene.remotePlayers?.get(sid)
      const serverPlayer = state.players?.get(sid)

      return {
        remoteSpritePosition: remoteSprite ? { x: remoteSprite.x, y: remoteSprite.y } : null,
        serverState: { x: serverPlayer?.x || 0, y: serverPlayer?.y || 0 }
      }
    }, targetSessionId)

    if (result && result.remoteSpritePosition) {
      return result
    }

    // Wait and retry
    if (attempt < 2) {
      await page.waitForTimeout(100)
    }
  }

  // Return result anyway (will be null if not found)
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state) return null

    const remoteSprite = scene.remotePlayers?.get(sid)
    const serverPlayer = state.players?.get(sid)

    return {
      remoteSpritePosition: remoteSprite ? { x: remoteSprite.x, y: remoteSprite.y } : null,
      serverState: { x: serverPlayer?.x || 0, y: serverPlayer?.y || 0 }
    }
  }, targetSessionId)
}

test.describe('Two-Client Cross-Visibility Synchronization', () => {
  let browser: Browser
  let client1: Page
  let client2: Page
  let client1SessionId: string
  let client2SessionId: string

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser

    // Create two separate contexts (two different "players")
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    client1 = await context1.newPage()
    client2 = await context2.newPage()

    client1.on('console', msg => console.log(`[Client 1] ${msg.text()}`))
    client2.on('console', msg => console.log(`[Client 2] ${msg.text()}`))

    // Connect both clients
    console.log('🔌 Connecting Client 1...')
    await client1.goto(CLIENT_URL)
    await client1.waitForTimeout(2000)

    console.log('🔌 Connecting Client 2...')
    await client2.goto(CLIENT_URL)
    await client2.waitForTimeout(2000)

    // Get session IDs
    const MAX_RETRIES = 8
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      client1SessionId = await client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      client2SessionId = await client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      if (client1SessionId && client2SessionId) {
        console.log(`✅ Client 1 connected: ${client1SessionId}`)
        console.log(`✅ Client 2 connected: ${client2SessionId}`)
        break
      }

      if (attempt < MAX_RETRIES) {
        await client1.waitForTimeout(1000)
      }
    }

    if (!client1SessionId || !client2SessionId) {
      throw new Error('Failed to establish both connections')
    }

    await client1.waitForTimeout(2000)
    await client2.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await client1?.close()
    await client2?.close()
  })

  test('Client 2 sees Client 1 at correct position during movement', async () => {
    console.log('\n🧪 TEST: Cross-Client Position Visibility')
    console.log('='.repeat(70))

    // Client 1 moves right for 2 seconds
    console.log(`\n📤 Client 1 moving RIGHT...`)

    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(230, 300) // Full right
      console.log('🕹️ Client 1: Moving RIGHT')
    })

    // Sample every 100ms for 2 seconds
    const samples: Array<{
      time: number
      client1Local: { x: number; y: number }
      client1Server: { x: number; y: number }
      client2Sees: { x: number; y: number }
      crossClientDelta: number
    }> = []

    const SAMPLE_COUNT = 20
    const SAMPLE_INTERVAL = 100

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await client1.waitForTimeout(SAMPLE_INTERVAL)

      // Get Client 1's view of their own position
      const client1Data = await getLocalPlayerData(client1, client1SessionId)

      // Get Client 2's view of Client 1's position
      const client2View = await getRemotePlayerView(client2, client1SessionId)

      if (client1Data && client2View && client2View.remoteSpritePosition) {
        const c1Server = client1Data.serverState
        const c2Sees = client2View.remoteSpritePosition

        const crossDelta = Math.sqrt(
          Math.pow(c1Server.x - c2Sees.x, 2) +
          Math.pow(c1Server.y - c2Sees.y, 2)
        )

        samples.push({
          time: i * SAMPLE_INTERVAL,
          client1Local: client1Data.clientSprite,
          client1Server: c1Server,
          client2Sees: c2Sees,
          crossClientDelta: crossDelta
        })

        // Log every 5th sample
        if (i % 5 === 0) {
          console.log(
            `  ${samples[samples.length - 1].time}ms: ` +
            `C1_Server=(${c1Server.x.toFixed(1)}, ${c1Server.y.toFixed(1)}), ` +
            `C2_Sees=(${c2Sees.x.toFixed(1)}, ${c2Sees.y.toFixed(1)}), ` +
            `Δ=${crossDelta.toFixed(1)}px`
          )
        }
      }
    }

    // Release joystick
    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
      console.log('🕹️ Client 1: Released joystick')
    })

    await client1.waitForTimeout(500)

    // Calculate statistics
    const crossDeltas = samples.map(s => s.crossClientDelta)
    const avgCrossDelta = crossDeltas.reduce((sum, d) => sum + d, 0) / crossDeltas.length
    const maxCrossDelta = Math.max(...crossDeltas)
    const minCrossDelta = Math.min(...crossDeltas)

    console.log(`\n📈 CROSS-CLIENT VISIBILITY ANALYSIS:`)
    console.log(`  Samples collected: ${samples.length}`)
    console.log(`  Average cross-client delta: ${avgCrossDelta.toFixed(1)}px`)
    console.log(`  Maximum cross-client delta: ${maxCrossDelta.toFixed(1)}px`)
    console.log(`  Minimum cross-client delta: ${minCrossDelta.toFixed(1)}px`)
    console.log(`  Samples > 30px: ${crossDeltas.filter(d => d > 30).length}`)
    console.log(`  Samples > 50px: ${crossDeltas.filter(d => d > 50).length}`)

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Average cross-client delta should be < 30px (with interpolation lag)
    console.log(`  1. Average cross-client delta: ${avgCrossDelta.toFixed(1)}px (expected: < 30px)`)
    expect(avgCrossDelta).toBeLessThan(30)

    // 2. Maximum cross-client delta should be < 60px
    console.log(`  2. Maximum cross-client delta: ${maxCrossDelta.toFixed(1)}px (expected: < 60px)`)
    expect(maxCrossDelta).toBeLessThan(60)

    // 3. NO samples should exceed 100px (critical desync)
    const over100 = crossDeltas.filter(d => d > 100).length
    console.log(`  3. Samples > 100px: ${over100} (expected: 0)`)
    expect(over100).toBe(0)

    console.log(`\n✅ TEST COMPLETED - Cross-client visibility validated`)
    console.log('='.repeat(70))
  })

  test('Client 1 sees Client 2 at correct position during movement', async () => {
    console.log('\n🧪 TEST: Reverse Cross-Client Position Visibility')
    console.log('='.repeat(70))

    // Client 2 moves left for 2 seconds
    console.log(`\n📤 Client 2 moving LEFT...`)

    await client2.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(70, 300) // Full left
      console.log('🕹️ Client 2: Moving LEFT')
    })

    // Sample every 100ms for 2 seconds
    const samples: Array<{
      time: number
      client2Server: { x: number; y: number }
      client1Sees: { x: number; y: number }
      crossClientDelta: number
    }> = []

    const SAMPLE_COUNT = 20
    const SAMPLE_INTERVAL = 100

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await client2.waitForTimeout(SAMPLE_INTERVAL)

      const client2Data = await getLocalPlayerData(client2, client2SessionId)
      const client1View = await getRemotePlayerView(client1, client2SessionId)

      if (client2Data && client1View && client1View.remoteSpritePosition) {
        const c2Server = client2Data.serverState
        const c1Sees = client1View.remoteSpritePosition

        const crossDelta = Math.sqrt(
          Math.pow(c2Server.x - c1Sees.x, 2) +
          Math.pow(c2Server.y - c1Sees.y, 2)
        )

        samples.push({
          time: i * SAMPLE_INTERVAL,
          client2Server: c2Server,
          client1Sees: c1Sees,
          crossClientDelta: crossDelta
        })

        if (i % 5 === 0) {
          console.log(
            `  ${samples[samples.length - 1].time}ms: ` +
            `C2_Server=(${c2Server.x.toFixed(1)}, ${c2Server.y.toFixed(1)}), ` +
            `C1_Sees=(${c1Sees.x.toFixed(1)}, ${c1Sees.y.toFixed(1)}), ` +
            `Δ=${crossDelta.toFixed(1)}px`
          )
        }
      }
    }

    await client2.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
      console.log('🕹️ Client 2: Released joystick')
    })

    await client2.waitForTimeout(500)

    const crossDeltas = samples.map(s => s.crossClientDelta)
    const avgCrossDelta = crossDeltas.reduce((sum, d) => sum + d, 0) / crossDeltas.length
    const maxCrossDelta = Math.max(...crossDeltas)

    console.log(`\n📈 REVERSE CROSS-CLIENT ANALYSIS:`)
    console.log(`  Average cross-client delta: ${avgCrossDelta.toFixed(1)}px`)
    console.log(`  Maximum cross-client delta: ${maxCrossDelta.toFixed(1)}px`)

    console.log(`\n✓ ASSERTIONS:`)
    console.log(`  1. Average cross-client delta: ${avgCrossDelta.toFixed(1)}px (expected: < 30px)`)
    expect(avgCrossDelta).toBeLessThan(30)

    console.log(`  2. Maximum cross-client delta: ${maxCrossDelta.toFixed(1)}px (expected: < 60px)`)
    expect(maxCrossDelta).toBeLessThan(60)

    console.log(`\n✅ TEST COMPLETED - Reverse visibility validated`)
    console.log('='.repeat(70))
  })

  test('Simultaneous movement by both clients maintains sync', async () => {
    console.log('\n🧪 TEST: Simultaneous Two-Client Movement')
    console.log('='.repeat(70))

    console.log(`\n📤 Both clients moving simultaneously...`)

    // Client 1 moves up, Client 2 moves down
    await Promise.all([
      client1.evaluate(() => {
        const controls = (window as any).__gameControls
        controls.test.touchJoystick(150, 300)
        controls.test.dragJoystick(150, 220) // Up
        console.log('🕹️ Client 1: Moving UP')
      }),
      client2.evaluate(() => {
        const controls = (window as any).__gameControls
        controls.test.touchJoystick(150, 300)
        controls.test.dragJoystick(150, 380) // Down
        console.log('🕹️ Client 2: Moving DOWN')
      })
    ])

    // Sample both clients simultaneously
    const samples: Array<{
      time: number
      client1Delta: number
      client2Delta: number
    }> = []

    const SAMPLE_COUNT = 20
    const SAMPLE_INTERVAL = 100

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await client1.waitForTimeout(SAMPLE_INTERVAL)

      const [client1Data, client2View, client2Data, client1View] = await Promise.all([
        getLocalPlayerData(client1, client1SessionId),
        getRemotePlayerView(client2, client1SessionId),
        getLocalPlayerData(client2, client2SessionId),
        getRemotePlayerView(client1, client2SessionId)
      ])

      if (client1Data && client2View?.remoteSpritePosition &&
          client2Data && client1View?.remoteSpritePosition) {

        const c1Delta = Math.sqrt(
          Math.pow(client1Data.serverState.x - client2View.remoteSpritePosition.x, 2) +
          Math.pow(client1Data.serverState.y - client2View.remoteSpritePosition.y, 2)
        )

        const c2Delta = Math.sqrt(
          Math.pow(client2Data.serverState.x - client1View.remoteSpritePosition.x, 2) +
          Math.pow(client2Data.serverState.y - client1View.remoteSpritePosition.y, 2)
        )

        samples.push({
          time: i * SAMPLE_INTERVAL,
          client1Delta: c1Delta,
          client2Delta: c2Delta
        })

        if (i % 5 === 0) {
          console.log(
            `  ${samples[samples.length - 1].time}ms: ` +
            `C1_Δ=${c1Delta.toFixed(1)}px, C2_Δ=${c2Delta.toFixed(1)}px`
          )
        }
      }
    }

    await Promise.all([
      client1.evaluate(() => {
        const controls = (window as any).__gameControls
        controls.test.releaseJoystick()
      }),
      client2.evaluate(() => {
        const controls = (window as any).__gameControls
        controls.test.releaseJoystick()
      })
    ])

    await client1.waitForTimeout(500)

    const c1Deltas = samples.map(s => s.client1Delta)
    const c2Deltas = samples.map(s => s.client2Delta)
    const avgC1 = c1Deltas.reduce((sum, d) => sum + d, 0) / c1Deltas.length
    const avgC2 = c2Deltas.reduce((sum, d) => sum + d, 0) / c2Deltas.length

    console.log(`\n📈 SIMULTANEOUS MOVEMENT ANALYSIS:`)
    console.log(`  Client 1 avg delta: ${avgC1.toFixed(1)}px`)
    console.log(`  Client 2 avg delta: ${avgC2.toFixed(1)}px`)

    console.log(`\n✓ ASSERTIONS:`)
    console.log(`  1. Client 1 average: ${avgC1.toFixed(1)}px (expected: < 30px)`)
    expect(avgC1).toBeLessThan(30)

    console.log(`  2. Client 2 average: ${avgC2.toFixed(1)}px (expected: < 30px)`)
    expect(avgC2).toBeLessThan(30)

    console.log(`\n✅ TEST COMPLETED - Simultaneous movement validated`)
    console.log('='.repeat(70))
  })
})
