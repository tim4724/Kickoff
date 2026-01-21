import { test, expect } from './fixtures'
import { generateTestRoomId, cleanupTestContext } from './helpers/room-utils'

test.describe('Multiplayer Synchronization', () => {
  test('Two clients join same room and see each other', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Explicitly set roomId in URL to ensure unique room and prevent double-connection issues
    // setupMultiClientTest uses setTestRoomId which sets window.__testRoomId
    // But NetworkManager prioritizes URL param.
    // Let's use URL param to be safe and consistent with my fix in connection test.

    const roomId = generateTestRoomId(testInfo.workerIndex);
    const url = `/?roomId=${roomId}#multiplayer`;

    await Promise.all([
        page1.goto(url),
        page2.goto(url)
    ]);

    // Wait for players to be ready
    await Promise.all([
        expect.poll(async () => {
            return page1.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.isConnected());
        }, { timeout: 10000 }).toBe(true),
        expect.poll(async () => {
            return page2.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.isConnected());
        }, { timeout: 10000 }).toBe(true)
    ]);

    // Verify both are connected
    const connected1 = await page1.evaluate(() => (window as any).__gameControls.scene.networkManager.isConnected())
    const connected2 = await page2.evaluate(() => (window as any).__gameControls.scene.networkManager.isConnected())

    expect(connected1).toBe(true)
    expect(connected2).toBe(true)

    // Verify they are in the same room
    const roomId1 = await page1.evaluate(() => (window as any).__gameControls.scene.networkManager.getRoom().id)
    const roomId2 = await page2.evaluate(() => (window as any).__gameControls.scene.networkManager.getRoom().id)

    expect(roomId1).toBe(roomId2)

    // Verify client 1 sees client 2
    const c1Id = await page1.evaluate(() => (window as any).__gameControls.scene.mySessionId)
    const c2Id = await page2.evaluate(() => (window as any).__gameControls.scene.mySessionId)

    await expect.poll(async () => {
        return page1.evaluate((targetId) => {
            // Check for targetId-p1 (PixiJS sprite key)
            return (window as any).__gameControls.scene.players.has(targetId + '-p1')
        }, c2Id)
    }, { timeout: 60000 }).toBe(true)

    await expect.poll(async () => {
        return page2.evaluate((targetId) => {
            return (window as any).__gameControls.scene.players.has(targetId + '-p1')
        }, c1Id)
    }, { timeout: 60000 }).toBe(true)

    // Clean up with proper disconnection
    await cleanupTestContext(page1, context1)
    await cleanupTestContext(page2, context2)
  });
})
