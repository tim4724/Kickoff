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

    // Click Single Player
    await page.evaluate(() => {
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

  test('Multiplayer room connection flow', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true)

    // Click Multiplayer
    await page.evaluate(() => {
        (window as any).__menuButtons.multiplayer.emit('pointerup');
    })

    // Wait for Lobby
    await page.waitForFunction(() => (window as any).sceneManager?.currentScene?.sceneKey === 'LobbyScene')

    // Click Create Room
    await page.evaluate(() => {
         const lobby = (window as any).sceneManager.currentScene;
         // Access private property in JS
         (lobby as any).createButton.emit('pointerup');
    })

    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'MultiplayerScene')

    // Wait for connection
    await expect.poll(async () => {
        return page.evaluate(() => (window as any).__gameControls.scene.networkManager?.isConnected())
    }).toBe(true)

    // Verify URL update with ID (using new param 'id')
    await expect.poll(async () => page.url()).toContain('id=')

    // Verify Debug Text
    await expect.poll(async () => {
        return page.evaluate(() => (window as any).__gameControls.scene.roomDebugText.text)
    }).toContain('Room 1 (')

    const sessionId = await page.evaluate(() => (window as any).__gameControls.scene.mySessionId)
    expect(sessionId).toBeTruthy()

    // Return to menu
    await page.evaluate(() => {
         (window as any).__gameControls.backButton.emit('pointerdown');
    })
    await page.waitForFunction(() => (window as any).__menuLoaded === true)

    // Wait for disconnect - accessing __gameControls of previous scene might be tricky if it was deleted
    // MultiplayerScene destroy deletes __gameControls if it matches the scene.
    // So __gameControls should be undefined or overwritten by MenuScene.
    // MenuScene sets __menuControls but not __gameControls usually?
    // MenuScene does not set __gameControls.
    // BaseGameScene destroy deletes __gameControls.

    await expect.poll(async () => {
         return page.evaluate(() => !(window as any).__gameControls)
    }).toBe(true)
  })
})
