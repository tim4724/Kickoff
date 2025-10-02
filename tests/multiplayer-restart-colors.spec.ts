import { test, expect, Browser } from '@playwright/test'

/**
 * Test Suite: Multiplayer Color Assignment After Restart
 *
 * This test verifies that team colors are correctly assigned when clients
 * restart after a match ends. This is a regression test for a bug where
 * both clients would sometimes get the same color after restart.
 */

const CLIENT_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = './test-results/restart-colors'

const BLUE_COLOR = 26367      // 0x0066ff
const RED_COLOR = 16729156    // 0xff4444

test.describe('Multiplayer Restart Color Assignment', () => {
  test('Clients have different colors after match restart', async ({ browser }) => {
    // Create two clients
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Initial connection
    console.log('📤 Step 1: Initial connection...')
    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL)
    ])

    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
    ])

    // Get initial colors
    const initialColors = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor),
      client2.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor)
    ])

    console.log(`Initial colors: Client1=${initialColors[0]}, Client2=${initialColors[1]}`)

    const client1InitialBlue = initialColors[0] === BLUE_COLOR
    const client2InitialBlue = initialColors[1] === BLUE_COLOR

    // Verify initial colors are different
    expect(client1InitialBlue).not.toBe(client2InitialBlue)
    console.log('✅ Initial color check passed')

    // Simulate match end and restart
    console.log('\n📤 Step 2: Simulating match restart...')

    // Restart both scenes (this triggers the bug scenario)
    await Promise.all([
      client1.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        if (scene) {
          scene.scene.restart()
        }
      }),
      client2.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        if (scene) {
          scene.scene.restart()
        }
      })
    ])

    // Wait for scenes to restart and reconnect
    await Promise.all([
      client1.waitForTimeout(3000),
      client2.waitForTimeout(3000)
    ])

    // Get colors after restart
    const afterRestartColors = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor),
      client2.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor)
    ])

    console.log(`After restart colors: Client1=${afterRestartColors[0]}, Client2=${afterRestartColors[1]}`)

    const client1AfterBlue = afterRestartColors[0] === BLUE_COLOR
    const client2AfterBlue = afterRestartColors[1] === BLUE_COLOR

    // Take screenshots
    await client1.screenshot({ path: `${SCREENSHOT_DIR}/client1-after-restart.png` })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/client2-after-restart.png` })

    // CRITICAL: Verify colors are still different after restart
    console.log(`\nColor verification:`)
    console.log(`  Client 1: ${client1AfterBlue ? 'BLUE' : 'RED'}`)
    console.log(`  Client 2: ${client2AfterBlue ? 'BLUE' : 'RED'}`)

    expect(client1AfterBlue).not.toBe(client2AfterBlue)
    console.log('✅ After-restart color check passed')

    // Also verify remote players have opposite colors
    const [client1Remote, client2Remote] = await Promise.all([
      client1.evaluate(() => {
        const remotePlayers = Array.from((window as any).__gameControls?.scene?.remotePlayers?.values() || [])
        return remotePlayers[0]?.fillColor
      }),
      client2.evaluate(() => {
        const remotePlayers = Array.from((window as any).__gameControls?.scene?.remotePlayers?.values() || [])
        return remotePlayers[0]?.fillColor
      })
    ])

    if (client1Remote !== undefined && client2Remote !== undefined) {
      console.log(`\nRemote player colors:`)
      console.log(`  Client 1 sees remote: ${client1Remote === BLUE_COLOR ? 'BLUE' : 'RED'}`)
      console.log(`  Client 2 sees remote: ${client2Remote === BLUE_COLOR ? 'BLUE' : 'RED'}`)

      // Client1's remote should be opposite of Client1's local
      expect(client1Remote).toBe(client1AfterBlue ? RED_COLOR : BLUE_COLOR)
      // Client2's remote should be opposite of Client2's local
      expect(client2Remote).toBe(client2AfterBlue ? RED_COLOR : BLUE_COLOR)

      console.log('✅ Remote player color check passed')
    }

    await client1.close()
    await client2.close()

    console.log('\n✅ TEST PASSED: Colors remain different after restart')
  })

  test('Multiple rapid restarts maintain color consistency', async ({ browser }) => {
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

    console.log('📤 Testing multiple rapid restarts...')

    // Perform 3 rapid restarts
    for (let i = 0; i < 3; i++) {
      console.log(`\nRestart iteration ${i + 1}/3`)

      await Promise.all([
        client1.evaluate(() => (window as any).__gameControls?.scene?.scene.restart()),
        client2.evaluate(() => (window as any).__gameControls?.scene?.scene.restart())
      ])

      await Promise.all([
        client1.waitForTimeout(2000),
        client2.waitForTimeout(2000)
      ])

      const colors = await Promise.all([
        client1.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor),
        client2.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor)
      ])

      const client1IsBlue = colors[0] === BLUE_COLOR
      const client2IsBlue = colors[1] === BLUE_COLOR

      console.log(`  Client 1: ${client1IsBlue ? 'BLUE' : 'RED'}`)
      console.log(`  Client 2: ${client2IsBlue ? 'BLUE' : 'RED'}`)

      expect(client1IsBlue).not.toBe(client2IsBlue)
      console.log(`  ✅ Iteration ${i + 1} passed`)
    }

    await client1.close()
    await client2.close()

    console.log('\n✅ TEST PASSED: Multiple restarts maintain different colors')
  })
})
