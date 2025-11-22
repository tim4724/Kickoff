import { test, expect } from '@playwright/test'
import { setupIsolatedTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Player switching (smoke)', () => {
  test('switchToNextTeammate changes control', async ({ page }, testInfo) => {
    await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    await waitScaled(page, 400)

    const initial = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.controlledPlayerId
    })

    await page.evaluate(() => (window as any).__gameControls?.scene?.switchToNextTeammate?.())
    await waitScaled(page, 200)

    const after = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.controlledPlayerId
    })

    expect(after).toBeTruthy()
    expect(after).not.toBe(initial)
  })
})
