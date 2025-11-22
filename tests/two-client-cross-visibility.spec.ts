import { test, expect, Page } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

async function getLocalPlayerState(page: Page, sessionId: string) {
  return page.evaluate((sid) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState?.()
    if (!scene || !state) return null

    const serverPlayer = state.players?.get(`${sid}-p1`)
    const sprite = scene.players?.get(scene.controlledPlayerId || scene.myPlayerId)
    return serverPlayer && sprite
      ? { server: { x: serverPlayer.x, y: serverPlayer.y }, sprite: { x: sprite.x, y: sprite.y } }
      : null
  }, sessionId)
}

async function getRemoteView(page: Page, targetSessionId: string) {
  for (let i = 0; i < 5; i++) {
    const view = await page.evaluate((sid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState?.()
      if (!scene || !state) return null

      const myPlayerId = scene.myPlayerId
      const entry = Array.from(scene.players?.entries?.() || []).find(
        ([id]) => id !== myPlayerId && id.startsWith(sid)
      )
      const sprite = entry?.[1]
      const serverPlayer = state.players?.get(`${sid}-p1`)
      return sprite && serverPlayer
        ? { sprite: { x: sprite.x, y: sprite.y }, server: { x: serverPlayer.x, y: serverPlayer.y } }
        : null
    }, targetSessionId)

    if (view) return view
    await waitScaled(page, 150)
  }
  return null
}

test.describe('Two-Client Cross-Visibility (smoke)', () => {
  test('remote sprite stays close to authoritative position', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const c1 = await context1.newPage()
    const c2 = await context2.newPage()

    const roomId = await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Room: ${roomId}`)

    // Wait for sessions to be ready
    let c1Session: string | undefined
    let c2Session: string | undefined
    for (let i = 0; i < 8 && (!c1Session || !c2Session); i++) {
      await waitScaled(c1, 200)
      c1Session = await c1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      c2Session = await c2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    }
    expect(c1Session, 'client1 session').toBeTruthy()
    expect(c2Session, 'client2 session').toBeTruthy()

    // Let remote sprites spawn
    await Promise.all([waitScaled(c1, 600), waitScaled(c2, 600)])

    // Move client 1 to the right for a short burst
    await c1.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(240, 300)
    })

    const deltas: number[] = []
    for (let i = 0; i < 8; i++) {
      await waitScaled(c1, 160)
      const c1State = await getLocalPlayerState(c1, c1Session!)
      const remoteView = await getRemoteView(c2, c1Session!)
      if (c1State && remoteView) {
        const dx = c1State.server.x - remoteView.sprite.x
        const dy = c1State.server.y - remoteView.sprite.y
        deltas.push(Math.hypot(dx, dy))
      }
    }

    await c1.evaluate(() => (window as any).__gameControls?.test?.releaseJoystick())

    expect(deltas.length).toBeGreaterThan(0)
    expect(Math.max(...deltas)).toBeLessThan(70)
    expect(deltas.reduce((s, d) => s + d, 0) / deltas.length).toBeLessThan(40)

    await Promise.all([context1.close(), context2.close()])
  })
})
