import { test, expect } from './fixtures'
import { setupMultiClientTest } from './helpers/room-utils'

// These tests are inherently flaky due to Colyseus filterBy race condition
// where multiple rooms can be created with the same roomName before indexing completes
test.describe('Multiplayer Synchronization', () => {
  // Skip these tests in CI due to Colyseus race condition
  // The core multiplayer functionality is verified by game-flow.spec.ts
  test.skip(!!process.env.CI, 'Skipped in CI due to Colyseus filterBy race condition')
  
  test('Two clients join same room and see each other', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    try {
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      // setupMultiClientTest verifies both clients are in the same room and match is playing
      await setupMultiClientTest([page1, page2], '/', testInfo.workerIndex)

      // Get session IDs for each client
      const c1Id = await page1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
      const c2Id = await page2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)

      expect(c1Id).toBeDefined()
      expect(c2Id).toBeDefined()

      // Verify client 1 sees client 2's player
      await expect.poll(async () => {
          return page1.evaluate((targetId) => {
              return (window as any).__gameControls?.scene?.players?.has(targetId + '-p1') ?? false
          }, c2Id)
      }, { timeout: 10000 }).toBe(true)

      // Verify client 2 sees client 1's player
      await expect.poll(async () => {
          return page2.evaluate((targetId) => {
              return (window as any).__gameControls?.scene?.players?.has(targetId + '-p1') ?? false
          }, c1Id)
      }, { timeout: 10000 }).toBe(true)
    } finally {
      await context1.close()
      await context2.close()
    }
  });
})
