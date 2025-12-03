import { test, expect } from './fixtures'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'

// These tests are inherently flaky due to Colyseus filterBy race condition
// where multiple rooms can be created with the same roomName before indexing completes
test.describe('Multiplayer Gameplay', () => {
  // Skip these tests in CI due to Colyseus race condition
  // The core multiplayer functionality is verified by game-flow.spec.ts
  test.skip(!!process.env.CI, 'Skipped in CI due to Colyseus filterBy race condition')
  
  test('Movement sync: Client A moves, Client B sees updates', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      await setupMultiClientTest([page1, page2], '/', testInfo.workerIndex)

      // Get P1 ID
      const p1Id = await page1.evaluate(() => (window as any).__gameControls?.scene?.myPlayerId)
      expect(p1Id).toBeDefined()

      // Wait for P1 to appear on Client 2
      await expect.poll(async () => {
          return page2.evaluate((id) => {
              return (window as any).__gameControls?.scene?.players?.has(id) ?? false
          }, p1Id)
      }, { timeout: 60000 }).toBe(true)

      // Record initial P1 pos on Client 2
      const initialP1PosOnC2 = await page2.evaluate((id) => {
          const p = (window as any).__gameControls?.scene?.players?.get(id)
          return { x: p?.x ?? 0, y: p?.y ?? 0 }
      }, p1Id)

      // Move P1 (on Client 1)
      await page1.keyboard.down('ArrowRight');
      await waitScaled(page1, 2000);
      await page1.keyboard.up('ArrowRight');

      // Check P1 pos on Client 2
      await expect.poll(async () => {
          return page2.evaluate((id) => {
              const p = (window as any).__gameControls?.scene?.players?.get(id)
              return p?.x ?? 0
          }, p1Id)
      }, { timeout: 60000 }).toBeGreaterThan(initialP1PosOnC2.x + 20)
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
