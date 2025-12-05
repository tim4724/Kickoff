import { test, expect } from '@playwright/test'

test.describe('Multiplayer Connection', () => {
  // Use a unique room name for each test
  const roomName = `test-room-${Date.now()}`

  test('Two clients join the same room and game starts only after second player joins', async ({ browser }) => {
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
    console.log('Waiting for Client 2 to return to menu...')
    await expect.poll(async () => {
        const hash = await page2.evaluate(() => window.location.hash);
        console.log('Client 2 Hash:', hash);
        return hash.includes('menu');
    }, { timeout: 20000 }).toBe(true);

    console.log('Client 2 returned to menu/disconnected properly.')

    await context1.close();
    await context2.close();
  });
});
