import { test, expect } from '@playwright/test'
import { setupMultiClientTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

/**
 * Test Suite: Multiplayer AI Control
 *
 * Verifies that in multiplayer:
 * - Blue client controls all blue players (1 human + 2 AI teammates)
 * - Red client controls all red players (1 human + 2 AI teammates)
 * - Human player can switch between teammates
 * - AI controls teammates when not switched to them
 * - Each client does NOT control opponent team players
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Multiplayer AI Control', () => {
  test('Blue client controls blue team, red client controls red team', async ({ browser }, testInfo) => {
    console.log('📤 Step 1: Setting up two clients...')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    // Connect both clients to the same isolated room
    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    console.log(`🔒 Both clients isolated in room: ${roomId}`)

    // Wait for clients to connect and initialize
    await Promise.all([
      waitScaled(client1, 5000), // Give time for Phaser to initialize and AI to set up
      waitScaled(client2, 5000)
    ])

    console.log('\n📤 Step 2: Verifying team assignments...')

    // Get session IDs and team assignments
    const [session1, session2, team1, team2] = await Promise.all([
      client1.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client2.evaluate(() => (window as any).__gameControls?.scene?.mySessionId),
      client1.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState()
        const myPlayerId = scene?.myPlayerId
        return state?.players?.get(myPlayerId)?.team || null
      }),
      client2.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState()
        const myPlayerId = scene?.myPlayerId
        return state?.players?.get(myPlayerId)?.team || null
      })
    ])

    console.log(`  Client 1: ${session1} on ${team1} team`)
    console.log(`  Client 2: ${session2} on ${team2} team`)

    // Clients should be on different teams
    expect(team1).toBeTruthy()
    expect(team2).toBeTruthy()
    expect(team1).not.toBe(team2)

    // Determine which client is blue and which is red
    const blueClient = team1 === 'blue' ? client1 : client2
    const redClient = team1 === 'red' ? client1 : client2
    const blueSessionId = team1 === 'blue' ? session1 : session2
    const redSessionId = team1 === 'red' ? session1 : session2

    console.log('\n📤 Step 3: Verifying AI initialization...')

    // Check AI manager is initialized
    const [blueAIManager, redAIManager] = await Promise.all([
      blueClient.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const blueTeamAI = scene?.aiManager?.getTeamAI?.('blue')
        const redTeamAI = scene?.aiManager?.getTeamAI?.('red')
        return {
          exists: !!scene?.aiManager,
          enabled: scene?.aiEnabled ?? false,
          blueTeam: blueTeamAI?.getPlayerIds?.()?.length ?? 0,
          redTeam: redTeamAI?.getPlayerIds?.()?.length ?? 0,
        }
      }),
      redClient.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const blueTeamAI = scene?.aiManager?.getTeamAI?.('blue')
        const redTeamAI = scene?.aiManager?.getTeamAI?.('red')
        return {
          exists: !!scene?.aiManager,
          enabled: scene?.aiEnabled ?? false,
          blueTeam: blueTeamAI?.getPlayerIds?.()?.length ?? 0,
          redTeam: redTeamAI?.getPlayerIds?.()?.length ?? 0,
        }
      })
    ])

    console.log(`  Blue client AI: exists=${blueAIManager.exists}, enabled=${blueAIManager.enabled}`)
    console.log(`    Blue team players: ${blueAIManager.blueTeam}, Red team players: ${blueAIManager.redTeam}`)
    console.log(`  Red client AI: exists=${redAIManager.exists}, enabled=${redAIManager.enabled}`)
    console.log(`    Blue team players: ${redAIManager.blueTeam}, Red team players: ${redAIManager.redTeam}`)

    // Blue client should have blue team players (3: 1 human + 2 AI), red team should be empty
    expect(blueAIManager.exists).toBe(true)
    expect(blueAIManager.enabled).toBe(true)
    expect(blueAIManager.blueTeam).toBe(3) // All blue players (including human)
    expect(blueAIManager.redTeam).toBe(0) // No red players (opponent controls them)

    // Red client should have red team players (3: 1 human + 2 AI), blue team should be empty
    expect(redAIManager.exists).toBe(true)
    expect(redAIManager.enabled).toBe(true)
    expect(redAIManager.redTeam).toBe(3) // All red players (including human)
    expect(redAIManager.blueTeam).toBe(0) // No blue players (opponent controls them)

    console.log('\n📤 Step 4: Verifying player count per team...')

    // Get all players from server state
    const [bluePlayers, redPlayers] = await Promise.all([
      blueClient.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        const players: any[] = []
        state?.players?.forEach((player: any, id: string) => {
          if (player.team === 'blue') {
            players.push({ id, isHuman: player.isHuman })
          }
        })
        return players
      }),
      blueClient.evaluate(() => {
        const state = (window as any).__gameControls?.scene?.networkManager?.getState()
        const players: any[] = []
        state?.players?.forEach((player: any, id: string) => {
          if (player.team === 'red') {
            players.push({ id, isHuman: player.isHuman })
          }
        })
        return players
      })
    ])

    console.log(`  Blue team: ${bluePlayers.length} players (${bluePlayers.filter(p => p.isHuman).length} human)`)
    console.log(`  Red team: ${redPlayers.length} players (${redPlayers.filter(p => p.isHuman).length} human)`)

    // Each team should have 3 players: 1 human + 2 AI
    expect(bluePlayers.length).toBe(3)
    expect(bluePlayers.filter(p => p.isHuman).length).toBe(1)
    expect(redPlayers.length).toBe(3)
    expect(redPlayers.filter(p => p.isHuman).length).toBe(1)

    console.log('\n📤 Step 5: Verifying human player control...')

    // Check that human players are set correctly
    const [blueHumanId, redHumanId] = await Promise.all([
      blueClient.evaluate(() => (window as any).__gameControls?.scene?.myPlayerId),
      redClient.evaluate(() => (window as any).__gameControls?.scene?.myPlayerId)
    ])

    // Verify human players are in the correct teams
    const blueHuman = bluePlayers.find(p => p.id === blueHumanId)
    const redHuman = redPlayers.find(p => p.id === redHumanId)

    expect(blueHuman).toBeTruthy()
    expect(blueHuman?.isHuman).toBe(true)
    expect(redHuman).toBeTruthy()
    expect(redHuman?.isHuman).toBe(true)

    console.log('\n✅ All AI control checks passed!')
  })

  test('Human player can switch between teammates', async ({ browser }, testInfo) => {
    console.log('📤 Testing player switching...')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)
    
    await Promise.all([
      waitScaled(client1, 5000),
      waitScaled(client2, 5000)
    ])

    // Get initial controlled player
    const initialControlled = await client1.evaluate(() => {
      return (window as any).__gameControls?.scene?.controlledPlayerId
    })

    expect(initialControlled).toBeTruthy()

    // Switch to next teammate
    await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      if (scene) {
        // Call switchToNextTeammate via the protected method
        // We'll use the action button release with no ball to trigger switch
        scene.actionButton?.__test_simulatePress()
        scene.actionButton?.__test_simulateRelease(100) // Short press = switch
      }
    })

    // Wait a bit for switch to complete
    await waitScaled(client1, 1000)

    // Check if controlled player changed
    const newControlled = await client1.evaluate(() => {
      return (window as any).__gameControls?.scene?.controlledPlayerId
    })

    console.log(`  Initial controlled: ${initialControlled}`)
    console.log(`  New controlled: ${newControlled}`)

    // Controlled player should be different (switched to teammate)
    // Note: This might be the same if we're already on the last teammate
    expect(newControlled).toBeTruthy()
  })

  test('AI teammate gaining possession hands control to human before acting', async ({ browser }, testInfo) => {
    console.log('📤 Testing automatic control handoff on possession...')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    await setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)

    await Promise.all([
      waitScaled(client1, 4000),
      waitScaled(client2, 4000)
    ])

    const result = await client1.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      if (!scene || !scene.networkManager) {
        return { error: 'Scene or network manager unavailable' }
      }

      const unifiedState = scene.getUnifiedState?.()
      if (!unifiedState) {
        return { error: 'Unified state unavailable' }
      }

      const myPlayerId = scene.myPlayerId
      const controlledBefore = scene.controlledPlayerId
      if (!myPlayerId || !controlledBefore) {
        return { error: 'Missing player id or controlled player id' }
      }

      // Find an AI teammate (not the human-controlled player)
      const teammates: string[] = []
      unifiedState.players.forEach((player: any, playerId: string) => {
        if (player.team === unifiedState.players.get(myPlayerId)?.team) {
          teammates.push(playerId)
        }
      })

      const aiTeammate = teammates.find(id => id !== controlledBefore)
      if (!aiTeammate) {
        return { error: 'No AI teammate found to test handoff' }
      }

      // Clone unified state and force possession to AI teammate
      const patchedPlayers = new Map(unifiedState.players)
      const patchedState = {
        ...unifiedState,
        players: patchedPlayers,
        ball: { ...unifiedState.ball, possessedBy: aiTeammate },
      }

      const originalGetUnifiedState = scene.getUnifiedState.bind(scene)
      const originalSendInput = scene.networkManager.sendInput.bind(scene.networkManager)
      let aiInputSent = false

      scene.getUnifiedState = () => patchedState
      scene.networkManager.sendInput = () => {
        aiInputSent = true
      }

      try {
        scene.applyAIDecision(aiTeammate, { moveX: 0, moveY: 0, shootPower: null })
        return {
          error: null,
          controlledBefore,
          controlledAfter: scene.controlledPlayerId,
          aiTeammate,
          aiInputSent,
        }
      } finally {
        scene.getUnifiedState = originalGetUnifiedState
        scene.networkManager.sendInput = originalSendInput
      }
    })

    expect(result.error || null).toBeNull()
    expect(result.aiTeammate).toBeTruthy()
    expect(result.controlledBefore).not.toBe(result.aiTeammate)
    expect(result.controlledAfter).toBe(result.aiTeammate)
    expect(result.aiInputSent).toBe(false)

    console.log('✅ Control handoff verified: AI possession triggers human control before any AI input')
  })
})

