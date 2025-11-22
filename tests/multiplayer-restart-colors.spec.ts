import { test, expect } from '@playwright/test'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL
const BLUE_COLOR = 0x0066ff
const RED_COLOR = 0xff4444

async function waitForPlayerColor(page) {
  for (let i = 0; i < 15; i++) {
    const color = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const myPlayerId = scene?.myPlayerId
      return scene?.players?.get(myPlayerId)?.fillColor
    })
    if (color !== undefined) return color
    await waitScaled(page, 150)
  }
  return undefined
}

async function getControlColors(page) {
  return page.evaluate(() => {
    const state = (window as any).__gameControls?.test?.getState?.()
    const scene = (window as any).__gameControls?.scene
    const button = scene?.actionButton?.getGameObjects?.()?.[0]
    const myPlayerId = scene?.myPlayerId
    return {
      joystick: state?.joystick?.baseColor,
      button: button?.fillColor,
      player: scene?.players?.get(myPlayerId)?.fillColor
    }
  })
}

async function joinRoom(browser, roomId: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.addInitScript((id) => { (window as any).__testRoomId = id }, roomId)
  await page.goto(CLIENT_URL)
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.myPlayerId && scene.players?.has(scene.myPlayerId)
  }, { timeout: 15000 })
  return { ctx, page }
}

test.describe('Multiplayer restart colors (smoke)', () => {
  test.setTimeout(60000)

  test('colors stay valid after a restart', async ({ browser }) => {
    const roomA = `colors-${Date.now()}`
    const c1 = await joinRoom(browser, roomA)
    const c2 = await joinRoom(browser, roomA)
    const [initial1, initial2] = await Promise.all([waitForPlayerColor(c1.page), waitForPlayerColor(c2.page)])
    expect([BLUE_COLOR, RED_COLOR]).toContain(initial1)
    expect([BLUE_COLOR, RED_COLOR]).toContain(initial2)
    expect(initial1).not.toBe(initial2)

    await Promise.all([c1.ctx.close(), c2.ctx.close()])

    const roomB = `colors-${Date.now()}-b`
    const r1 = await joinRoom(browser, roomB)
    const r2 = await joinRoom(browser, roomB)

    const [after1, after2] = await Promise.all([waitForPlayerColor(r1.page), waitForPlayerColor(r2.page)])
    expect([BLUE_COLOR, RED_COLOR]).toContain(after1)
    expect([BLUE_COLOR, RED_COLOR]).toContain(after2)

    const [ui1, ui2] = await Promise.all([getControlColors(r1.page), getControlColors(r2.page)])
    expect(ui1.joystick).toBe(ui1.player)
    expect(ui1.button).toBe(ui1.player)
    expect(ui2.joystick).toBe(ui2.player)
    expect(ui2.button).toBe(ui2.player)

    await Promise.all([r1.ctx.close(), r2.ctx.close()])
  })
})
