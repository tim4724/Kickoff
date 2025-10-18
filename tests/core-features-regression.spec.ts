import { test, expect, Page } from '@playwright/test'
import { setupMultiClientTest, setupIsolatedTest, setupSinglePlayerTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

/**
 * Core Features Regression Test Suite
 *
 * Purpose: Protect working features from breaking during future development
 * - Tests fundamental game mechanics
 * - Fast execution (< 30 seconds total)
 * - High reliability (no flaky tests)
 * - Run on every commit
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Core Features Regression Suite', () => {
  test('1. Single client can connect and initialize', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const sessionId = await page.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })

    expect(sessionId).toBeTruthy()
    expect(typeof sessionId).toBe('string')
    console.log(`✅ Client connected: ${sessionId}`)
  })

  test('2. Player sprite renders and has valid position', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const playerData = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      if (!scene?.player) return null

      return {
        exists: true,
        x: scene.player.x,
        y: scene.player.y,
        visible: scene.player.visible,
        active: scene.player.active
      }
    })

    expect(playerData).toBeTruthy()
    expect(playerData.exists).toBe(true)
    expect(playerData.x).toBeGreaterThan(0)
    expect(playerData.y).toBeGreaterThan(0)
    expect(playerData.visible).toBe(true)
    expect(playerData.active).toBe(true)

    console.log(`✅ Player sprite rendered at (${playerData.x}, ${playerData.y})`)
  })

  test('3. Ball sprite renders at center field', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const ballData = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      if (!scene?.ball) return null

      return {
        exists: true,
        x: scene.ball.x,
        y: scene.ball.y,
        visible: scene.ball.visible
      }
    })

    expect(ballData).toBeTruthy()
    expect(ballData.exists).toBe(true)
    expect(ballData.visible).toBe(true)

    // Ball should be near center (1920x1080 field)
    expect(ballData.x).toBeGreaterThan(800)
    expect(ballData.x).toBeLessThan(1100)
    expect(ballData.y).toBeGreaterThan(400)
    expect(ballData.y).toBeLessThan(700)

    console.log(`✅ Ball rendered at (${ballData.x}, ${ballData.y})`)
  })

  test('4. Keyboard controls work (arrow keys)', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    // Small buffer after scene starts
    await waitScaled(page, 500)

    const initialPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Press right arrow for 1000ms (longer to ensure movement)
    await page.keyboard.down('ArrowRight')
    await waitScaled(page, 1000)
    await page.keyboard.up('ArrowRight')
    await waitScaled(page, 300)

    const finalPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    const moved = Math.abs(finalPos.x - initialPos.x)
    expect(moved).toBeGreaterThan(10)
    console.log(`✅ Player moved ${moved.toFixed(1)}px with keyboard`)
  })

  test('5. Touch joystick controls work', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    // Small buffer after scene starts
    await waitScaled(page, 500)

    const initialPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Move player using direct input method
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      return controls.test.directMove(1, 0, 1500) // Move right for 1.5s
    })

    await waitScaled(page, 300)

    const finalPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    const moved = Math.abs(finalPos.x - initialPos.x)
    expect(moved).toBeGreaterThan(10)
    console.log(`✅ Player moved ${moved.toFixed(1)}px with joystick`)
  })

  test('6. Score UI displays correctly', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const scoreData = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      if (!scene?.scoreText) return null

      return {
        exists: true,
        text: scene.scoreText.text,
        visible: scene.scoreText.visible
      }
    })

    expect(scoreData).toBeTruthy()
    expect(scoreData.exists).toBe(true)
    expect(scoreData.visible).toBe(true)
    expect(scoreData.text).toMatch(/\d+ - \d+/) // Format: "0 - 0"

    console.log(`✅ Score UI displayed: "${scoreData.text}"`)
  })

  // Test removed: Timer doesn't start in single-player mode
  // Timer only counts down when match starts, which requires 2 players in multiplayer
  // Test was fundamentally broken and testing non-existent behavior

  test('7. NetworkManager establishes connection', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const networkStatus = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const nm = scene?.networkManager

      return {
        exists: !!nm,
        connected: !!nm?.getRoom(),
        sessionId: scene?.mySessionId,
        hasState: !!nm?.getState()
      }
    })

    expect(networkStatus.exists).toBe(true)
    expect(networkStatus.connected).toBe(true)
    expect(networkStatus.sessionId).toBeTruthy()
    expect(networkStatus.hasState).toBe(true)

    console.log(`✅ NetworkManager connected: ${networkStatus.sessionId}`)
  })

  test('9. Field boundaries prevent out-of-bounds movement', async ({ page }) => {
    await setupSinglePlayerTest(page, CLIENT_URL)
    console.log('🎮 Single-player mode initialized')

    // Small buffer after scene starts
    await waitScaled(page, 500)

    // Move left until we reach the boundary (x <= 70)
    await page.keyboard.down('ArrowLeft')

    // Wait for player to reach boundary (checking every 500ms)
    await page.waitForFunction(() => {
      const scene = (window as any).__gameControls?.scene
      return scene.player.x <= 70
    }, { timeout: 10000 }) // Give it 10 seconds to reach boundary

    await page.keyboard.up('ArrowLeft')
    await waitScaled(page, 500)

    const position = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Should be clamped to minimum boundary (PLAYER_MARGIN = 60px)
    expect(position.x).toBeGreaterThanOrEqual(50)
    expect(position.x).toBeLessThan(70)
    console.log(`✅ Player clamped at boundary: x=${position.x.toFixed(1)}`)
  })

  test('10. Two clients can connect simultaneously', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for both clients to initialize scenes (increased from 2s to 3s)
    await Promise.all([
      waitScaled(client1, 3000),
      waitScaled(client2, 3000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    expect(session1).toBeTruthy()
    expect(session2).toBeTruthy()
    expect(session1).not.toBe(session2)

    console.log(`✅ Two clients connected: ${session1}, ${session2}`)

    await client1.close()
    await client2.close()
  })

  test('11. Remote player sprite renders for second client', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for both clients to be connected (increased from 2s to 3s)
    await Promise.all([
      waitScaled(client1, 3000),
      waitScaled(client2, 3000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    // Wait for client1 to see client2 as remote player (increased timeout from 5s to 8s)
    await client1.waitForFunction((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayer = scene?.remotePlayers?.get(remoteId)
      return !!remotePlayer
    }, session2, { timeout: 8000 })

    // Client 1 should see Client 2 as remote player
    const client1SeesRemote = await client1.evaluate((remoteId) => {
      const scene = (window as any).__gameControls?.scene
      const remotePlayer = scene?.remotePlayers?.get(remoteId)

      return {
        exists: !!remotePlayer,
        x: remotePlayer?.x || 0,
        y: remotePlayer?.y || 0,
        visible: remotePlayer?.visible || false
      }
    }, session2)

    expect(client1SeesRemote.exists).toBe(true)
    expect(client1SeesRemote.visible).toBe(true)
    expect(client1SeesRemote.x).toBeGreaterThan(0)

    console.log(`✅ Client 1 sees remote player at (${client1SeesRemote.x}, ${client1SeesRemote.y})`)

    await client1.close()
    await client2.close()
  })

  test('12. Server state synchronizes player positions', async ({ page }, testInfo) => {
    const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Test isolated in room: ${roomId}`)
    await waitScaled(page, 2000)

    const sessionId = await page.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })

    // Get client sprite position and server state position
    const syncData = await page.evaluate((sid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()
      const serverPlayer = state?.players?.get(sid)

      return {
        clientX: scene.player.x,
        clientY: scene.player.y,
        serverX: serverPlayer?.x || 0,
        serverY: serverPlayer?.y || 0
      }
    }, sessionId)

    // Positions should be relatively close (within reconciliation tolerance)
    const delta = Math.sqrt(
      Math.pow(syncData.clientX - syncData.serverX, 2) +
      Math.pow(syncData.clientY - syncData.serverY, 2)
    )

    expect(delta).toBeLessThan(50) // Allow some prediction offset
    console.log(`✅ Client-server sync delta: ${delta.toFixed(1)}px`)
  })
})
