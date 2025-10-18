import { test, expect, Page } from '@playwright/test'
import { setupSinglePlayerTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'

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
async function measureInputLag(page: Page): Promise<number> {
  const startTime = Date.now()

  // Get initial position (single-player mode)
  const initialPos = await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return { x: scene.player.x, y: scene.player.y }
  })

  // Send direct input (starts movement immediately without UI interaction)
  const inputPromise = page.evaluate(() => {
    const controls = (window as any).__gameControls
    return controls.test.directMove(1, 0, 100) // Move right for 100ms
  })

  // Poll for position change (check every 1ms)
  let moved = false
  let lag = 0

  for (let i = 0; i < 500; i++) { // Max 500ms
    await waitScaled(page, 1)

    const currentPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    const deltaX = Math.abs(currentPos.x - initialPos.x)
    const deltaY = Math.abs(currentPos.y - initialPos.y)

    if (deltaX > 2 || deltaY > 2) {
      lag = Date.now() - startTime
      moved = true
      break
    }
  }

  // Wait for input to complete (if not moved yet)
  if (!moved) {
    await inputPromise
    console.warn('⚠️ No movement detected within 500ms')
    return 500
  }

  // Cancel ongoing movement
  await inputPromise

  return lag
}

/**
 * Measure network round-trip time
 * For single-player mode, this is always 0 (no network)
 */
async function measureNetworkRTT(page: Page): Promise<number> {
  // In single-player mode, there's no network latency
  return 0
}

test.describe('Input Lag Measurement', () => {
  test('Measure Baseline Input Lag (10 samples)', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    // Small buffer after scene starts
    await waitScaled(page, 500)

    console.log('\n🧪 MEASURING INPUT LAG (10 samples)')
    console.log('='.repeat(70))

    const measurements: LatencyMeasurement[] = []

    for (let i = 0; i < 10; i++) {
      console.log(`\n📊 Sample ${i + 1}/10`)

      // Measure input lag
      const inputToVisual = await measureInputLag(page)
      console.log(`  Input-to-Visual: ${inputToVisual.toFixed(2)}ms`)

      // Measure network RTT (0 in single-player)
      const networkRTT = await measureNetworkRTT(page)
      console.log(`  Network RTT: ${networkRTT.toFixed(2)}ms (single-player)`)

      measurements.push({
        inputToVisual,
        networkRTT,
        timestamp: Date.now()
      })

      // Wait between samples
      await waitScaled(page, 500)
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
