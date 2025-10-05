import { test, expect, Page } from '@playwright/test'
import { setupIsolatedTest } from './helpers/room-utils'

/**
 * Input Lag Measurement Test
 *
 * This test measures the actual input-to-visual latency and network RTT
 * to quantify improvements from optimization strategies.
 *
 * Measurements:
 * - Input-to-Visual Lag: Time from input sent to player position change
 * - Network RTT: Round-trip time to server and back
 *
 * This test should be run BEFORE and AFTER each optimization to compare results.
 */

const CLIENT_URL = 'http://localhost:5173'

interface LatencyMeasurement {
  inputToVisual: number
  networkRTT: number
  timestamp: number
}

/**
 * Measure input-to-visual lag
 * Sends movement input and measures time until player moves
 */
async function measureInputLag(page: Page, sessionId: string): Promise<number> {
  const startTime = Date.now()

  // Get initial position
  const initialPos = await page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    const player = state?.players?.get(sid)
    return { x: player?.x || 0, y: player?.y || 0 }
  }, sessionId)

  // Send input via network (simulates real joystick)
  await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    scene?.networkManager?.sendInput({ x: 1, y: 0 }, false)
  })

  // Poll for position change (check every 1ms)
  let moved = false
  let lag = 0

  for (let i = 0; i < 500; i++) { // Max 500ms
    await page.waitForTimeout(1)

    const currentPos = await page.evaluate((sid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      const player = state?.players?.get(sid)
      return { x: player?.x || 0, y: player?.y || 0 }
    }, sessionId)

    const deltaX = Math.abs(currentPos.x - initialPos.x)
    const deltaY = Math.abs(currentPos.y - initialPos.y)

    if (deltaX > 2 || deltaY > 2) {
      lag = Date.now() - startTime
      moved = true
      break
    }
  }

  if (!moved) {
    console.warn('⚠️ No movement detected within 500ms')
    return 500
  }

  return lag
}

/**
 * Measure network round-trip time
 * Uses ping/pong messaging
 */
async function measureNetworkRTT(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const scene = (window as any).__gameControls?.scene
    const room = scene?.networkManager?.getRoom()

    if (!room) return 0

    return new Promise<number>((resolve) => {
      const startTime = performance.now()

      room.onMessage('pong', () => {
        const rtt = performance.now() - startTime
        resolve(rtt)
      })

      room.send('ping', { sent: startTime })

      // Timeout after 1 second
      setTimeout(() => resolve(1000), 1000)
    })
  })
}

test.describe('Input Lag Measurement', () => {
  test('Measure Baseline Input Lag (10 samples)', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)

    // Wait for game to load
    await page.waitForTimeout(3000)

    // Get session ID
    const client1SessionId = await page.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

    if (!client1SessionId) {
      throw new Error('Failed to get session ID')
    }

    console.log(`✅ Client connected: ${client1SessionId}`)

    console.log('\n🧪 MEASURING INPUT LAG (10 samples)')
    console.log('='.repeat(70))

    const measurements: LatencyMeasurement[] = []

    for (let i = 0; i < 10; i++) {
      console.log(`\n📊 Sample ${i + 1}/10`)

      // Measure input lag
      const inputToVisual = await measureInputLag(page, client1SessionId)
      console.log(`  Input-to-Visual: ${inputToVisual.toFixed(2)}ms`)

      // Measure network RTT
      const networkRTT = await measureNetworkRTT(page)
      console.log(`  Network RTT: ${networkRTT.toFixed(2)}ms`)

      measurements.push({
        inputToVisual,
        networkRTT,
        timestamp: Date.now()
      })

      // Wait between samples
      await page.waitForTimeout(500)
    }

    // Calculate statistics
    const avgInputLag = measurements.reduce((sum, m) => sum + m.inputToVisual, 0) / measurements.length
    const avgNetworkRTT = measurements.reduce((sum, m) => sum + m.networkRTT, 0) / measurements.length

    const minInputLag = Math.min(...measurements.map(m => m.inputToVisual))
    const maxInputLag = Math.max(...measurements.map(m => m.inputToVisual))
    const minRTT = Math.min(...measurements.map(m => m.networkRTT))
    const maxRTT = Math.max(...measurements.map(m => m.networkRTT))

    console.log('\n📈 SUMMARY STATISTICS')
    console.log('='.repeat(70))
    console.log(`\n🎯 Input-to-Visual Lag:`)
    console.log(`   Average: ${avgInputLag.toFixed(2)}ms`)
    console.log(`   Min:     ${minInputLag.toFixed(2)}ms`)
    console.log(`   Max:     ${maxInputLag.toFixed(2)}ms`)
    console.log(`   Range:   ${(maxInputLag - minInputLag).toFixed(2)}ms`)

    console.log(`\n🌐 Network Round-Trip Time:`)
    console.log(`   Average: ${avgNetworkRTT.toFixed(2)}ms`)
    console.log(`   Min:     ${minRTT.toFixed(2)}ms`)
    console.log(`   Max:     ${maxRTT.toFixed(2)}ms`)
    console.log(`   Range:   ${(maxRTT - minRTT).toFixed(2)}ms`)

    // Export to file for comparison
    const csv = 'sample,inputToVisual,networkRTT,timestamp\n' +
      measurements.map((m, i) => `${i + 1},${m.inputToVisual.toFixed(2)},${m.networkRTT.toFixed(2)},${m.timestamp}`).join('\n')

    console.log(`\n💾 CSV Data:\n${csv}`)

    // Assertions (reasonable expectations for baseline)
    expect(avgInputLag).toBeLessThan(500) // Should be less than 500ms
    expect(avgNetworkRTT).toBeLessThan(200) // Local network should be <200ms

    console.log('\n✅ MEASUREMENT COMPLETE')
    console.log('='.repeat(70))
  })
})
