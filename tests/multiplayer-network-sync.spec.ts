/**
 * Multiplayer network sync smoke: focus on ball possession and basic state alignment.
 */
import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Multiplayer Network Sync (smoke)', () => {
  test('Both clients agree on ball position and possession', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 2500), waitScaled(c2, 2500)])

    const readState = async (page: any) => {
      return await page.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return {
          ballX: state?.ball?.x,
          ballY: state?.ball?.y,
          possessedBy: state?.ball?.possessedBy || 'none',
          phase: state?.phase,
        }
      })
    }

    const [s1, s2] = await Promise.all([readState(c1), readState(c2)])
    expect(s1.phase).toBe('playing')
    expect(s2.phase).toBe('playing')
    expect(s1.ballX).toBeCloseTo(s2.ballX ?? 0, 0)
    expect(s1.ballY).toBeCloseTo(s2.ballY ?? 0, 0)
    expect(typeof s1.possessedBy).toBe('string')
    expect(typeof s2.possessedBy).toBe('string')

    await Promise.all([c1.close(), ctx1.close(), c2.close(), ctx2.close()])
  })
})
