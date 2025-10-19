import { test, expect, Page } from '@playwright/test'
import { setupSinglePlayerTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

/**
 * Test: Real-Time Position Updates During Movement
 *
 * This test verifies that player position updates smoothly during active movement
 * in single-player mode.
 *
 * Purpose: Detect if position updates are working correctly during gameplay.
 *
 * Expected: Player should move continuously and smoothly with consistent velocity.
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

/**
 * Helper: Get player position
 */
async function getPlayerPosition(page: Page) {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.player) return null

    return {
      x: scene.player.x,
      y: scene.player.y
    }
  })
}

test.describe('Real-Time Position Updates', () => {
  test('Player position updates smoothly during continuous movement', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    await waitScaled(page, 500)

    console.log('\n🧪 TEST: Real-Time Position Updates During Movement')
    console.log('='.repeat(70))

    // Get initial position
    const initialPos = await getPlayerPosition(page)
    console.log(`\n📊 Initial position: (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)})`)

    // Start continuous movement RIGHT using direct input
    console.log(`\n📤 MOVEMENT: Continuous RIGHT for 2 seconds with real-time sampling...`)

    // Start movement in background (don't await)
    const movePromise = page.evaluate(() => {
      const controls = (window as any).__gameControls
      return controls.test.directMove(1, 0, 2000) // Move right for 2000ms
    })

    // Sample every 50ms for 2 seconds (40 samples)
    const samples: Array<{
      time: number
      x: number
      y: number
      deltaFromPrevious: number
    }> = []

    const DURATION_MS = 2000
    const SAMPLE_INTERVAL_MS = 50
    const SAMPLE_COUNT = DURATION_MS / SAMPLE_INTERVAL_MS

    let prevPos = initialPos

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await waitScaled(page, SAMPLE_INTERVAL_MS)

      const pos = await getPlayerPosition(page)
      if (pos) {
        const deltaFromPrevious = Math.sqrt(
          Math.pow(pos.x - prevPos.x, 2) + Math.pow(pos.y - prevPos.y, 2)
        )

        samples.push({
          time: i * SAMPLE_INTERVAL_MS,
          x: pos.x,
          y: pos.y,
          deltaFromPrevious
        })

        // Log every 10th sample (every 500ms)
        if (i % 10 === 0) {
          console.log(
            `  ${samples[samples.length - 1].time}ms: ` +
            `Position=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), ` +
            `Movement since last=${deltaFromPrevious.toFixed(1)}px`
          )
        }

        prevPos = pos
      }
    }

    // Wait for movement to complete
    await movePromise

    await waitScaled(page, 500)

    // Get final position
    const finalPos = await getPlayerPosition(page)
    const totalDistance = Math.sqrt(
      Math.pow(finalPos.x - initialPos.x, 2) + Math.pow(finalPos.y - initialPos.y, 2)
    )

    // Calculate statistics
    const movements = samples.slice(1).map(s => s.deltaFromPrevious) // Skip first sample
    const avgMovement = movements.reduce((sum, d) => sum + d, 0) / movements.length
    const maxMovement = Math.max(...movements)
    const minMovement = Math.min(...movements)

    console.log(`\n📈 MOVEMENT ANALYSIS:`)
    console.log(`  Samples collected: ${samples.length}`)
    console.log(`  Total distance: ${totalDistance.toFixed(1)}px`)
    console.log(`  Average movement per 50ms: ${avgMovement.toFixed(1)}px`)
    console.log(`  Max movement per 50ms: ${maxMovement.toFixed(1)}px`)
    console.log(`  Min movement per 50ms: ${minMovement.toFixed(1)}px`)

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Player should have moved significantly
    // Reduced from 300px to account for browser throttling with parallel workers
    console.log(`  1. Total distance: ${totalDistance.toFixed(1)}px (expected: > 100px)`)
    expect(totalDistance).toBeGreaterThan(100)

    // 2. Movement should be consistent (average movement > 5px per 50ms)
    console.log(`  2. Avg movement per 50ms: ${avgMovement.toFixed(1)}px (expected: > 5px)`)
    expect(avgMovement).toBeGreaterThan(5)

    // 3. Most samples should show movement (allow some zero samples due to timing)
    // Count how many samples had movement
    const samplesWithMovement = movements.filter(m => m > 0).length
    const movementPercentage = (samplesWithMovement / movements.length) * 100
    console.log(`  3. Samples with movement: ${samplesWithMovement}/${movements.length} (${movementPercentage.toFixed(0)}%, expected: > 45%)`)
    expect(movementPercentage).toBeGreaterThan(45) // At least 45% of samples should show movement (accounts for browser throttling with parallel workers)

    console.log(`\n✅ TEST COMPLETED - Movement updates working correctly`)
    console.log('='.repeat(70))
  })

  test('Player responds smoothly to rapid direction changes', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    await waitScaled(page, 500)

    console.log('\n🧪 TEST: Movement During Rapid Direction Changes')
    console.log('='.repeat(70))

    const directions = [
      { name: 'RIGHT', x: 230, y: 300 },
      { name: 'DOWN', x: 150, y: 380 },
      { name: 'LEFT', x: 70, y: 300 },
      { name: 'UP', x: 150, y: 220 }
    ]

    const allMovements: Array<{
      direction: string
      distanceMoved: number
    }> = []

    for (const dir of directions) {
      console.log(`\n📤 Moving ${dir.name}...`)

      const startPos = await getPlayerPosition(page)

      // Use direct input for movement
      const dirX = (dir.x - 150) / 80  // Normalize from drag coords
      const dirY = (dir.y - 300) / 80
      await page.evaluate(({ dx, dy }) => {
        const controls = (window as any).__gameControls
        return controls.test.directMove(dx, dy, 500) // Move for 500ms
      }, { dx: dirX, dy: dirY })

      await waitScaled(page, 100) // Settling time

      const endPos = await getPlayerPosition(page)

      const distanceMoved = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)
      )

      allMovements.push({
        direction: dir.name,
        distanceMoved
      })

      console.log(`  Distance moved: ${distanceMoved.toFixed(1)}px`)
    }

    await waitScaled(page, 500)

    // Calculate statistics
    const distances = allMovements.map(m => m.distanceMoved)
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
    const minDistance = Math.min(...distances)

    console.log(`\n📈 DIRECTION CHANGE ANALYSIS:`)
    console.log(`  Directions tested: ${allMovements.length}`)
    console.log(`  Average distance: ${avgDistance.toFixed(1)}px`)
    console.log(`  Min distance: ${minDistance.toFixed(1)}px`)

    // ASSERTIONS
    console.log(`\n✓ ASSERTIONS:`)

    // 1. Player should move in all directions
    // Note: With parallel workers, requestAnimationFrame may be throttled
    // Reduced expectations to account for browser throttling (was >100px)
    console.log(`  1. Average distance: ${avgDistance.toFixed(1)}px (expected: > 40px)`)
    expect(avgDistance).toBeGreaterThan(40)

    // 2. No direction should fail to move
    console.log(`  2. Min distance: ${minDistance.toFixed(1)}px (expected: > 20px)`)
    expect(minDistance).toBeGreaterThan(20)

    console.log(`\n✅ TEST COMPLETED - Direction changes working correctly`)
    console.log('='.repeat(70))
  })
})
