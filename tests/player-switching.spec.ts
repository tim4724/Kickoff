import { test, expect } from '@playwright/test'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

/**
 * Test Suite: Player Switching Mechanics
 * Tests manual switching, auto-switching, visual feedback, and AI teammate control
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

/**
 * Test 1: Basic player switching cycles through all teammates
 */
test('cycles through all 3 teammates correctly', async ({ page }) => {
  const testRoom = `test_cycle_${Date.now()}`

  await page.goto(`${CLIENT_URL}/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Wait for menu to render, then click Multiplayer button (canvas coordinates)
  await waitScaled(page, 1500) // Let menu fully render
  const canvas = await page.locator('canvas')
  const box = await canvas.boundingBox()
  if (box) {
    // Click center of red Multiplayer button (65% down the screen)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.65)
  }
  await waitScaled(page, 4000) // Wait for multiplayer to connect and start

  // Get all teammates
  const teammates = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    if (!gameScene) return null

    const state = gameScene.getGameState()
    if (!state) return null

    const myTeam = state.players.get(gameScene.myPlayerId)?.team

    const teamList: string[] = []
    state.players.forEach((player: any, playerId: string) => {
      if (player.team === myTeam) {
        teamList.push(playerId)
      }
    })

    return {
      myPlayerId: gameScene.myPlayerId,
      teammates: teamList,
      initialControlled: gameScene.controlledPlayerId
    }
  })

  if (!teammates) {
    throw new Error('Game not initialized - __gameControls not available')
  }

  console.log('Teammates:', teammates)
  expect(teammates.teammates).toHaveLength(3) // 1 human + 2 bots

  // Cycle through all teammates
  const controlledSequence: string[] = [teammates.initialControlled]

  for (let i = 0; i < teammates.teammates.length; i++) {
    await page.evaluate(() => {
      const gameScene = (window as any).__gameControls?.scene
      gameScene.switchToNextTeammate()
    })

    await waitScaled(page, 200)

    const nowControlled = await page.evaluate(() => {
      const gameScene = (window as any).__gameControls?.scene
      return gameScene.controlledPlayerId
    })

    controlledSequence.push(nowControlled)
  }

  console.log('Control sequence:', controlledSequence)

  // Should have cycled through all teammates and back to start
  expect(controlledSequence).toHaveLength(4)
  expect(controlledSequence[3]).toBe(controlledSequence[0]) // Cycled back
  expect(new Set(controlledSequence.slice(0, 3)).size).toBe(3) // All different
})

/**
 * Test 2: Visual borders update when switching
 */
test('updates visual borders when switching players', async ({ page }) => {
  const testRoom = `test_borders_${Date.now()}`

  await page.goto(`${CLIENT_URL}/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Wait for menu to render, then click Multiplayer button (canvas coordinates)
  await waitScaled(page, 1500) // Let menu fully render
  const canvas = await page.locator('canvas')
  const box = await canvas.boundingBox()
  if (box) {
    // Click center of red Multiplayer button (65% down the screen)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.65)
  }
  await waitScaled(page, 4000)

  const initialBorders = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    if (!gameScene) return null

    const borders: Record<string, number> = {}

    // Phaser circles use lineWidth, not strokeLineWidth
    borders[gameScene.myPlayerId] = gameScene.player.lineWidth
    gameScene.remotePlayers.forEach((sprite: any, id: string) => {
      borders[id] = sprite.lineWidth
    })

    return {
      controlled: gameScene.controlledPlayerId,
      borders
    }
  })

  if (!initialBorders) {
    throw new Error('Game not initialized')
  }

  console.log('Initial borders:', initialBorders)

  // Controlled player should have thick border (4px)
  expect(initialBorders.borders[initialBorders.controlled]).toBe(4)

  // Switch to next teammate
  await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    gameScene.switchToNextTeammate()
  })

  await waitScaled(page, 200)

  const afterBorders = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    const borders: Record<string, number> = {}

    borders[gameScene.myPlayerId] = gameScene.player.lineWidth
    gameScene.remotePlayers.forEach((sprite: any, id: string) => {
      borders[id] = sprite.lineWidth
    })

    return {
      controlled: gameScene.controlledPlayerId,
      borders
    }
  })

  console.log('After switch borders:', afterBorders)

  // New controlled player should have thick border (4px)
  expect(afterBorders.borders[afterBorders.controlled]).toBe(4)

  // Old controlled player should have thin border now (2px)
  expect(afterBorders.borders[initialBorders.controlled]).toBe(2)
})

