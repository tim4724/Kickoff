import { test, expect, Page } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'

/**
 * Test: Initial Player Position Synchronization
 *
 * CRITICAL BUG: When a match starts, both clients show completely different
 * positions for the players. This test verifies that all clients see the
 * same initial player positions when the match begins.
 */

const CLIENT_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = './test-results/position-sync'

/**
 * Helper: Get all player positions from a client's perspective
 */
async function getAllPlayerPositions(page: Page): Promise<Map<string, { x: number; y: number; team: string }>> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.networkManager) return new Map()

    const state = scene.networkManager.getState()
    if (!state?.players) return new Map()

    const positions = new Map()
    state.players.forEach((player: any, sessionId: string) => {
      positions.set(sessionId, {
        x: player.x,
        y: player.y,
        team: player.team
      })
    })

    return Object.fromEntries(positions)
  }).then(obj => new Map(Object.entries(obj)))
}

/**
 * Helper: Get local player visual position (what's actually rendered on screen)
 */
async function getLocalPlayerVisualPosition(page: Page): Promise<{ x: number; y: number }> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.player) return { x: 0, y: 0 }

    return {
      x: scene.player.x,
      y: scene.player.y
    }
  })
}

/**
 * Helper: Get remote player visual positions (what's actually rendered on screen)
 */
async function getRemotePlayerVisualPositions(page: Page): Promise<Map<string, { x: number; y: number }>> {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (!scene?.remotePlayers) return new Map()

    const positions = new Map()
    scene.remotePlayers.forEach((sprite: any, sessionId: string) => {
      positions.set(sessionId, {
        x: sprite.x,
        y: sprite.y
      })
    })

    return Object.fromEntries(positions)
  }).then(obj => new Map(Object.entries(obj)))
}

