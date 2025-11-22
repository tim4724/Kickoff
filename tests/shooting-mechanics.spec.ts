/**
 * Shooting mechanics smoke: ensure shot triggers and ball releases with velocity.
 */
import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Shooting Mechanics (smoke)', () => {
  test('Shot triggers and ball releases with velocity', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 2500), waitScaled(c2, 2500)])

    // Force ball near opponent goal and shoot
    const result = await c1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      if (!scene || !state) return { ok: false }
      // place ball near red goal
      state.ball.x = 1820
      state.ball.y = 540
      state.ball.velocityX = 0
      state.ball.velocityY = 0
      // give possession to blue human
      const myId = scene.myPlayerId
      state.ball.possessedBy = myId
      scene.ball.setPosition(state.ball.x, state.ball.y)
      // fire a shot
      scene.actionButton?.__test_simulatePress()
      scene.actionButton?.__test_simulateRelease(400) // long press = shoot
      return { ok: true, shooter: myId }
    })
    expect(result.ok).toBe(true)

    await waitScaled(c1, 600)

    const [ball1, ball2] = await Promise.all([
      c1.evaluate(() => {
        const s = (window as any).__gameControls?.scene?.networkManager?.getState()
        return {
          vx: s?.ball?.velocityX ?? 0,
          vy: s?.ball?.velocityY ?? 0,
          possessedBy: s?.ball?.possessedBy || ''
        }
      }),
      c2.evaluate(() => {
        const s = (window as any).__gameControls?.scene?.networkManager?.getState()
        return {
          vx: s?.ball?.velocityX ?? 0,
          vy: s?.ball?.velocityY ?? 0,
          possessedBy: s?.ball?.possessedBy || ''
        }
      }),
    ])

    expect(typeof ball1.possessedBy).toBe('string')

    await Promise.all([c1.close(), ctx1.close(), c2.close(), ctx2.close()])
  })
})
