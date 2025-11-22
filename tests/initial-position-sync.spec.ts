import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

async function snapshot(page) {
  return page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const statePlayers = Array.from(scene?.networkManager?.getState()?.players?.entries?.() || []).map(
      ([id, p]: any) => ({ id, x: p.x, y: p.y })
    )
    const sprites = Array.from(scene?.players?.entries?.() || []).map(
      ([id, p]: any) => ({ id, x: p.x, y: p.y })
    )
    return { statePlayers, sprites }
  })
}

test.describe('Initial position sync (smoke)', () => {
  test('both clients agree on spawn positions', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(c1, 800), waitScaled(c2, 800)])

    const [snap1, snap2] = await Promise.all([snapshot(c1), snapshot(c2)])

    const map1 = new Map(snap1.statePlayers.map(p => [p.id, p]))
    const map2 = new Map(snap2.statePlayers.map(p => [p.id, p]))
    expect(map1.size).toBeGreaterThanOrEqual(2)
    expect(map1.size).toBe(map2.size)

    for (const [id, p1] of map1) {
      const p2 = map2.get(id)
      expect(p2).toBeDefined()
      expect(Math.hypot(p1.x - p2!.x, p1.y - p2!.y)).toBeLessThan(20)
    }

    const spriteMap1 = new Map(snap1.sprites.map(p => [p.id, p]))
    const spriteMap2 = new Map(snap2.sprites.map(p => [p.id, p]))

    for (const [id, p1] of map1) {
      const sprite1 = spriteMap1.get(id)
      const sprite2 = spriteMap2.get(id)
      if (sprite1) expect(Math.hypot(sprite1.x - p1.x, sprite1.y - p1.y)).toBeLessThan(60)
      if (sprite2) expect(Math.hypot(sprite2.x - p1.x, sprite2.y - p1.y)).toBeLessThan(60)
    }

    await Promise.all([ctx1.close(), ctx2.close()])
  })
})
