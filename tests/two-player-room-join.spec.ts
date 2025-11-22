import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL
const BLUE_COLOR = 0x0066ff
const RED_COLOR = 0xff4444

test.describe('Two-Player Room Joining', () => {
  test('Two clients join same room: correct teams, match playing, 3v3 humans flagged', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)

    await Promise.all([waitScaled(client1, 2500), waitScaled(client2, 2500)])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
    ])
    expect(session1 && session2 && session1 !== session2).toBe(true)

    const [team1, team2] = await Promise.all([
      client1.evaluate((sid) => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.get(`${sid}-p1`)?.team || null
      }, session1),
      client2.evaluate((sid) => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.get(`${sid}-p1`)?.team || null
      }, session2),
    ])
    expect(team1 && team2 && team1 !== team2).toBe(true)

    const [color1, color2] = await Promise.all([
      client1.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.players?.get(scene?.myPlayerId)?.fillColor
      }),
      client2.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        return scene?.players?.get(scene?.myPlayerId)?.fillColor
      }),
    ])
    expect([color1, color2].sort()).toEqual([BLUE_COLOR, RED_COLOR].sort())

    const [phase1, phase2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase),
      client2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase),
    ])
    expect(phase1).toBe('playing')
    expect(phase2).toBe('playing')

    const playerFlags = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      const flags: Record<string, { team: string; human: boolean }> = {}
      state?.players?.forEach((p: any, id: string) => {
        flags[id] = { team: p.team, human: p.isHuman }
      })
      return flags
    })
    const ids = Object.keys(playerFlags)
    expect(ids.length).toBe(6)
    const humans = ids.filter((id) => playerFlags[id].human)
    expect(humans.length).toBe(2)
    const teams = new Set(ids.map((id) => playerFlags[id].team))
    expect(teams.size).toBe(2)

    const [room1, room2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getRoom()?.id || null),
      client2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getRoom()?.id || null),
    ])
    expect(room1).toBe(room2)

    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()
  })

  test('Single player waits; second player triggers start', async ({ browser }, testInfo) => {
    const roomId = `test-w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const context1 = await browser.newContext()
    const client1 = await context1.newPage()
    await client1.addInitScript((id) => { (window as any).__testRoomId = id }, roomId)
    await client1.goto(CLIENT_URL)
    await waitScaled(client1, 1200)

    const phaseBefore = await client1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase)
    expect(phaseBefore).toBe('waiting')

    const context2 = await browser.newContext()
    const client2 = await context2.newPage()
    await client2.addInitScript((id) => { (window as any).__testRoomId = id }, roomId)
    await client2.goto(CLIENT_URL)

    await Promise.all([waitScaled(client1, 2000), waitScaled(client2, 2000)])

    const [phaseAfter1, phaseAfter2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase),
      client2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getState()?.phase),
    ])
    expect(phaseAfter1).toBe('playing')
    expect(phaseAfter2).toBe('playing')

    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()
  })

  test('Ball is visible and in sync for both clients', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    await Promise.all([waitScaled(client1, 2500), waitScaled(client2, 2500)])

    const [ball1, ball2] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        const ball = (window as any).__gameControls?.scene?.ball
        return { x: state?.ball?.x, y: state?.ball?.y, sprite: { exists: !!ball, visible: ball?.visible, alpha: ball?.alpha, width: ball?.width, height: ball?.height } }
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        const ball = (window as any).__gameControls?.scene?.ball
        return { x: state?.ball?.x, y: state?.ball?.y, sprite: { exists: !!ball, visible: ball?.visible, alpha: ball?.alpha, width: ball?.width, height: ball?.height } }
      }),
    ])

    expect(ball1.x).toBeDefined()
    expect(ball2.x).toBe(ball1.x)
    expect(ball2.y).toBe(ball1.y)
    expect(ball1.sprite.exists).toBe(true)
    expect(ball2.sprite.exists).toBe(true)
    expect(ball1.sprite.visible).toBe(true)
    expect(ball2.sprite.visible).toBe(true)
    expect(ball1.sprite.alpha).toBe(1)
    expect(ball2.sprite.alpha).toBe(1)
    expect(ball1.sprite.width).toBe(30)
    expect(ball2.sprite.width).toBe(30)
    expect(ball1.sprite.height).toBe(30)
    expect(ball2.sprite.height).toBe(30)

    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()
  })
})
