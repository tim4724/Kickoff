import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'

/**
 * Test Suite: Game Over Screen Display
 *
 * Validates that the game over screen shows correct winner text and score
 * based on authoritative server state, not client-side state.
 *
 * Tests verify:
 * - Winner text matches server score (Blue wins, Red wins, Draw)
 * - Score display uses server state values
 * - All scenarios handled correctly
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Game Over Screen', () => {
  test('Shows correct winner text when Blue team wins', async ({ browser }, testInfo) => {
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

    // Verify match is playing
    const phase = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      return state?.phase || 'unknown'
    })

    console.log(`  Match phase: ${phase}`)
    expect(phase).toBe('playing')

    // Simulate Blue team scoring by manipulating server state
    // (In real scenario, this would happen through gameplay)
    console.log('\n📤 Simulating Blue team score...')

    // Force match to end with Blue winning
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room

      // Trigger game over by simulating server state
      if (room && room.state) {
        // Simulate server updating state to ended with Blue winning
        room.state.phase = 'ended'
        room.state.scoreBlue = 3
        room.state.scoreRed = 1
        room.state.matchTime = 0
      }
    })

    await client1.waitForTimeout(1000)

    // Check game over screen displays correct winner
    const gameOverText = await client1.evaluate(() => {
      // Find game over text elements (they should be at high depth)
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)

      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log(`\n📊 Game over screen text:`, gameOverText)

    // Verify Blue team win message
    const hasWinnerText = gameOverText.some((text: string) =>
      text.includes('Blue') && text.includes('Win')
    )
    expect(hasWinnerText).toBe(true)

    // Verify correct score (3-1)
    const hasCorrectScore = gameOverText.some((text: string) =>
      text.includes('3') && text.includes('1')
    )
    expect(hasCorrectScore).toBe(true)

    await client1.close()
    await client2.close()
    await context1.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Blue team win displayed correctly')
  })

  test('Shows correct winner text when Red team wins', async ({ browser }, testInfo) => {
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

    console.log('\n📤 Simulating Red team score...')

    // Force match to end with Red winning
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room

      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 1
        room.state.scoreRed = 4
        room.state.matchTime = 0
      }
    })

    await client1.waitForTimeout(1000)

    const gameOverText = await client1.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)

      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log(`\n📊 Game over screen text:`, gameOverText)

    // Verify Red team win message
    const hasWinnerText = gameOverText.some((text: string) =>
      text.includes('Red') && text.includes('Win')
    )
    expect(hasWinnerText).toBe(true)

    // Verify correct score (1-4)
    const hasCorrectScore = gameOverText.some((text: string) =>
      text.includes('1') && text.includes('4')
    )
    expect(hasCorrectScore).toBe(true)

    await client1.close()
    await client2.close()
    await context1.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Red team win displayed correctly')
  })

  test('Shows draw message when scores are equal', async ({ browser }, testInfo) => {
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

    console.log('\n📤 Simulating draw scenario...')

    // Force match to end with draw
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const room = scene?.networkManager?.room

      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 2
        room.state.scoreRed = 2
        room.state.matchTime = 0
      }
    })

    await client1.waitForTimeout(1000)

    const gameOverText = await client1.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)

      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log(`\n📊 Game over screen text:`, gameOverText)

    // Verify draw message
    const hasDrawText = gameOverText.some((text: string) =>
      text.toLowerCase().includes('draw')
    )
    expect(hasDrawText).toBe(true)

    // Verify correct score (2-2)
    const hasCorrectScore = gameOverText.some((text: string) =>
      text.includes('2') && text.split('2').length === 3 // "2 - 2" contains '2' twice
    )
    expect(hasCorrectScore).toBe(true)

    await client1.close()
    await client2.close()
    await context1.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Draw displayed correctly')
  })

  test('Uses server state scores, not client state', async ({ browser }, testInfo) => {
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

    console.log('\n📤 Testing server state vs client state...')

    // Set different client and server scores to verify server wins
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene

      // Set client-side scores (these should NOT be displayed)
      scene.scoreBlue = 0
      scene.scoreRed = 0

      // Set server state scores (these SHOULD be displayed)
      const room = scene?.networkManager?.room
      if (room && room.state) {
        room.state.phase = 'ended'
        room.state.scoreBlue = 5
        room.state.scoreRed = 3
        room.state.matchTime = 0
      }
    })

    await client1.waitForTimeout(1000)

    const gameOverText = await client1.evaluate(() => {
      const textObjects = (window as any).__gameControls?.scene?.children?.list
        ?.filter((obj: any) => obj.type === 'Text' && obj.depth >= 2000)

      return textObjects?.map((obj: any) => obj.text) || []
    })

    console.log(`\n📊 Game over screen text:`, gameOverText)

    // Verify server state scores are displayed (5-3), not client scores (0-0)
    const hasServerScore = gameOverText.some((text: string) =>
      text.includes('5') && text.includes('3')
    )
    expect(hasServerScore).toBe(true)

    const hasClientScore = gameOverText.some((text: string) =>
      text.includes('0') && text.includes('0')
    )
    expect(hasClientScore).toBe(false)

    await client1.close()
    await client2.close()
    await context1.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Server state scores used correctly')
  })
})
