import { test, expect } from '@playwright/test'

test.describe('Multiplayer Reconnection', () => {
  const roomName = `test-reconnect-${Date.now()}`

  test('Client can leave and rejoin a new multiplayer game', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // 1. Join first game
    console.log('STEP 1: Joining first game...')
    await page.goto(`/?roomId=${roomName}_1#multiplayer`)

    // Wait for connection
    await expect.poll(async () => {
        const state = await page.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
        return state?.phase;
    }, { timeout: 10000 }).toBe('waiting');

    console.log('First game connected (waiting state).')

    // 2. Navigate to menu (simulating "leave")
    console.log('STEP 2: Navigating to menu...')
    await page.evaluate(() => {
        // Use hash navigation which is what buttons do
        window.location.hash = '#/menu';
    });

    // Wait for menu
    await expect.poll(async () => {
        return await page.evaluate(() => window.location.hash.includes('menu'));
    }, { timeout: 5000 }).toBe(true);

    // Wait for scene to change to MenuScene
    await expect.poll(async () => {
        return await page.evaluate(() => (window as any).__menuLoaded === true);
    }, { timeout: 5000 }).toBe(true);

    console.log('Returned to menu.')

    // 3. Join second game (simulating "rejoin")
    console.log('STEP 3: Joining second game...')
    await page.evaluate(() => {
        window.location.hash = '#/multiplayer';
    });

    // Wait for connection again
    await expect.poll(async () => {
        const state = await page.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
        return state?.phase;
    }, { timeout: 10000 }).toBe('waiting');

    console.log('Second game connected successfully.')

    // 4. Verify we can start a match in this second session
    console.log('STEP 4: Adding second player to start match...')
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()

    // Get room ID from Client 1 using robust logic
    const c1RoomId = await page.evaluate(() => {
        const room = (window as any).__gameControls.scene.networkManager.getRoom();
        return room.id || room.roomId;
    });
    console.log('Client 1 Room ID:', c1RoomId);

    if (!c1RoomId) {
        throw new Error('Could not retrieve room ID from Client 1');
    }

    // Client 2 joins that room (using roomId param directly to force join)
    // Note: roomName vs roomId. MatchRoom filterBy roomName.
    // If c1RoomId is the colyseus room ID, we can't join by roomName easily unless we know the roomName used.
    // But Client 1 reused the URL `?roomId=${roomName}_1`.
    // So we can just join `?roomId=${roomName}_1`.
    // Or simpler, verify Client 1 is in correct room.

    // Let's use the explicit room name we started with, which Client 1 should still be using.
    await page2.goto(`/?roomId=${roomName}_1#multiplayer`);

    // Wait for match start
    await expect.poll(async () => {
       const state = await page.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
       return state?.phase;
    }, { timeout: 20000 }).toBe('playing');

    console.log('Match started successfully in second session.')

    await context.close();
    await context2.close();
  });
});
