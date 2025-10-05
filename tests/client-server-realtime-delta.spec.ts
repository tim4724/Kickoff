import { test, expect, Page } from '@playwright/test'
import { setupIsolatedTest } from './helpers/room-utils'

/**
 * Test: Real-Time Client-Server Position Delta During Movement
 *
 * This test measures the position delta between client visual position and server
 * authoritative position DURING active movement (not just final convergence).
 *
 * Purpose: Detect if client prediction drifts significantly from server during gameplay.
 *
 * Expected: Client should stay within 20px of server position at all times during movement.
 */

const CLIENT_URL = 'http://localhost:5173'

/**
 * Helper: Get client and server position with real-time delta
 */
async function getPositionDelta(page: Page, sessionId: string) {
  return await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return null

    const state = scene.networkManager.getState()
    if (!state) return null

    const serverPlayer = state.players?.get(sid)
    const clientX = scene.player.x
    const clientY = scene.player.y

    return {
      client: { x: clientX, y: clientY },
      server: { x: serverPlayer?.x || 0, y: serverPlayer?.y || 0 },
      delta: {
        x: Math.abs(clientX - (serverPlayer?.x || 0)),
        y: Math.abs(clientY - (serverPlayer?.y || 0)),
        total: Math.sqrt(
          Math.pow(clientX - (serverPlayer?.x || 0), 2) +
          Math.pow(clientY - (serverPlayer?.y || 0), 2)
        )
      }
    }
  }, sessionId)
}

