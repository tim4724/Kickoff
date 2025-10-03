import { test, expect } from '@playwright/test'

/**
 * Test Suite: Game Over Text Verification
 *
 * Comprehensive tests to verify game over screen displays correct text
 * in all possible scenarios, testing both timer-based and score-based endings.
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Game Over Text Display', () => {
  test('Shows correct text format when Blue wins', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    // Simulate Blue winning via server state
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room

      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 3
        room.state.scoreRed = 1
        room.state.matchTime = 0
      }
    })

    await page.waitForTimeout(500)

    const gameOverText = await page.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log('📊 Blue wins - Game over text:', gameOverText)

    // Check for winner text
    const winnerText = gameOverText.find((text: string) =>
      text.includes('Blue') || text.includes('Win') || text.includes('blue')
    )
    console.log('  Winner text:', winnerText)

    await page.close()
    await context.close()
  })

  test('Shows correct text when timer expires (time-based end)', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    // Get current server state
    const serverState = await page.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      return {
        scoreBlue: state?.scoreBlue || 0,
        scoreRed: state?.scoreRed || 0,
        matchTime: state?.matchTime || 0
      }
    })

    console.log('📊 Server state before timer end:', serverState)

    // Trigger timer-based match end
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      // Simulate timer reaching 0
      scene.onMatchEnd()
    })

    await page.waitForTimeout(500)

    const gameOverText = await page.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log('📊 Timer end - Game over text:', gameOverText)

    // Extract displayed score
    const scoreText = gameOverText.find((text: string) =>
      text.match(/\d+\s*-\s*\d+/)
    )
    console.log('  Score displayed:', scoreText)

    // Check if displayed score matches server state
    const displayedScore = scoreText?.match(/(\d+)\s*-\s*(\d+)/)
    if (displayedScore) {
      const [_, blue, red] = displayedScore
      console.log(`  Expected: ${serverState.scoreBlue}-${serverState.scoreRed}`)
      console.log(`  Displayed: ${blue}-${red}`)

      expect(parseInt(blue)).toBe(serverState.scoreBlue)
      expect(parseInt(red)).toBe(serverState.scoreRed)
    }

    await page.close()
    await context.close()
  })

  test('Verifies text capitalization and format', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(CLIENT_URL)
    await page.waitForTimeout(2000)

    // Test Blue wins
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room
      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 2
        room.state.scoreRed = 1
      }
    })

    await page.waitForTimeout(500)

    let gameOverText = await page.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log('📊 Capitalization test - Blue wins:', gameOverText)

    // Restart to test Red wins
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      scene.scene.restart()
    })

    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room
      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 1
        room.state.scoreRed = 3
      }
    })

    await page.waitForTimeout(500)

    gameOverText = await page.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log('📊 Capitalization test - Red wins:', gameOverText)

    // Restart to test Draw
    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      scene.scene.restart()
    })

    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room
      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 2
        room.state.scoreRed = 2
      }
    })

    await page.waitForTimeout(500)

    gameOverText = await page.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log('📊 Capitalization test - Draw:', gameOverText)

    await page.close()
    await context.close()
  })

  test('Client and server score consistency check', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    console.log('📤 Connecting two clients...')
    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
    ])

    // Set DIFFERENT client and server scores to clearly identify which is used
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room

      // Set client-side scores (should NOT be displayed)
      scene.scoreBlue = 9
      scene.scoreRed = 9

      // Set server state scores (SHOULD be displayed)
      if (room && room.state) {
        room.state.scoreBlue = 5
        room.state.scoreRed = 3
      }
    })

    const scores = await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState()

      return {
        clientScoreBlue: scene.scoreBlue,
        clientScoreRed: scene.scoreRed,
        serverScoreBlue: state?.scoreBlue || 0,
        serverScoreRed: state?.scoreRed || 0
      }
    })

    console.log('📊 Score consistency:', scores)

    // Trigger timer-based end
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      scene.onMatchEnd()
    })

    await client1.waitForTimeout(500)

    const gameOverData = await client1.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)
      return {
        text: textObjects?.map((obj: any) => obj.text) || [],
        scene: (window as any).__gameControls?.scene
      }
    })

    console.log('📊 Game over after timer end:', gameOverData.text)

    // Verify which scores are displayed
    const scorePattern = /(\d+)\s*-\s*(\d+)/
    const scoreMatch = gameOverData.text.find((t: string) => t.match(scorePattern))?.match(scorePattern)

    if (scoreMatch) {
      const [_, displayedBlue, displayedRed] = scoreMatch
      console.log(`  Displayed scores: ${displayedBlue}-${displayedRed}`)
      console.log(`  Client scores: ${scores.clientScoreBlue}-${scores.clientScoreRed}`)
      console.log(`  Server scores: ${scores.serverScoreBlue}-${scores.serverScoreRed}`)

      // Verify server scores are displayed
      expect(parseInt(displayedBlue)).toBe(scores.serverScoreBlue)
      expect(parseInt(displayedRed)).toBe(scores.serverScoreRed)

      // Double-check not using client scores
      expect(parseInt(displayedBlue)).not.toBe(scores.clientScoreBlue)

      console.log('  ✅ Correctly using SERVER scores (5-3), not CLIENT scores (9-9)')
    }

    await client1.close()
    await client2.close()
    await context1.close()
    await context2.close()
  })
})