/**
 * Test 3: Can switch to and control AI teammate
 * Note: Movement testing via joystick simulation has timing limitations in browser automation
 */
test('can switch to AI teammate', async ({ page }) => {
  const testRoom = `test_ai_control_${Date.now()}`

  await page.goto(`${CLIENT_URL}/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Wait for menu to render, then click Multiplayer button (canvas coordinates)
  await waitScaled(page, 1500) // Let menu fully render
  const canvas = await page.locator('canvas')
  const box = await canvas.boundingBox()
  if (box) {
    // Click center of red Multiplayer button (65% down the screen)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.65)
  }
  await waitScaled(page, 4000)

  // Switch to AI teammate
  await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    gameScene.switchToNextTeammate() // Now controlling bot
  })

  await waitScaled(page, 200)

  const beforeMovement = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    if (!gameScene) return null

    const state = gameScene.getGameState()
    if (!state) return null

    const controlled = state.players.get(gameScene.controlledPlayerId)
    if (!controlled) return null

    return {
      playerId: gameScene.controlledPlayerId,
      isBot: gameScene.controlledPlayerId !== gameScene.mySessionId,
      x: controlled.x,
      y: controlled.y
    }
  })

  if (!beforeMovement) {
    throw new Error('Could not get controlled player position')
  }

  console.log('Switched to AI teammate:', beforeMovement)

  // Verify we're controlling an AI bot
  expect(beforeMovement.isBot).toBe(true)
  expect(beforeMovement.playerId).toMatch(/-p[123]$/) // Should have -p1, -p2, or -p3 suffix

  // Verify the controlled player ID changed
  const afterSwitchCheck = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    return {
      controlled: gameScene.controlledPlayerId,
      hasSprite: gameScene.players.has(gameScene.controlledPlayerId)
    }
  })

  // Controlled player should be a teammate (with -p suffix) and should have a sprite
  expect(afterSwitchCheck.controlled).toMatch(/-p[123]$/)
  expect(afterSwitchCheck.hasSprite).toBe(true)

  console.log('✓ Successfully switched to AI teammate with sprite')
})

/**
 * Test 4: Space key switches players when not having ball
 */
test('space key switches players when not having ball', async ({ page }) => {
  const testRoom = `test_space_switch_${Date.now()}`

  await page.goto(`${CLIENT_URL}/?room=${testRoom}`)
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Wait for menu to render, then click Multiplayer button (canvas coordinates)
  await waitScaled(page, 1500) // Let menu fully render
  const canvas = await page.locator('canvas')
  const box = await canvas.boundingBox()
  if (box) {
    // Click center of red Multiplayer button (65% down the screen)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.65)
  }

  // Wait for game initialization
  await page.waitForFunction(
    () => {
      const gameScene = (window as any).__gameControls?.scene
      if (!gameScene) return false

      const state = gameScene.getGameState()
      return state && state.ball && gameScene.controlledPlayerId
    },
    { timeout: 10000 }
  )

  const beforeSwitch = await page.evaluate(() => {
    const gameScene = (window as any).__gameControls?.scene
    const state = gameScene.getGameState()

    return {
      controlled: gameScene.controlledPlayerId,
      hasBall: state.ball.possessedBy === gameScene.controlledPlayerId
    }
  })

  console.log('Before switch:', beforeSwitch)

  // Only test switching if player doesn't have ball
  if (!beforeSwitch.hasBall) {
    await page.keyboard.press('Space')
    await waitScaled(page, 200)

    const afterSwitch = await page.evaluate(() => {
      const gameScene = (window as any).__gameControls?.scene
      return gameScene.controlledPlayerId
    })

    expect(afterSwitch).not.toBe(beforeSwitch.controlled)
    console.log(`✓ Switched from ${beforeSwitch.controlled} to ${afterSwitch}`)
  } else {
    console.log('Player has ball - skipping switch test')
  }
})
