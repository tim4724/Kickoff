import { test, expect } from './fixtures'
import { generateTestRoomId } from './helpers/room-utils'

test.describe('Game Flow', () => {
  test('Menu loads and has correct buttons', async ({ page }) => {
    await page.goto('/')

    // Check if menu loaded
    await page.waitForFunction(() => (window as any).__menuLoaded === true)

    const menuButtons = await page.evaluate(() => {
        const buttons = (window as any).__menuButtons;
        return {
            singlePlayer: !!buttons?.singlePlayer,
            multiplayer: !!buttons?.multiplayer,
            aiOnly: !!buttons?.aiOnly
        }
    })

    expect(menuButtons.singlePlayer).toBe(true)
    expect(menuButtons.multiplayer).toBe(true)
    expect(menuButtons.aiOnly).toBe(true)
  });

  test('Navigate to Single Player and back', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true)

    // Click Single Player (need both pointerdown and pointerup for debounce logic)
    await page.evaluate(() => {
        (window as any).__menuButtons.singlePlayer.emit('pointerdown');
        (window as any).__menuButtons.singlePlayer.emit('pointerup');
    })

    // Wait for scene switch
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene')

    // Check if game started
    const gameRunning = await page.evaluate(() => {
        return !!(window as any).__gameControls.scene.gameEngine
    })
    expect(gameRunning).toBe(true)

    // Click Back Button
    await page.evaluate(() => {
        (window as any).__gameControls.backButton.emit('pointerdown');
    })

    // Wait for Menu
    await page.waitForFunction(() => (window as any).__menuLoaded === true)
  });

  test('Multiplayer room connection flow', async ({ page }, testInfo) => {
    // Generate isolated room ID for this test
    const roomId = generateTestRoomId(testInfo.workerIndex)
    
    // Set room ID before navigation 
    await page.addInitScript((id) => {
      ;(window as any).__testRoomId = id
    }, roomId)
    
    // Navigate directly to multiplayer - auto-start will handle the connection
    await page.goto('/#/multiplayer')
    
    // Wait for scene and connection
    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'MultiplayerScene', { timeout: 10000 })
    
    // Wait for connection - game should start in single-player waiting mode
    // We just need to verify the client connected, not that there are 2 players
    await expect.poll(async () => {
        const scene = await page.evaluate(() => {
          const scene = (window as any).__gameControls?.scene
          return {
            isConnected: scene?.networkManager?.isConnected?.() ?? false,
            sessionId: scene?.mySessionId ?? null
          }
        })
        return scene.isConnected && scene.sessionId
    }, { timeout: 10000 }).toBeTruthy()

    const sessionId = await page.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    expect(sessionId).toBeTruthy()
  })
})
