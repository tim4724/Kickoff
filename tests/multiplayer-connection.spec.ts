import { test, expect } from '@playwright/test'
import { generateTestRoomId, cleanupTestContext } from './helpers/room-utils'

test.describe('Multiplayer Connection', () => {
  // Scenario 1: Standard Connection Flow
  test('Two clients join the same room and game starts only after second player joins', async ({ browser }, testInfo) => {
    // Use a unique room name for each test (robust ID generation prevents collisions)
    const roomName = generateTestRoomId(testInfo.workerIndex)

    // Create two contexts (browsers)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Client 1 joins with unique room ID
    console.log('Client 1 joining...')
    await page1.goto(`/?roomId=${roomName}#multiplayer`)

    // Wait for game state to be ready and have phase 'waiting'
    await expect.poll(async () => {
        const state = await page1.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
        return state?.phase;
    }, { timeout: 10000 }).toBe('waiting');

    // Verify that we have 1 human player
    await expect.poll(async () => {
        const count = await page1.evaluate(() => {
            const players = (window as any).__gameControls.scene.getUnifiedState().players;
            const values = players instanceof Map ? Array.from(players.values()) : Object.values(players);
            return values.filter((p: any) => p.isHuman).length;
        });
        return count;
    }, { timeout: 10000 }).toBe(1);

    console.log('Client 1 waiting as expected.')

    // Client 2 joins same room
    console.log('Client 2 joining...')
    await page2.goto(`/?roomId=${roomName}#multiplayer`)

    // Wait for Client 2 game state
    await expect.poll(async () => {
        const state = await page2.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
        return state?.phase;
    }, { timeout: 10000 }).toBeTruthy();

    // Now both should transition to 'playing'
    console.log('Waiting for match start...')
    await expect.poll(async () => {
       const state1 = await page1.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
       const state2 = await page2.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
       return state1?.phase === 'playing' && state2?.phase === 'playing';
    }, { timeout: 20000 }).toBe(true);

    console.log('Game started!')

    // Verify they are in the same room by checking player count
    await expect.poll(async () => {
        const p1Players = await page1.evaluate(() => {
            const players = (window as any).__gameControls.scene.getUnifiedState().players;
            const values = players instanceof Map ? Array.from(players.values()) : Object.values(players);
            return values.filter((p: any) => p.isHuman).length;
        });
        return p1Players;
    }, { timeout: 10000 }).toBe(2);

    // Client 1 disconnects
    console.log('Client 1 disconnecting...')
    await page1.close();

    // Client 2 should be notified and room closed
    // Client handling of "room_closed" usually redirects to menu.
    console.log('Waiting for Client 2 to return to menu...')
    await expect.poll(async () => {
        const hash = await page2.evaluate(() => window.location.hash);
        console.log('Client 2 Hash:', hash);
        return hash.includes('menu');
    }, { timeout: 20000 }).toBe(true);

    console.log('Client 2 returned to menu/disconnected properly.')

    // Clean up with proper disconnection
    await cleanupTestContext(page2, context2);
    await context1.close(); // context1 already closed page1
  });

  // Scenario 2: Reconnection Flow
  test('Client can leave and rejoin a new multiplayer game', async ({ browser }, testInfo) => {
    const roomName = generateTestRoomId(testInfo.workerIndex)

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

    // Client 2 joins that room
    await page2.goto(`/?roomId=${roomName}_1#multiplayer`);

    // Wait for match start
    await expect.poll(async () => {
       const state = await page.evaluate(() => (window as any).__gameControls?.scene?.getUnifiedState?.());
       return state?.phase;
    }, { timeout: 20000 }).toBe('playing');

    console.log('Match started successfully in second session.')

    // Clean up with proper disconnection
    await cleanupTestContext(page, context);
    await cleanupTestContext(page2, context2);
  });
});
