import { test, expect } from '@playwright/test'
import { setupSinglePlayerTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Realtime movement (smoke)', () => {
  test('player position updates while moving and reversing', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    await waitScaled(page, 200)

    const start = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return player?.x || 0
    })

    await page.evaluate(() => (window as any).__gameControls?.test?.directMove(1, 0, 500))
    await waitScaled(page, 150)
    const mid = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return player?.x || 0
    })

    await page.evaluate(() => (window as any).__gameControls?.test?.directMove(-1, 0, 500))
    await waitScaled(page, 150)
    const end = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return player?.x || 0
    })

    expect(mid - start).toBeGreaterThan(15)
    expect(mid - end).toBeGreaterThan(10)
  })
})
