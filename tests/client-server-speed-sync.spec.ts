import { test, expect, Page } from '@playwright/test'

/**
 * Test: Client-Server Speed Synchronization
 *
 * This test measures the position delta between client-side prediction and server state
 * to verify that client movement speed matches server physics.
 *
 * Expected: Client visual position should closely match server authoritative position
 * during continuous movement.
 */

const CLIENT_URL = 'http://localhost:5173'

/**
 * Helper: Get both client rendering position and server state position
 */
async function getPositionComparison(page: Page, sessionId: string) {
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state) return null

    // Server authoritative position
    const serverPlayer = state.players?.get(sid)

    // Client rendering position (visual sprite)
    const clientRenderX = scene.player.x
    const clientRenderY = scene.player.y

    return {
      server: {
        x: serverPlayer?.x || 0,
        y: serverPlayer?.y || 0
      },
      client: {
        x: clientRenderX,
        y: clientRenderY
      },
      delta: {
        x: Math.abs((serverPlayer?.x || 0) - clientRenderX),
        y: Math.abs((serverPlayer?.y || 0) - clientRenderY)
      }
    }
  }, sessionId)
}

test.describe('Client-Server Speed Synchronization', () => {
  let client1: Page
  let client1SessionId: string

  test.beforeAll(async ({ browser }) => {
    const context1 = await browser.newContext()
    client1 = await context1.newPage()

    client1.on('console', msg => console.log(`[Client 1] ${msg.text()}`))

    await client1.goto(CLIENT_URL)
    await client1.waitForTimeout(2000)

    // Wait for connection
    const MAX_RETRIES = 8
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      client1SessionId = await client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      if (client1SessionId) {
        console.log(`✅ Client connected: ${client1SessionId}`)
        break
      }

      if (attempt < MAX_RETRIES) {
        await client1.waitForTimeout(1000)
      }
    }

    if (!client1SessionId) {
      throw new Error('Failed to establish connection')
    }

    await client1.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await client1?.close()
  })

  test('Client prediction speed matches server physics speed', async () => {
    console.log('\n🧪 TEST: Client-Server Speed Synchronization')
    console.log('='.repeat(70))

    // Get initial position
    const initial = await getPositionComparison(client1, client1SessionId)
    console.log(`\n📊 INITIAL STATE:`)
    console.log(`  Server: (${initial.server.x}, ${initial.server.y})`)
    console.log(`  Client: (${initial.client.x}, ${initial.client.y})`)
    console.log(`  Delta: (${initial.delta.x.toFixed(1)}px, ${initial.delta.y.toFixed(1)}px)`)

    // Start continuous movement RIGHT for 2 seconds
    console.log(`\n📤 MOVEMENT: Continuous RIGHT for 2 seconds...`)

    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(230, 300) // Full right
      console.log('🕹️ Joystick: Moving RIGHT')
    })

    // Sample positions during movement
    const samples: Array<{ time: number; server: number; client: number; delta: number }> = []
    const SAMPLE_COUNT = 10
    const SAMPLE_INTERVAL = 200 // ms

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await client1.waitForTimeout(SAMPLE_INTERVAL)

      const pos = await getPositionComparison(client1, client1SessionId)
      const sample = {
        time: i * SAMPLE_INTERVAL,
        server: pos.server.x,
        client: pos.client.x,
        delta: pos.delta.x
      }
      samples.push(sample)

      console.log(`  ${sample.time}ms: Server=${sample.server.toFixed(1)}px, Client=${sample.client.toFixed(1)}px, Δ=${sample.delta.toFixed(1)}px`)
    }

    // Release joystick
    await client1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
      console.log('🕹️ Released joystick')
    })

    await client1.waitForTimeout(500)

    // Get final position
    const final = await getPositionComparison(client1, client1SessionId)
    console.log(`\n📊 FINAL STATE:`)
    console.log(`  Server: (${final.server.x}, ${final.server.y})`)
    console.log(`  Client: (${final.client.x}, ${final.client.y})`)
    console.log(`  Delta: (${final.delta.x.toFixed(1)}px, ${final.delta.y.toFixed(1)}px)`)

    // Calculate statistics
    const avgDelta = samples.reduce((sum, s) => sum + s.delta, 0) / samples.length
    const maxDelta = Math.max(...samples.map(s => s.delta))
    const clientDistance = final.client.x - initial.client.x
    const serverDistance = final.server.x - initial.server.x
    const speedRatio = clientDistance / serverDistance

    console.log(`\n📈 ANALYSIS:`)
    console.log(`  Client distance: ${clientDistance.toFixed(1)}px`)
    console.log(`  Server distance: ${serverDistance.toFixed(1)}px`)
    console.log(`  Speed ratio (client/server): ${speedRatio.toFixed(3)}`)
    console.log(`  Average delta during movement: ${avgDelta.toFixed(1)}px`)
    console.log(`  Maximum delta during movement: ${maxDelta.toFixed(1)}px`)

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Speed ratio should be close to 1.0 (within 10% tolerance)
    console.log(`  1. Speed ratio: ${speedRatio.toFixed(3)} (expected: 0.9-1.1)`)
    expect(speedRatio).toBeGreaterThanOrEqual(0.9)
    expect(speedRatio).toBeLessThanOrEqual(1.1)

    // 2. Average delta should be small (< 50px)
    console.log(`  2. Average delta: ${avgDelta.toFixed(1)}px (expected: < 50px)`)
    expect(avgDelta).toBeLessThan(50)

    // 3. Maximum delta should be reasonable (< 100px)
    console.log(`  3. Maximum delta: ${maxDelta.toFixed(1)}px (expected: < 100px)`)
    expect(maxDelta).toBeLessThan(100)

    // 4. Final positions should converge (< 30px delta)
    console.log(`  4. Final delta: ${final.delta.x.toFixed(1)}px (expected: < 30px)`)
    expect(final.delta.x).toBeLessThan(30)

    console.log(`\n✅ TEST COMPLETED`)
    console.log('='.repeat(70))
  })
})
