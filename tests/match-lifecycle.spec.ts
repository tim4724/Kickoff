import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Match lifecycle (smoke)', () => {
  test('phase moves to playing once two clients join', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 800), waitScaled(c2, 800)])

    const phase = await c1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState?.()
      return state?.phase
    })
    expect(phase).toBe('playing')

    const timeBefore = await c1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState?.()?.matchTime || 0)
    await waitScaled(c1, 600)
    const timeAfter = await c1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState?.()?.matchTime || 0)
    expect(timeAfter).toBeLessThan(timeBefore)

    await Promise.all([ctx1.close(), ctx2.close()])
  })
})
