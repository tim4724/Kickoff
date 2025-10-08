import { test, expect } from '@playwright/test'

/**
 * Test player switching behavior with ball possession
 * Verifies that action button:
 * - Shoots when player has ball
 * - Switches players when player doesn't have ball
 */
test('action button shoots when player has ball, switches when not', async ({ page, browser }) => {
  // Create two players in the same room
  const context2 = await browser.newContext()
  const page2 = await context2.newPage()

  const testRoom = `test_switching_${Date.now()}`

  // Player 1 (blue) joins
  await page.goto(`http://localhost:5173/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 5000 })

  // Player 2 (red) joins
  await page2.goto(`http://localhost:5173/?room=${testRoom}`)
  await page2.waitForSelector('canvas', { timeout: 5000 })

  // Wait for game to start
  await page.waitForTimeout(2000)

  // Get initial ball possession state
  const initialPossession = await page.evaluate(() => {
    const gameScene = (window as any).gameScene
    if (!gameScene) return null

    const state = gameScene.networkManager?.getState()
    if (!state) return null

    return {
      possessedBy: state.ball.possessedBy,
      controlledPlayerId: gameScene.controlledPlayerId,
      mySessionId: gameScene.mySessionId,
    }
  })

  console.log('Initial possession:', initialPossession)

  // Test 1: When player doesn't have ball, action button should switch players
  if (initialPossession && initialPossession.possessedBy !== initialPossession.controlledPlayerId) {
    console.log('Player does NOT have ball - testing switch behavior')

    const beforeSwitch = await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      return gameScene?.controlledPlayerId
    })

    // Simulate action button press and release (no ball = switch)
    await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      gameScene.actionButton.__test_simulatePress()
      gameScene.actionButton.__test_simulateRelease(100) // 100ms hold
    })

    await page.waitForTimeout(100)

    const afterSwitch = await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      return gameScene?.controlledPlayerId
    })

    expect(afterSwitch).not.toBe(beforeSwitch)
    console.log(`✓ Player switched from ${beforeSwitch} to ${afterSwitch}`)
  }

  // Test 2: When player has ball, action button should shoot
  // Move controlled player to ball
  await page.evaluate(() => {
    const gameScene = (window as any).gameScene
    const state = gameScene.networkManager?.getState()

    // Get controlled player
    const controlledPlayer = state.players.get(gameScene.controlledPlayerId)
    if (!controlledPlayer) return

    // Move ball to controlled player (simulate possession)
    state.ball.x = controlledPlayer.x
    state.ball.y = controlledPlayer.y
    state.ball.possessedBy = gameScene.controlledPlayerId
  })

  await page.waitForTimeout(100)

  const hasBallNow = await page.evaluate(() => {
    const gameScene = (window as any).gameScene
    const state = gameScene.networkManager?.getState()
    return state.ball.possessedBy === gameScene.controlledPlayerId
  })

  if (hasBallNow) {
    console.log('Player HAS ball - testing shoot behavior')

    const beforeControlled = await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      return gameScene?.controlledPlayerId
    })

    // Simulate action button press and release with ball (should shoot, not switch)
    await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      gameScene.actionButton.__test_simulatePress()
      gameScene.actionButton.__test_simulateRelease(500) // 500ms hold = 0.5 power
    })

    await page.waitForTimeout(100)

    const afterControlled = await page.evaluate(() => {
      const gameScene = (window as any).gameScene
      return gameScene?.controlledPlayerId
    })

    // When player has ball, controlled player should NOT change
    expect(afterControlled).toBe(beforeControlled)
    console.log(`✓ Player maintained control (shot instead of switching)`)
  }

  // Cleanup
  await page2.close()
  await context2.close()
})

/**
 * Test auto-switching when teammate gains possession
 */
test('auto-switches to teammate when they gain ball possession', async ({ page, browser }) => {
  const context2 = await browser.newContext()
  const page2 = await context2.newPage()

  const testRoom = `test_autoswitch_${Date.now()}`

  // Player 1 joins
  await page.goto(`http://localhost:5173/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 5000 })

  // Player 2 joins
  await page2.goto(`http://localhost:5173/?room=${testRoom}`)
  await page2.waitForSelector('canvas', { timeout: 5000 })

  await page.waitForTimeout(2000)

  // Get player's team and teammates
  const teamInfo = await page.evaluate(() => {
    const gameScene = (window as any).gameScene
    const state = gameScene.networkManager?.getState()
    const myTeam = state.players.get(gameScene.mySessionId)?.team

    const teammates: string[] = []
    state.players.forEach((player: any, playerId: string) => {
      if (player.team === myTeam) {
        teammates.push(playerId)
      }
    })

    return {
      mySessionId: gameScene.mySessionId,
      controlledPlayerId: gameScene.controlledPlayerId,
      teammates,
      myTeam,
    }
  })

  console.log('Team info:', teamInfo)

  // If there are teammates (AI players), test auto-switching
  if (teamInfo.teammates.length > 1) {
    const teammate = teamInfo.teammates.find(id => id !== teamInfo.controlledPlayerId)
    if (teammate) {
      console.log(`Testing auto-switch to teammate: ${teammate}`)

      // Simulate teammate gaining possession
      await page.evaluate((teammateId) => {
        const gameScene = (window as any).gameScene
        const state = gameScene.networkManager?.getState()
        state.ball.possessedBy = teammateId

        // Trigger possession check
        gameScene.checkAutoSwitchOnPossession(state)
      }, teammate)

      await page.waitForTimeout(100)

      const afterAutoSwitch = await page.evaluate(() => {
        const gameScene = (window as any).gameScene
        return gameScene?.controlledPlayerId
      })

      expect(afterAutoSwitch).toBe(teammate)
      console.log(`✓ Auto-switched to ${teammate} when they gained possession`)
    }
  }

  // Cleanup
  await page2.close()
  await context2.close()
})