test.describe('Initial Player Position Synchronization', () => {
  test('Initial Player Positions Match on Both Clients', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for game to load
    await Promise.all([client1.waitForTimeout(3000), client2.waitForTimeout(3000)])

    // Get session IDs
    const client1SessionId = await client1.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })
    const client2SessionId = await client2.evaluate(() => {
      return (window as any).__gameControls?.scene?.mySessionId
    })

    if (!client1SessionId || !client2SessionId) {
      throw new Error(
        `Failed to get session IDs\n` +
        `Client 1 Session: ${client1SessionId || 'undefined'}\n` +
        `Client 2 Session: ${client2SessionId || 'undefined'}`
      )
    }

    console.log(`✅ Client 1 Session: ${client1SessionId}`)
    console.log(`✅ Client 2 Session: ${client2SessionId}`)

    console.log('\n🧪 TEST: Initial Player Position Synchronization')
    console.log('=' .repeat(60))

    // Wait for both clients to sync with each other (longer wait for network propagation)
    await Promise.all([
      client1.waitForTimeout(2000),
      client2.waitForTimeout(2000)
    ])

    // Get server state from both clients
    const client1ServerPositions = await getAllPlayerPositions(client1)
    const client2ServerPositions = await getAllPlayerPositions(client2)

    console.log('\n📊 SERVER STATE (from Client 1 perspective):')
    client1ServerPositions.forEach((pos, sessionId) => {
      console.log(`  ${sessionId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) - Team: ${pos.team}`)
    })

    console.log('\n📊 SERVER STATE (from Client 2 perspective):')
    client2ServerPositions.forEach((pos, sessionId) => {
      console.log(`  ${sessionId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) - Team: ${pos.team}`)
    })

    // Get visual positions from both clients
    const client1LocalVisual = await getLocalPlayerVisualPosition(client1)
    const client1RemoteVisuals = await getRemotePlayerVisualPositions(client1)
    const client2LocalVisual = await getLocalPlayerVisualPosition(client2)
    const client2RemoteVisuals = await getRemotePlayerVisualPositions(client2)

    console.log('\n🎨 VISUAL RENDERING (Client 1):')
    console.log(`  Local Player: (${client1LocalVisual.x.toFixed(1)}, ${client1LocalVisual.y.toFixed(1)})`)
    client1RemoteVisuals.forEach((pos, sessionId) => {
      console.log(`  Remote Player ${sessionId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`)
    })

    console.log('\n🎨 VISUAL RENDERING (Client 2):')
    console.log(`  Local Player: (${client2LocalVisual.x.toFixed(1)}, ${client2LocalVisual.y.toFixed(1)})`)
    client2RemoteVisuals.forEach((pos, sessionId) => {
      console.log(`  Remote Player ${sessionId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`)
    })

    // Take screenshots for visual comparison
    await client1.screenshot({ path: `${SCREENSHOT_DIR}/client1-initial.png`, fullPage: false })
    await client2.screenshot({ path: `${SCREENSHOT_DIR}/client2-initial.png`, fullPage: false })

    // ASSERTION 1: Both clients should receive the same server state
    console.log('\n✓ ASSERTION 1: Server state consistency')
    expect(client1ServerPositions.size).toBe(client2ServerPositions.size)

    client1ServerPositions.forEach((pos1, sessionId) => {
      const pos2 = client2ServerPositions.get(sessionId)
      expect(pos2).toBeDefined()

      const xDiff = Math.abs(pos1.x - pos2!.x)
      const yDiff = Math.abs(pos1.y - pos2!.y)

      console.log(`  Player ${sessionId}: Δx=${xDiff.toFixed(1)}px, Δy=${yDiff.toFixed(1)}px`)

      expect(xDiff).toBeLessThan(1) // Server state should be identical
      expect(yDiff).toBeLessThan(1)
      expect(pos1.team).toBe(pos2!.team)
    })

    // ASSERTION 2: Visual positions should match server positions
    console.log('\n✓ ASSERTION 2: Visual rendering matches server state')

    // Client 1: Check local player visual matches server
    const client1ServerPos = client1ServerPositions.get(client1SessionId)!
    const client1LocalXDiff = Math.abs(client1LocalVisual.x - client1ServerPos.x)
    const client1LocalYDiff = Math.abs(client1LocalVisual.y - client1ServerPos.y)
    console.log(`  Client 1 local player: Δx=${client1LocalXDiff.toFixed(1)}px, Δy=${client1LocalYDiff.toFixed(1)}px`)
    expect(client1LocalXDiff).toBeLessThan(5)
    expect(client1LocalYDiff).toBeLessThan(5)

    // Client 2: Check local player visual matches server
    const client2ServerPos = client2ServerPositions.get(client2SessionId)!
    const client2LocalXDiff = Math.abs(client2LocalVisual.x - client2ServerPos.x)
    const client2LocalYDiff = Math.abs(client2LocalVisual.y - client2ServerPos.y)
    console.log(`  Client 2 local player: Δx=${client2LocalXDiff.toFixed(1)}px, Δy=${client2LocalYDiff.toFixed(1)}px`)
    expect(client2LocalXDiff).toBeLessThan(5)
    expect(client2LocalYDiff).toBeLessThan(5)

    // ASSERTION 3: Each client sees the other player in the same position
    console.log('\n✓ ASSERTION 3: Cross-client visual consistency')

    // Client 1 should see Client 2's player
    const client1SeesClient2 = client1RemoteVisuals.get(client2SessionId)
    expect(client1SeesClient2).toBeDefined()

    const client1ViewXDiff = Math.abs(client1SeesClient2!.x - client2ServerPos.x)
    const client1ViewYDiff = Math.abs(client1SeesClient2!.y - client2ServerPos.y)
    console.log(`  Client 1 sees Client 2: Δx=${client1ViewXDiff.toFixed(1)}px, Δy=${client1ViewYDiff.toFixed(1)}px`)
    expect(client1ViewXDiff).toBeLessThan(5)
    expect(client1ViewYDiff).toBeLessThan(5)

    // Client 2 should see Client 1's player
    const client2SeesClient1 = client2RemoteVisuals.get(client1SessionId)
    expect(client2SeesClient1).toBeDefined()

    const client2ViewXDiff = Math.abs(client2SeesClient1!.x - client1ServerPos.x)
    const client2ViewYDiff = Math.abs(client2SeesClient1!.y - client1ServerPos.y)
    console.log(`  Client 2 sees Client 1: Δx=${client2ViewXDiff.toFixed(1)}px, Δy=${client2ViewYDiff.toFixed(1)}px`)
    expect(client2ViewXDiff).toBeLessThan(5)
    expect(client2ViewYDiff).toBeLessThan(5)

    console.log('\n✅ TEST PASSED: Initial positions are synchronized across all clients')
    console.log('=' .repeat(60))

    await client1.close()
    await client2.close()
  })
})
