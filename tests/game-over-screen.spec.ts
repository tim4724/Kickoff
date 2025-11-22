import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Game over overlay (smoke)', () => {
  test('shows winner and server score', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 600), waitScaled(c2, 600)])

    await c1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room
      if (room?.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 3
        room.state.scoreRed = 1
        room.state.matchTime = 0
      }
      scene?.onMatchEnd?.()
    })

    await waitScaled(c1, 400)
    const texts = await c1.evaluate(() => {
      const list = (window as any).__gameControls?.scene?.children?.list || []
      return list.filter((o: any) => o.type === 'Text' && o.depth >= 2000).map((o: any) => o.text)
    })

    expect(texts.join(' ')).toMatch(/Blue/i)
    expect(texts.join(' ')).toMatch(/3\s*-\s*1/)

    await Promise.all([ctx1.close(), ctx2.close()])
  })
})
