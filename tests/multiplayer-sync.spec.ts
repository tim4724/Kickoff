import { test, expect } from './fixtures'
import { setupMultiClientTest } from './helpers/room-utils'

test.describe('Multiplayer Synchronization', () => {
  test('Two clients join same room and see each other', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      await setupMultiClientTest([page1, page2], '/', testInfo.workerIndex)

      // setupMultiClientTest already waits for match to be playing, so we know both are connected
      // Verify both clients have active game state
      const state1 = await page1.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.()
        return { phase: state?.phase, hasPlayers: state?.players?.size > 0 }
      })
      const state2 = await page2.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState?.()
        return { phase: state?.phase, hasPlayers: state?.players?.size > 0 }
      })

      expect(state1.phase).toBe('playing')
      expect(state1.hasPlayers).toBe(true)
      expect(state2.phase).toBe('playing')
      expect(state2.hasPlayers).toBe(true)

      // Verify they are in the same room
      const roomId1 = await page1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getRoom()?.id)
      const roomId2 = await page2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getRoom()?.id)

      expect(roomId1).toBeDefined()
      expect(roomId2).toBeDefined()
      expect(roomId1).toBe(roomId2)

      // Verify client 1 sees client 2
      const c1Id = await page1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      const c2Id = await page2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      expect(c1Id).toBeDefined()
      expect(c2Id).toBeDefined()

      await expect.poll(async () => {
          return page1.evaluate((targetId) => {
              return (window as any).__gameControls?.scene?.players?.has(targetId + '-p1') ?? false
          }, c2Id)
      }, { timeout: 60000 }).toBe(true)

      await expect.poll(async () => {
          return page2.evaluate((targetId) => {
              return (window as any).__gameControls?.scene?.players?.has(targetId + '-p1') ?? false
          }, c1Id)
      }, { timeout: 60000 }).toBe(true)
    } finally {
      await context1.close()
      await context2.close()
    }
  });
})
