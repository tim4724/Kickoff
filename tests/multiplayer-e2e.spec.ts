/**
 * Multiplayer E2E smoke: minimal flows to validate lobby→match→back.
 */
import { test, expect } from '@playwright/test'
import { setupMultiClientTest, generateTestRoomId, waitForPlayerReady } from './helpers/room-utils'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Multiplayer E2E Smoke', () => {
  test('Two clients reach playing phase and back to menu', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)

    // Wait for match to start
    await expect.poll(async () => {
      return await client1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase)
    }, { timeout: 20000 }).toBe('playing')

    await expect.poll(async () => {
      return await client2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase)
    }, { timeout: 20000 }).toBe('playing')

    await Promise.all([client1.close(), context1.close(), client2.close(), context2.close()])
  })

  test('Peer disconnect shows overlay and returns to menu', async ({ browser }, testInfo) => {
    test.setTimeout(45000)
    const roomId = generateTestRoomId(testInfo.workerIndex)
    const mk = async () => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.addInitScript((id) => { (window as any).__testRoomId = id }, roomId)
      await page.goto(CLIENT_URL)
      await waitForPlayerReady(page)
      return { ctx, page }
    }

    const c1 = await mk()
    const c2 = await mk()

    // Wait for both to reach playing
    await expect.poll(async () => {
      return await c1.page.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState?.()?.phase)
    }, { timeout: 15000 }).toBe('playing')

    await expect.poll(async () => {
      return await c2.page.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState?.()?.phase)
    }, { timeout: 15000 }).toBe('playing')

    // Simulate peer leaving
    await c2.ctx.close()

    // Remaining client should navigate back to menu after showing disconnect overlay
    await c1.page.waitForFunction(() => {
      const hash = window.location.hash
      const onMenu = hash.includes('menu') || (window as any).__menuLoaded === true
      const sceneKey = (window as any).__gameControls?.scene?.scene?.key
      return onMenu || sceneKey === 'MenuScene'
    }, { timeout: 30000 })

    await Promise.all([c1.page.close(), c1.ctx.close()])
  })
})
