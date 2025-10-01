import { test, expect, Page } from '@playwright/test'

/**
 * Core Features Regression Test Suite
 *
 * Purpose: Protect working features from breaking during future development
 * - Tests fundamental game mechanics
 * - Fast execution (< 30 seconds total)
 * - High reliability (no flaky tests)
 * - Run on every commit
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Core Features Regression Suite', () => {
  test('1. Single client can connect and initialize', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    const sessionId = await page.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })

    expect(sessionId).toBeTruthy()
    expect(typeof sessionId).toBe('string')
    console.log(`✅ Client connected: ${sessionId}`)
  })

  test('2. Player sprite renders and has valid position', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

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

  test('3. Ball sprite renders at center field', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

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

    // Ball should be near center (400x300 field)
    expect(ballData.x).toBeGreaterThan(300)
    expect(ballData.x).toBeLessThan(500)
    expect(ballData.y).toBeGreaterThan(200)
    expect(ballData.y).toBeLessThan(400)

    console.log(`✅ Ball rendered at (${ballData.x}, ${ballData.y})`)
  })

  test('4. Keyboard controls work (arrow keys)', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    const initialPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Press right arrow for 500ms
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(500)
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(300)

    const finalPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    const moved = Math.abs(finalPos.x - initialPos.x)
    expect(moved).toBeGreaterThan(10)
    console.log(`✅ Player moved ${moved.toFixed(1)}px with keyboard`)
  })

  test('5. Touch joystick controls work', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    const initialPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Simulate joystick touch and drag
    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.touchJoystick(150, 300)
      controls.test.dragJoystick(200, 300) // Move right
    })

    await page.waitForTimeout(500)

    await page.evaluate(() => {
      const controls = (window as any).__gameControls
      controls.test.releaseJoystick()
    })

    await page.waitForTimeout(300)

    const finalPos = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    const moved = Math.abs(finalPos.x - initialPos.x)
    expect(moved).toBeGreaterThan(10)
    console.log(`✅ Player moved ${moved.toFixed(1)}px with joystick`)
  })

  test('6. Score UI displays correctly', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

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

  test('7. Match timer counts down', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    const initialTime = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.timeRemaining
    })

    // Wait longer to ensure timer has actually ticked
    await page.waitForTimeout(3000)

    const laterTime = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.timeRemaining
    })

    // Timer should have decreased by at least 1 second
    expect(initialTime - laterTime).toBeGreaterThan(0.5)
    console.log(`✅ Timer counting down: ${initialTime}s → ${laterTime}s (Δ=${(initialTime - laterTime).toFixed(1)}s)`)
  })

  test('8. NetworkManager establishes connection', async ({ page }) => {
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

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
    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    // Try to move far left (should be clamped)
    await page.keyboard.down('ArrowLeft')
    await page.waitForTimeout(2000)
    await page.keyboard.up('ArrowLeft')
    await page.waitForTimeout(300)

    const position = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return { x: scene.player.x, y: scene.player.y }
    })

    // Should be clamped to minimum boundary (~30px)
    expect(position.x).toBeGreaterThanOrEqual(20)
    expect(position.x).toBeLessThan(50)
    console.log(`✅ Player clamped at boundary: x=${position.x.toFixed(1)}`)
  })

  test('10. Two clients can connect simultaneously', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
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

  test('11. Remote player sprite renders for second client', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(3000), // Extra time for sync
      client2.waitForTimeout(3000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

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

  test('12. Server state synchronizes player positions', async ({ browser }) => {
    const context1 = await browser.newContext()
    const client = await context1.newPage()

    await client.goto(CLIENT_URL)
    await client.waitForTimeout(2000)

    const sessionId = await client.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })

    // Get client sprite position and server state position
    const syncData = await client.evaluate((sid) => {
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

    await client.close()
  })
})
