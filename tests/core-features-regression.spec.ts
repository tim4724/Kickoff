import { test, expect } from '@playwright/test'
import { setupIsolatedTest, setupMultiClientTest, setupSinglePlayerTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Core features (smoke)', () => {
  test('single client initializes core objects', async ({ page }, testInfo) => {
    const room = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Room ${room}`)
    await waitScaled(page, 800)

    const state = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const scoreText = scene?.scoreText
      const myPlayerId = scene?.myPlayerId
      const player = scene?.players?.get(myPlayerId)
      const server = scene?.networkManager?.getState()?.players?.get(`${scene?.mySessionId}-p1`)
      return {
        sessionId: scene?.mySessionId,
        player: { x: player?.x, y: player?.y, visible: player?.visible },
        ball: { x: scene?.ball?.x, y: scene?.ball?.y, visible: scene?.ball?.visible },
        scoreText: scoreText?.text,
        delta: server && player ? Math.hypot(player.x - server.x, player.y - server.y) : null
      }
    })

    expect(state.sessionId).toBeTruthy()
    expect(state.player.visible).toBe(true)
    expect(state.ball.visible).toBe(true)
    expect(state.ball.x).toBeGreaterThan(800)
    expect(state.ball.x).toBeLessThan(1100)
    expect(state.ball.y).toBeGreaterThan(400)
    expect(state.ball.y).toBeLessThan(700)
    expect(state.scoreText).toMatch(/\d+ - \d+/)
    if (state.delta !== null) expect(state.delta).toBeLessThan(70)
  })

  test('player moves with input', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    await waitScaled(page, 300)

    const start = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return { x: player?.x, y: player?.y }
    })

    await page.evaluate(() => (window as any).__gameControls?.test?.directMove(1, 0, 900))
    await waitScaled(page, 300)

    const end = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return { x: player?.x, y: player?.y }
    })

    expect(end.x - start.x).toBeGreaterThan(15)
  })

  test('field boundary clamps movement', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    await waitScaled(page, 200)
    await page.evaluate(() => (window as any).__gameControls?.test?.directMove(-1, 0, 1200))
    await waitScaled(page, 300)

    const pos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const player = scene?.players?.get(scene?.myPlayerId)
      return { x: player?.x, y: player?.y }
    })

    expect(pos.x).toBeGreaterThan(40)
  })

  test('two clients see each other', async ({ browser }, testInfo) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const c1 = await ctx1.newPage()
    const c2 = await ctx2.newPage()

    const room = await setupMultiClientTest([c1, c2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Room ${room}`)
    await Promise.all([waitScaled(c1, 800), waitScaled(c2, 800)])

    const [sessions, remoteSeen] = await Promise.all([
      Promise.all([
        c1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
        c2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      ]),
      Promise.all([
        c1.evaluate(() => {
          const scene = (window as any).__gameControls?.scene
          const my = scene?.myPlayerId
          return Array.from(scene?.players?.keys() || []).some((id: string) => id !== my)
        }),
        c2.evaluate(() => {
          const scene = (window as any).__gameControls?.scene
          const my = scene?.myPlayerId
          return Array.from(scene?.players?.keys() || []).some((id: string) => id !== my)
        })
      ])
    ])

    expect(sessions[0]).toBeTruthy()
    expect(sessions[1]).toBeTruthy()
    expect(sessions[0]).not.toBe(sessions[1])
    expect(remoteSeen[0]).toBe(true)
    expect(remoteSeen[1]).toBe(true)

    await Promise.all([ctx1.close(), ctx2.close()])
  })
})
