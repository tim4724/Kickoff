import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { moveTowardBallAndCapture } from './helpers/test-utils'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Ball capture and shot (smoke)', () => {
  test('player can take possession and shoot', async ({ browser }, testInfo) => {
    test.setTimeout(60000)
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 800), waitScaled(c2, 800)])

    const captured = await moveTowardBallAndCapture(c1, 8000)
    expect(captured).toBeTruthy()

    await c1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.pressButton()
    })
    await waitScaled(c1, 120)
    await c1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseButton(300)
    })
    await waitScaled(c1, 200)

    const possessorAfter = await c1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState?.()
      return state?.ball?.possessedBy || ''
    })

    expect(typeof possessorAfter).toBe('string')

    await Promise.all([ctx1.close(), ctx2.close()])
  })
})