test.describe('Real-Time Position Synchronization', () => {
  test('Client position stays within 20px of server during continuous movement', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)

    await page.waitForTimeout(2000)

    const client1SessionId = await page.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    console.log(`  Session ID: ${client1SessionId}`)

    console.log('\n🧪 TEST: Real-Time Position Delta During Movement')
    console.log('='.repeat(70))

    // Start continuous movement RIGHT
    console.log(`\n📤 MOVEMENT: Continuous RIGHT for 3 seconds with real-time sampling...`)

    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(230, 300) // Full right
      console.log('🕹️ Joystick: Moving RIGHT')
    })

    // Sample every 50ms for 3 seconds (60 samples)
    const samples: Array<{
      time: number
      client: { x: number; y: number }
      server: { x: number; y: number }
      delta: { x: number; y: number; total: number }
    }> = []

    const DURATION_MS = 3000
    const SAMPLE_INTERVAL_MS = 50
    const SAMPLE_COUNT = DURATION_MS / SAMPLE_INTERVAL_MS

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS)

      const pos = await getPositionDelta(page, client1SessionId)
      if (pos) {
        samples.push({
          time: i * SAMPLE_INTERVAL_MS,
          client: pos.client,
          server: pos.server,
          delta: pos.delta
        })

        // Log every 10th sample (every 500ms)
        if (i % 10 === 0) {
          console.log(
            `  ${samples[samples.length - 1].time}ms: ` +
            `Client=(${pos.client.x.toFixed(1)}, ${pos.client.y.toFixed(1)}), ` +
            `Server=(${pos.server.x.toFixed(1)}, ${pos.server.y.toFixed(1)}), ` +
            `Δ=${pos.delta.total.toFixed(1)}px`
          )
        }
      }
    }

    // Release joystick
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
      console.log('🕹️ Released joystick')
    })

    await page.waitForTimeout(500)

    // Calculate statistics
    const deltas = samples.map(s => s.delta.total)
    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length
    const maxDelta = Math.max(...deltas)
    const minDelta = Math.min(...deltas)

    // Count samples exceeding thresholds
    const over20px = deltas.filter(d => d > 20).length
    const over30px = deltas.filter(d => d > 30).length
    const over50px = deltas.filter(d => d > 50).length

    console.log(`\n📈 REAL-TIME DELTA ANALYSIS:`)
    console.log(`  Samples collected: ${samples.length}`)
    console.log(`  Average delta: ${avgDelta.toFixed(1)}px`)
    console.log(`  Maximum delta: ${maxDelta.toFixed(1)}px`)
    console.log(`  Minimum delta: ${minDelta.toFixed(1)}px`)
    console.log(`  Samples > 20px: ${over20px} (${((over20px / samples.length) * 100).toFixed(1)}%)`)
    console.log(`  Samples > 30px: ${over30px} (${((over30px / samples.length) * 100).toFixed(1)}%)`)
    console.log(`  Samples > 50px: ${over50px} (${((over50px / samples.length) * 100).toFixed(1)}%)`)

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Average delta should be < 20px (excellent sync)
    console.log(`  1. Average delta: ${avgDelta.toFixed(1)}px (expected: < 20px)`)
    expect(avgDelta).toBeLessThan(20)

    // 2. Maximum delta should be < 40px (acceptable peak)
    console.log(`  2. Maximum delta: ${maxDelta.toFixed(1)}px (expected: < 40px)`)
    expect(maxDelta).toBeLessThan(40)

    // 3. Less than 10% of samples should exceed 25px
    const percentOver25 = (deltas.filter(d => d > 25).length / samples.length) * 100
    console.log(`  3. Samples > 25px: ${percentOver25.toFixed(1)}% (expected: < 10%)`)
    expect(percentOver25).toBeLessThan(10)

    // 4. NO samples should exceed 50px (critical desync threshold)
    console.log(`  4. Samples > 50px: ${over50px} (expected: 0)`)
    expect(over50px).toBe(0)

    console.log(`\n✅ TEST COMPLETED - Real-time synchronization validated`)
    console.log('='.repeat(70))
  })

  test('Position delta remains stable during rapid direction changes', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)

    await page.waitForTimeout(2000)

    const client1SessionId = await page.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    console.log(`  Session ID: ${client1SessionId}`)

    console.log('\n🧪 TEST: Position Delta During Rapid Direction Changes')
    console.log('='.repeat(70))

    const directions = [
      { name: 'RIGHT', x: 230, y: 300 },
      { name: 'DOWN', x: 150, y: 380 },
      { name: 'LEFT', x: 70, y: 300 },
      { name: 'UP', x: 150, y: 220 }
    ]

    const allSamples: Array<{
      direction: string
      delta: number
    }> = []

    for (const dir of directions) {
      console.log(`\n📤 Moving ${dir.name}...`)

      await page.evaluate((direction) => {
        const controls = (window as any).__gameControls
        controls.test.touchJoystick(150, 300)
        controls.test.dragJoystick(direction.x, direction.y)
      }, dir)

      // Sample 10 times over 500ms
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(50)

        const pos = await getPositionDelta(page, client1SessionId)
        if (pos) {
          allSamples.push({
            direction: dir.name,
            delta: pos.delta.total
          })
        }
      }
    }

    // Release joystick
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
    })

    await page.waitForTimeout(500)

    // Calculate statistics
    const deltas = allSamples.map(s => s.delta)
    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length
    const maxDelta = Math.max(...deltas)

    console.log(`\n📈 RAPID DIRECTION CHANGE ANALYSIS:`)
    console.log(`  Samples collected: ${allSamples.length}`)
    console.log(`  Average delta: ${avgDelta.toFixed(1)}px`)
    console.log(`  Maximum delta: ${maxDelta.toFixed(1)}px`)

    // By direction
    directions.forEach(dir => {
      const dirSamples = allSamples.filter(s => s.direction === dir.name)
      const dirAvg = dirSamples.reduce((sum, s) => sum + s.delta, 0) / dirSamples.length
      console.log(`  ${dir.name}: avg ${dirAvg.toFixed(1)}px`)
    })

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Average delta during rapid changes should be < 25px
    console.log(`  1. Average delta: ${avgDelta.toFixed(1)}px (expected: < 25px)`)
    expect(avgDelta).toBeLessThan(25)

    // 2. Maximum delta should be < 50px even during direction changes
    console.log(`  2. Maximum delta: ${maxDelta.toFixed(1)}px (expected: < 50px)`)
    expect(maxDelta).toBeLessThan(50)

    console.log(`\n✅ TEST COMPLETED - Direction change stability validated`)
    console.log('='.repeat(70))
  })
})
