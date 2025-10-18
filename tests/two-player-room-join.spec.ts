import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'

/**
 * Test Suite: Two-Player Room Joining and Team Assignment
 *
 * Verifies critical multiplayer room joining behavior:
 * - Two clients can join the same room
 * - First client is assigned to blue team
 * - Second client is assigned to red team
 * - Match starts automatically when second client joins
 * - Each client controls 3 players (1 human + 2 switchable teammates)
 *
 * These tests ensure proper team balancing and match initialization.
 */

const CLIENT_URL = 'http://localhost:5173'
const BLUE_COLOR = 26367      // 0x0066ff
const RED_COLOR = 16729156    // 0xff4444

test.describe('Two-Player Room Joining', () => {
  test('Two clients join same room with correct team assignment', async ({ browser }, testInfo) => {
    console.log('📤 Step 1: Setting up two clients in same room...')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients to the same isolated room
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for clients to connect and initialize
    // Wait for page to load and scene to initialize
    await Promise.all([
      waitScaled(client1, 3000), // Give time for Phaser to initialize
      waitScaled(client2, 3000)
    ])

    console.log('\n📤 Step 2: Verifying session IDs...')

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    console.log(`  Client 1 session ID: ${session1}`)
    console.log(`  Client 2 session ID: ${session2}`)

    // Session IDs should be different
    expect(session1).toBeTruthy()
    expect(session2).toBeTruthy()
    expect(session1).not.toBe(session2)

    console.log('\n📤 Step 3: Verifying team assignments...')

    // Get team assignments from server state
    const [team1, team2] = await Promise.all([
      client1.evaluate((sid) => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.get(sid)?.team || null
      }, session1),
      client2.evaluate((sid) => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.get(sid)?.team || null
      }, session2)
    ])

    console.log(`  Client 1 team: ${team1}`)
    console.log(`  Client 2 team: ${team2}`)

    // Clients should be on different teams
    expect(team1).toBeTruthy()
    expect(team2).toBeTruthy()
    expect(team1).not.toBe(team2)

    console.log('\n📤 Step 4: Verifying player colors match teams...')

    // Get player colors from client-side sprites
    const [color1, color2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor),
      client2.evaluate(() => (window as any).__gameControls?.scene?.player?.fillColor)
    ])

    console.log(`  Client 1 color: ${color1}`)
    console.log(`  Client 2 color: ${color2}`)

    // Colors should match the teams and be different from each other
    expect(color1).toBeTruthy()
    expect(color2).toBeTruthy()
    expect(color1).not.toBe(color2)

    // One should be blue, one should be red
    const colors = [color1, color2].sort()
    const expectedColors = [BLUE_COLOR, RED_COLOR].sort()
    expect(colors).toEqual(expectedColors)

    console.log('\n📤 Step 5: Verifying match started automatically...')

    // Check game phase on both clients
    const [phase1, phase2] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      })
    ])

    console.log(`  Client 1 phase: ${phase1}`)
    console.log(`  Client 2 phase: ${phase2}`)

    // Match should be in 'playing' phase
    expect(phase1).toBe('playing')
    expect(phase2).toBe('playing')

    console.log('\n📤 Step 6: Verifying player counts (3v3 structure)...')

    // Check total player count (should be 6: 3 per team)
    const [playerCount1, playerCount2] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.size || 0
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.players?.size || 0
      })
    ])

    console.log(`  Client 1 sees ${playerCount1} players`)
    console.log(`  Client 2 sees ${playerCount2} players`)

    // Should have 6 total players (3 per team)
    expect(playerCount1).toBe(6)
    expect(playerCount2).toBe(6)

    console.log('\n📤 Step 7: Verifying isHuman flags (only session players)...')

    // Count human players (should be 2: one per session)
    const humanCount = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      let count = 0
      state?.players?.forEach((player: any) => {
        if (player.isHuman) count++
      })
      return count
    })

    console.log(`  Human players: ${humanCount}`)
    expect(humanCount).toBe(2)

    console.log('\n📤 Step 8: Verifying room ID consistency...')

    // Both clients should be in the same room
    const [room1, room2] = await Promise.all([
      client1.evaluate(() => {
        const room = (window as any).__gameControls?.scene?.networkManager?.getRoom()
        return room?.id || null
      }),
      client2.evaluate(() => {
        const room = (window as any).__gameControls?.scene?.networkManager?.getRoom()
        return room?.id || null
      })
    ])

    console.log(`  Client 1 room ID: ${room1}`)
    console.log(`  Client 2 room ID: ${room2}`)

    // Both should be in the same room
    expect(room1).toBeTruthy()
    expect(room2).toBeTruthy()
    expect(room1).toBe(room2)

    // Cleanup
    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Two clients joined same room with correct teams')
  })

  test('Match starts immediately when second player joins', async ({ browser }, testInfo) => {
    console.log('📤 Testing match start timing...\n')

    const context1 = await browser.newContext()
    const client1 = await context1.newPage()

    // Generate room ID
    const testRoomId = `test-w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`🔒 Test room: ${testRoomId}`)

    // Step 1: First client joins
    console.log('Step 1: First client joins...')
    await client1.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client1.goto(CLIENT_URL)
    await waitScaled(client1, 1500) // Wait 1.5s (less than 2s timeout)

    // Check phase (should be 'waiting')
    const phaseBeforeSecond = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      return state?.phase || null
    })

    console.log(`  Phase with 1 player: ${phaseBeforeSecond}`)
    expect(phaseBeforeSecond).toBe('waiting')

    // Step 2: Second client joins
    console.log('\nStep 2: Second client joins...')
    const context2 = await browser.newContext()
    const client2 = await context2.newPage()
    await client2.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client2.goto(CLIENT_URL)

    // Wait for connection and match start (need longer for Phaser initialization)
    await Promise.all([
      waitScaled(client1, 2500),
      waitScaled(client2, 2500)
    ])

    // Check phase on both clients (should be 'playing')
    const [phaseAfterSecond1, phaseAfterSecond2] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      })
    ])

    console.log(`  Phase on client 1: ${phaseAfterSecond1}`)
    console.log(`  Phase on client 2: ${phaseAfterSecond2}`)

    // Both should see 'playing' phase
    expect(phaseAfterSecond1).toBe('playing')
    expect(phaseAfterSecond2).toBe('playing')

    // Cleanup
    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Match started immediately when second player joined')
  })

  test('Each client controls 3 players (1 human + 2 switchable teammates)', async ({ browser }, testInfo) => {
    console.log('📤 Testing player control structure...\n')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for page to load and scene to initialize
    await Promise.all([
      waitScaled(client1, 3000), // Give time for Phaser to initialize
      waitScaled(client2, 3000)
    ])

    const [session1, session2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId)
    ])

    console.log(`  Client 1 session: ${session1}`)
    console.log(`  Client 2 session: ${session2}`)

    // Step 1: Verify each session created 3 players
    console.log('\nStep 1: Verifying player IDs...')

    const allPlayerIds = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      const ids: string[] = []
      state?.players?.forEach((player: any, id: string) => {
        ids.push(id)
      })
      return ids.sort()
    })

    console.log(`  All player IDs: ${allPlayerIds.join(', ')}`)

    // Should have exactly 6 players
    expect(allPlayerIds.length).toBe(6)

    // Verify session1's team (should be session1, session1-bot1, session1-bot2)
    const session1Team = allPlayerIds.filter(id => id.startsWith(session1))
    console.log(`  Session 1 team: ${session1Team.join(', ')}`)
    expect(session1Team.length).toBe(3)
    expect(session1Team).toContain(session1)
    expect(session1Team).toContain(`${session1}-bot1`)
    expect(session1Team).toContain(`${session1}-bot2`)

    // Verify session2's team (should be session2, session2-bot1, session2-bot2)
    const session2Team = allPlayerIds.filter(id => id.startsWith(session2))
    console.log(`  Session 2 team: ${session2Team.join(', ')}`)
    expect(session2Team.length).toBe(3)
    expect(session2Team).toContain(session2)
    expect(session2Team).toContain(`${session2}-bot1`)
    expect(session2Team).toContain(`${session2}-bot2`)

    // Step 2: Verify isHuman flags
    console.log('\nStep 2: Verifying isHuman flags...')

    const playerFlags = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      const flags: Record<string, boolean> = {}
      state?.players?.forEach((player: any, id: string) => {
        flags[id] = player.isHuman
      })
      return flags
    })

    // Only session players should have isHuman: true
    expect(playerFlags[session1]).toBe(true)
    expect(playerFlags[`${session1}-bot1`]).toBe(false)
    expect(playerFlags[`${session1}-bot2`]).toBe(false)
    expect(playerFlags[session2]).toBe(true)
    expect(playerFlags[`${session2}-bot1`]).toBe(false)
    expect(playerFlags[`${session2}-bot2`]).toBe(false)

    console.log('  Human players:', Object.entries(playerFlags).filter(([_, human]) => human).map(([id]) => id))
    console.log('  Bot players:', Object.entries(playerFlags).filter(([_, human]) => !human).map(([id]) => id))

    // Step 3: Verify team assignments
    console.log('\nStep 3: Verifying team assignments...')

    const playerTeams = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      const teams: Record<string, string> = {}
      state?.players?.forEach((player: any, id: string) => {
        teams[id] = player.team
      })
      return teams
    })

    // All players from session1 should be on same team
    const session1TeamName = playerTeams[session1]
    expect(session1TeamName).toBeTruthy()
    expect(playerTeams[`${session1}-bot1`]).toBe(session1TeamName)
    expect(playerTeams[`${session1}-bot2`]).toBe(session1TeamName)

    // All players from session2 should be on same team (different from session1)
    const session2TeamName = playerTeams[session2]
    expect(session2TeamName).toBeTruthy()
    expect(playerTeams[`${session2}-bot1`]).toBe(session2TeamName)
    expect(playerTeams[`${session2}-bot2`]).toBe(session2TeamName)

    // Teams should be different
    expect(session1TeamName).not.toBe(session2TeamName)

    console.log(`  ${session1TeamName} team (${session1}):`, Object.entries(playerTeams).filter(([_, team]) => team === session1TeamName).map(([id]) => id))
    console.log(`  ${session2TeamName} team (${session2}):`, Object.entries(playerTeams).filter(([_, team]) => team === session2TeamName).map(([id]) => id))

    // Cleanup
    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Each client controls 3 players on correct team')
  })

  test('Single player gets waiting phase, second player triggers match start', async ({ browser }, testInfo) => {
    console.log('📤 Testing single-player fallback behavior...\n')

    const testRoomId = `test-w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`🔒 Test room: ${testRoomId}`)

    // Step 1: Connect first client alone
    console.log('Step 1: First client connects alone...')
    const context1 = await browser.newContext()
    const client1 = await context1.newPage()
    await client1.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client1.goto(CLIENT_URL)
    await waitScaled(client1, 1500) // Wait 1.5s (less than 2s timeout)

    // Should be in waiting phase
    const phase1 = await client1.evaluate(() => {
      const state = (window as any).__gameControls?.scene?.networkManager?.getState()
      return state?.phase || null
    })

    console.log(`  Phase with 1 player: ${phase1}`)
    expect(phase1).toBe('waiting')

    // Step 2: Connect second client within 2 seconds (before single-player timeout)
    console.log('\nStep 2: Second client joins within 2 seconds...')
    const context2 = await browser.newContext()
    const client2 = await context2.newPage()
    await client2.addInitScript((id) => { (window as any).__testRoomId = id }, testRoomId)
    await client2.goto(CLIENT_URL)

    // Wait for match to start (need longer for Phaser initialization)
    await Promise.all([
      waitScaled(client1, 2500),
      waitScaled(client2, 2500)
    ])

    // Should now be in playing phase
    const [phase1After, phase2After] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return state?.phase || null
      })
    ])

    console.log(`  Phase after second join - client 1: ${phase1After}`)
    console.log(`  Phase after second join - client 2: ${phase2After}`)

    expect(phase1After).toBe('playing')
    expect(phase2After).toBe('playing')

    // Cleanup
    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Single player waits, second player triggers match')
  })

  test('Ball is visible in both clients', async ({ browser }, testInfo) => {
    console.log('📤 Testing ball visibility across clients...\n')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for page to load and scene to initialize
    await Promise.all([
      waitScaled(client1, 3000), // Give time for Phaser to initialize
      waitScaled(client2, 3000)
    ])

    console.log('Step 1: Checking ball state in server...')

    // Get ball state from both clients
    const [ballState1, ballState2] = await Promise.all([
      client1.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return {
          x: state?.ball?.x,
          y: state?.ball?.y,
          velocityX: state?.ball?.velocityX,
          velocityY: state?.ball?.velocityY,
          possessedBy: state?.ball?.possessedBy || 'none'
        }
      }),
      client2.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        return {
          x: state?.ball?.x,
          y: state?.ball?.y,
          velocityX: state?.ball?.velocityX,
          velocityY: state?.ball?.velocityY,
          possessedBy: state?.ball?.possessedBy || 'none'
        }
      })
    ])

    console.log(`  Client 1 ball: (${ballState1.x?.toFixed(0)}, ${ballState1.y?.toFixed(0)}) possessed by: ${ballState1.possessedBy}`)
    console.log(`  Client 2 ball: (${ballState2.x?.toFixed(0)}, ${ballState2.y?.toFixed(0)}) possessed by: ${ballState2.possessedBy}`)

    // Both clients should see the ball at the same position
    expect(ballState1.x).toBeDefined()
    expect(ballState1.y).toBeDefined()
    expect(ballState2.x).toBe(ballState1.x)
    expect(ballState2.y).toBe(ballState1.y)

    console.log('\nStep 2: Checking ball sprite rendering...')

    // Check if ball sprite exists and is visible in both clients
    const [ballVisible1, ballVisible2] = await Promise.all([
      client1.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const ball = scene?.ball
        return {
          exists: ball !== undefined,
          x: ball?.x,
          y: ball?.y,
          visible: ball?.visible,
          alpha: ball?.alpha,
          depth: ball?.depth,
          fillColor: ball?.fillColor,
          width: ball?.width,
          height: ball?.height
        }
      }),
      client2.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const ball = scene?.ball
        return {
          exists: ball !== undefined,
          x: ball?.x,
          y: ball?.y,
          visible: ball?.visible,
          alpha: ball?.alpha,
          depth: ball?.depth,
          fillColor: ball?.fillColor,
          width: ball?.width,
          height: ball?.height
        }
      })
    ])

    console.log(`  Client 1 ball sprite:`)
    console.log(`    Exists: ${ballVisible1.exists}`)
    console.log(`    Position: (${ballVisible1.x?.toFixed(0)}, ${ballVisible1.y?.toFixed(0)})`)
    console.log(`    Visible: ${ballVisible1.visible}`)
    console.log(`    Alpha: ${ballVisible1.alpha}`)
    console.log(`    Depth: ${ballVisible1.depth}`)
    console.log(`    Size: ${ballVisible1.width}x${ballVisible1.height}`)
    console.log(`    Fill: 0x${ballVisible1.fillColor?.toString(16)}`)

    console.log(`  Client 2 ball sprite:`)
    console.log(`    Exists: ${ballVisible2.exists}`)
    console.log(`    Position: (${ballVisible2.x?.toFixed(0)}, ${ballVisible2.y?.toFixed(0)})`)
    console.log(`    Visible: ${ballVisible2.visible}`)
    console.log(`    Alpha: ${ballVisible2.alpha}`)
    console.log(`    Depth: ${ballVisible2.depth}`)
    console.log(`    Size: ${ballVisible2.width}x${ballVisible2.height}`)
    console.log(`    Fill: 0x${ballVisible2.fillColor?.toString(16)}`)

    // Ball sprite should exist in both clients
    expect(ballVisible1.exists).toBe(true)
    expect(ballVisible2.exists).toBe(true)

    // Ball should be visible (not hidden)
    expect(ballVisible1.visible).toBe(true)
    expect(ballVisible2.visible).toBe(true)

    // Ball should have full alpha (not transparent)
    expect(ballVisible1.alpha).toBe(1)
    expect(ballVisible2.alpha).toBe(1)

    // Ball should have proper dimensions
    expect(ballVisible1.width).toBe(30)
    expect(ballVisible1.height).toBe(30)
    expect(ballVisible2.width).toBe(30)
    expect(ballVisible2.height).toBe(30)

    console.log('\nStep 3: Taking screenshots for visual verification...')

    // Take screenshots to verify ball is actually rendered
    await Promise.all([
      client1.screenshot({ path: 'test-results/ball-visibility-client1.png', fullPage: false }),
      client2.screenshot({ path: 'test-results/ball-visibility-client2.png', fullPage: false })
    ])

    console.log('  Screenshots saved to test-results/')

    // Cleanup
    await client1.close()
    await context1.close()
    await client2.close()
    await context2.close()

    console.log('\n✅ TEST PASSED: Ball is visible in both clients')
  })
})
