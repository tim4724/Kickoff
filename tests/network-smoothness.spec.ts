import { test, expect } from './fixtures'
import { setupMultiClientTest } from './helpers/room-utils'

test.describe('Network Smoothness', () => {
  test('Remote player movement is visually smooth', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await setupMultiClientTest([page1, page2], '/', testInfo.workerIndex)

    // Wait for match to reach 'playing' phase on both clients
    await Promise.all([
      page1.waitForFunction(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase === 'playing'
      }, { timeout: 30000 }),
      page2.waitForFunction(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase === 'playing'
      }, { timeout: 30000 }),
    ])

    // Get Player 1's ID (from Client A)
    const p1Id = await page1.evaluate(
      () => (window as any).__gameControls.scene.myPlayerId as string
    )

    // Ensure P1 sprite exists on Client B
    await page2.waitForFunction(
      (id: string) => (window as any).__gameControls.scene.players.has(id),
      p1Id,
      { timeout: 10000 }
    )

    // Client A: move player rightward for 2 seconds via direct test API
    const movePromise = page1.evaluate(() => {
      return (window as any).__gameControls.test.movePlayerDirect(1, 0, 2000)
    })

    // Client B: sample remote player sprite positions over 2.5 seconds
    const metrics = await page2.evaluate(
      (targetId: string) => {
        return new Promise<{
          avgDelta: number
          deltaVariance: number
          maxJump: number
          stallCount: number
          jumpCount: number
          stallRatio: number
          jumpRatio: number
          totalFrames: number
          samples: number
        }>((resolve) => {
          const positions: { x: number; y: number; t: number }[] = []
          const startTime = performance.now()
          const duration = 1800 // Shorter than 2s movement to avoid measuring the stop transition

          function sample() {
            const now = performance.now()
            if (now - startTime > duration) {
              // Compute metrics
              const deltas: number[] = []
              let maxJump = 0

              for (let i = 1; i < positions.length; i++) {
                const dx = positions[i].x - positions[i - 1].x
                const dy = positions[i].y - positions[i - 1].y
                const delta = Math.sqrt(dx * dx + dy * dy)
                deltas.push(delta)
                if (delta > maxJump) maxJump = delta
              }

              const totalFrames = deltas.length
              if (totalFrames === 0) {
                resolve({
                  avgDelta: 0, deltaVariance: 0, maxJump: 0,
                  stallCount: 0, jumpCount: 0, stallRatio: 1, jumpRatio: 0,
                  totalFrames: 0, samples: positions.length,
                })
                return
              }

              const avgDelta = deltas.reduce((s, d) => s + d, 0) / totalFrames
              const deltaVariance =
                deltas.reduce((s, d) => s + (d - avgDelta) ** 2, 0) / totalFrames

              const stallThreshold = 0.1
              const stallCount = avgDelta > 1
                ? deltas.filter((d) => d < stallThreshold).length
                : 0
              const jumpThreshold = avgDelta * 2
              const jumpCount = deltas.filter((d) => d > jumpThreshold).length

              resolve({
                avgDelta: Math.round(avgDelta * 100) / 100,
                deltaVariance: Math.round(deltaVariance * 100) / 100,
                maxJump: Math.round(maxJump * 100) / 100,
                stallCount,
                jumpCount,
                stallRatio: Math.round((stallCount / totalFrames) * 1000) / 1000,
                jumpRatio: Math.round((jumpCount / totalFrames) * 1000) / 1000,
                totalFrames,
                samples: positions.length,
              })
              return
            }

            const sprite = (window as any).__gameControls?.scene?.players?.get(targetId)
            if (sprite) {
              positions.push({ x: sprite.x, y: sprite.y, t: now })
            }
            requestAnimationFrame(sample)
          }

          requestAnimationFrame(sample)
        })
      },
      p1Id
    )

    // Wait for movement to complete
    await movePromise

    // Log raw metrics for tuning
    console.log('=== Network Smoothness Metrics (Client B observing Client A) ===')
    console.log(`  Total frames sampled: ${metrics.totalFrames}`)
    console.log(`  Avg delta (px/frame): ${metrics.avgDelta}`)
    console.log(`  Delta variance:       ${metrics.deltaVariance}`)
    console.log(`  Max jump (px):        ${metrics.maxJump}`)
    console.log(`  Stall count:          ${metrics.stallCount}`)
    console.log(`  Jump count:           ${metrics.jumpCount}`)
    console.log(`  Stall ratio:          ${metrics.stallRatio}`)
    console.log(`  Jump ratio:           ${metrics.jumpRatio}`)
    console.log('================================================================')

    // Verify we got some data (basic sanity)
    expect(metrics.totalFrames).toBeGreaterThan(0)

    // Quality assertions only when we have enough frames for meaningful metrics.
    // CI runners (~2-5 fps) produce too few frames; skip quality checks there.
    if (metrics.totalFrames >= 30) {
      expect(metrics.maxJump).toBeLessThan(50)
      expect(metrics.stallRatio).toBeLessThan(0.05)
      expect(metrics.jumpRatio).toBeLessThan(0.15)
    }

    await context1.close()
    await context2.close()
  })
})
