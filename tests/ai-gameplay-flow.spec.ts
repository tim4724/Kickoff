import { test, expect, Page } from '@playwright/test'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'
import { GAME_CONFIG } from '../shared/src/types'

/**
 * AI Gameplay Flow Test
 *
 * Comprehensive test to measure AI gameplay quality metrics over 60 seconds.
 * Used for iterative tuning and validation of AI behavior.
 *
 * Metrics tracked:
 * - Goals scored by each team
 * - Ball possession changes (passes)
 * - Player clustering (spacing between teammates)
 * - Space utilization (field coverage)
 * - Possession balance between teams
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

interface PlayerMetrics {
  id: string
  team: 'blue' | 'red'
  avgX: number
  avgY: number
  positions: Array<{ x: number; y: number }>
}

interface GameplayMetrics {
  duration: number
  goalsBlue: number
  goalsRed: number
  totalPossessionChanges: number
  possessionTimeBlue: number
  possessionTimeRed: number
  avgTeammateDistance: {
    blue: number
    red: number
  }
  spaceUtilization: {
    blueSpread: number
    redSpread: number
  }
  playerMetrics: Map<string, PlayerMetrics>
}

/**
 * Setup AI-only test environment
 */
async function setupAIOnlyTest(page: Page, url: string): Promise<void> {
  await page.goto(url)

  // Wait for Phaser game instance to be available
  await page.waitForFunction(() => {
    const game = (window as any).game
    return game && game.scene && game.scene.scenes && game.scene.scenes.length > 0
  }, { timeout: 10000 })

  // Start AIOnlyScene
  await page.evaluate(() => {
    const game = (window as any).game
    if (game && game.scene) {
      game.scene.start('AIOnlyScene')
      game.scene.stop('MenuScene')
    }
  })

  // Wait for AI-only scene to be ready
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.scene?.key === 'AIOnlyScene' && scene?.player
  }, { timeout: 10000 })

  // Set GameClock to 1.0x speed for this test (normal real-time gameplay)
  // This overrides any time acceleration from other tests
  await page.evaluate(() => {
    const GameClock = (window as any).GameClock
    if (GameClock) {
      GameClock.setTimeScale(1.0)
      console.log('⏰ GameClock set to 1.0x (real-time)')
    }

    // Also set scene gameSpeed for AIOnlyScene
    const scene = (window as any).__gameControls?.scene
    if (scene && 'gameSpeed' in scene) {
      scene.gameSpeed = 1.0
      console.log('🎮 Scene gameSpeed set to 1.0')
    }
  })

  // Small delay for scene initialization
  await waitScaled(page, 500)

  console.log('🤖 AI-Only scene initialized (time scale: 1.0x real-time)')
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

/**
 * Calculate average distance between teammates
 */
function calculateTeammateDistance(players: Array<{ x: number; y: number }>): number {
  if (players.length < 2) return 0

  let totalDistance = 0
  let pairCount = 0

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      totalDistance += distance(players[i].x, players[i].y, players[j].x, players[j].y)
      pairCount++
    }
  }

  return pairCount > 0 ? totalDistance / pairCount : 0
}

/**
 * Calculate team spread (standard deviation of positions)
 */
function calculateTeamSpread(players: Array<{ x: number; y: number }>): number {
  if (players.length === 0) return 0

  // Calculate centroid
  const centroidX = players.reduce((sum, p) => sum + p.x, 0) / players.length
  const centroidY = players.reduce((sum, p) => sum + p.y, 0) / players.length

  // Calculate average distance from centroid
  const avgDistanceFromCentroid = players.reduce((sum, p) => {
    return sum + distance(p.x, p.y, centroidX, centroidY)
  }, 0) / players.length

  return avgDistanceFromCentroid
}

test.describe('AI Gameplay Flow', () => {
  test('60-second AI gameplay produces quality metrics', async ({ page }) => {
    // Set timeout for this test (60s game time at ~real-time speed + overhead)
    test.setTimeout(120000)
    await setupAIOnlyTest(page, CLIENT_URL)

    console.log('\n🎮 Starting 60-second AI gameplay test...\n')

    // Initialize metrics tracking
    const metrics: GameplayMetrics = {
      duration: 0,
      goalsBlue: 0,
      goalsRed: 0,
      totalPossessionChanges: 0,
      possessionTimeBlue: 0,
      possessionTimeRed: 0,
      avgTeammateDistance: {
        blue: 0,
        red: 0
      },
      spaceUtilization: {
        blueSpread: 0,
        redSpread: 0
      },
      playerMetrics: new Map()
    }

    // Track possession over time
    let lastPossessor = ''
    let currentPossessor = ''
    let possessionStartTime = 0
    let lastSampleTime = Date.now()

    // Sample interval (every 100ms for detailed tracking)
    const sampleInterval = 100
    const testDurationGameMs = 60000 // 60 seconds of game time
    const startTime = Date.now()

    // Get initial game time to track game time elapsed
    const matchDuration = GAME_CONFIG.MATCH_DURATION
    let initialGameTime = await page.evaluate((matchDuration) => {
      const scene = (window as any).__gameControls?.scene
      const engineState = scene?.gameEngine?.getState()
      return matchDuration - (engineState?.matchTime || 0)
    }, matchDuration)

    // Data collection loop (run until 60 game-seconds elapsed)
    while (true) {
      const now = Date.now()
      const realTimeElapsed = now - startTime

      // Get current game time
      const currentGameTimeElapsed = await page.evaluate((matchDuration) => {
        const scene = (window as any).__gameControls?.scene
        const engineState = scene?.gameEngine?.getState()
        const currentMatchTime = engineState?.matchTime || 0
        return (matchDuration - currentMatchTime) * 1000 // Convert to ms
      }, matchDuration)

      const gameTimeElapsed = currentGameTimeElapsed - (initialGameTime * 1000)

      // Check if we've run for 60 game-seconds
      if (gameTimeElapsed >= testDurationGameMs) {
        break
      }

      const elapsed = gameTimeElapsed

      // Sample game state
      const state = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        if (!scene) return null

        const engineState = scene.gameEngine?.getState()
        if (!engineState) return null

        // Extract player positions and teams
        const players: any[] = []
        engineState.players.forEach((player: any, playerId: string) => {
          players.push({
            id: playerId,
            team: player.team,
            x: player.x,
            y: player.y
          })
        })

        return {
          scoreBlue: engineState.scoreBlue,
          scoreRed: engineState.scoreRed,
          ballPossessedBy: engineState.ball.possessedBy,
          players: players,
          matchTime: engineState.matchTime
        }
      })

      if (!state) {
        await waitScaled(page, sampleInterval)
        continue
      }

      // Update goals
      if (state.scoreBlue !== metrics.goalsBlue || state.scoreRed !== metrics.goalsRed) {
        const prevBlue = metrics.goalsBlue
        const prevRed = metrics.goalsRed
        metrics.goalsBlue = state.scoreBlue
        metrics.goalsRed = state.scoreRed

        if (state.scoreBlue > prevBlue) {
          console.log(`⚽ GOAL! Blue team scores! (${state.scoreBlue} - ${state.scoreRed}) at ${(elapsed / 1000).toFixed(1)}s`)
        }
        if (state.scoreRed > prevRed) {
          console.log(`⚽ GOAL! Red team scores! (${state.scoreBlue} - ${state.scoreRed}) at ${(elapsed / 1000).toFixed(1)}s`)
        }
      }

      // Track possession changes
      currentPossessor = state.ballPossessedBy
      if (currentPossessor !== lastPossessor && currentPossessor !== '') {
        metrics.totalPossessionChanges++

        // Accumulate possession time for previous possessor
        if (lastPossessor !== '') {
          const possessionDuration = now - possessionStartTime
          const lastPossessorTeam = state.players.find((p: any) => p.id === lastPossessor)?.team
          if (lastPossessorTeam === 'blue') {
            metrics.possessionTimeBlue += possessionDuration
          } else if (lastPossessorTeam === 'red') {
            metrics.possessionTimeRed += possessionDuration
          }
        }

        lastPossessor = currentPossessor
        possessionStartTime = now

        const possessorTeam = state.players.find((p: any) => p.id === currentPossessor)?.team
        console.log(`🔄 Possession change #${metrics.totalPossessionChanges}: ${possessorTeam} team at ${(elapsed / 1000).toFixed(1)}s`)
      }

      // Track player positions for clustering analysis
      state.players.forEach((player: any) => {
        if (!metrics.playerMetrics.has(player.id)) {
          metrics.playerMetrics.set(player.id, {
            id: player.id,
            team: player.team,
            avgX: 0,
            avgY: 0,
            positions: []
          })
        }
        const playerMetric = metrics.playerMetrics.get(player.id)!
        playerMetric.positions.push({ x: player.x, y: player.y })
      })

      // Update duration
      metrics.duration = elapsed

      // Wait for next sample
      await waitScaled(page, sampleInterval)
      lastSampleTime = now
    }

    // Finalize metrics calculations
    console.log('\n📊 Calculating final metrics...\n')

    // Calculate final possession time for current possessor
    if (currentPossessor !== '') {
      const finalState = await page.evaluate(() => {
        const scene = (window as any).__gameControls?.scene
        const engineState = scene?.gameEngine?.getState()
        return {
          players: Array.from(engineState?.players?.values() || [])
        }
      })
      const currentPossessorTeam = finalState.players.find((p: any) => p.id === currentPossessor)?.team
      const finalPossessionTime = Date.now() - possessionStartTime
      if (currentPossessorTeam === 'blue') {
        metrics.possessionTimeBlue += finalPossessionTime
      } else if (currentPossessorTeam === 'red') {
        metrics.possessionTimeRed += finalPossessionTime
      }
    }

    // Calculate average teammate distances
    const bluePlayers: Array<{ x: number; y: number }> = []
    const redPlayers: Array<{ x: number; y: number }> = []

    metrics.playerMetrics.forEach(playerMetric => {
      // Calculate average position
      if (playerMetric.positions.length > 0) {
        playerMetric.avgX = playerMetric.positions.reduce((sum, pos) => sum + pos.x, 0) / playerMetric.positions.length
        playerMetric.avgY = playerMetric.positions.reduce((sum, pos) => sum + pos.y, 0) / playerMetric.positions.length
      }

      // Group by team for clustering analysis (using latest position)
      if (playerMetric.positions.length > 0) {
        const latestPos = playerMetric.positions[playerMetric.positions.length - 1]
        if (playerMetric.team === 'blue') {
          bluePlayers.push(latestPos)
        } else {
          redPlayers.push(latestPos)
        }
      }
    })

    metrics.avgTeammateDistance.blue = calculateTeammateDistance(bluePlayers)
    metrics.avgTeammateDistance.red = calculateTeammateDistance(redPlayers)

    // Calculate space utilization (team spread)
    metrics.spaceUtilization.blueSpread = calculateTeamSpread(bluePlayers)
    metrics.spaceUtilization.redSpread = calculateTeamSpread(redPlayers)

    // Log detailed metrics
    console.log('═══════════════════════════════════════════════════════════')
    console.log('                   AI GAMEPLAY METRICS                      ')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`\n⏱️  Duration: ${(metrics.duration / 1000).toFixed(1)}s\n`)

    console.log('⚽ GOALS:')
    console.log(`   Blue Team: ${metrics.goalsBlue}`)
    console.log(`   Red Team:  ${metrics.goalsRed}`)
    console.log(`   Total:     ${metrics.goalsBlue + metrics.goalsRed}\n`)

    console.log('🔄 POSSESSION:')
    console.log(`   Total Changes:    ${metrics.totalPossessionChanges}`)
    console.log(`   Blue Possession:  ${(metrics.possessionTimeBlue / 1000).toFixed(1)}s (${((metrics.possessionTimeBlue / metrics.duration) * 100).toFixed(1)}%)`)
    console.log(`   Red Possession:   ${(metrics.possessionTimeRed / 1000).toFixed(1)}s (${((metrics.possessionTimeRed / metrics.duration) * 100).toFixed(1)}%)`)
    const possessionBalance = Math.abs(metrics.possessionTimeBlue - metrics.possessionTimeRed) / metrics.duration
    console.log(`   Balance Score:    ${((1 - possessionBalance) * 100).toFixed(1)}% (100% = perfect balance)\n`)

    console.log('📏 PLAYER SPACING (Average distance between teammates):')
    console.log(`   Blue Team: ${metrics.avgTeammateDistance.blue.toFixed(1)}px`)
    console.log(`   Red Team:  ${metrics.avgTeammateDistance.red.toFixed(1)}px`)
    console.log(`   Combined:  ${((metrics.avgTeammateDistance.blue + metrics.avgTeammateDistance.red) / 2).toFixed(1)}px\n`)

    console.log('🗺️  SPACE UTILIZATION (Team spread from centroid):')
    console.log(`   Blue Team: ${metrics.spaceUtilization.blueSpread.toFixed(1)}px`)
    console.log(`   Red Team:  ${metrics.spaceUtilization.redSpread.toFixed(1)}px`)
    console.log(`   Combined:  ${((metrics.spaceUtilization.blueSpread + metrics.spaceUtilization.redSpread) / 2).toFixed(1)}px\n`)

    console.log('🎯 PLAYER HEAT POSITIONS (Average positions):')
    metrics.playerMetrics.forEach((playerMetric, playerId) => {
      const teamSymbol = playerMetric.team === 'blue' ? '🔵' : '🔴'
      console.log(`   ${teamSymbol} ${playerId.padEnd(20)}: (${playerMetric.avgX.toFixed(0)}, ${playerMetric.avgY.toFixed(0)})`)
    })

    console.log('\n═══════════════════════════════════════════════════════════\n')

    // Quality Assertions
    console.log('🔍 Running quality assertions...\n')

    // 1. At least 1 goal should be scored in 60 seconds
    const totalGoals = metrics.goalsBlue + metrics.goalsRed
    console.log(`✓ Checking goals: ${totalGoals} goals (expected: ≥1)`)
    expect(totalGoals).toBeGreaterThanOrEqual(1)

    // 2. Both teams should have possession at some point
    console.log(`✓ Checking possession balance:`)
    console.log(`  - Blue possession: ${(metrics.possessionTimeBlue / 1000).toFixed(1)}s`)
    console.log(`  - Red possession: ${(metrics.possessionTimeRed / 1000).toFixed(1)}s`)
    expect(metrics.possessionTimeBlue).toBeGreaterThan(0)
    expect(metrics.possessionTimeRed).toBeGreaterThan(0)

    // 3. Players should maintain reasonable spacing
    const avgSpacing = (metrics.avgTeammateDistance.blue + metrics.avgTeammateDistance.red) / 2
    console.log(`✓ Checking player spacing: ${avgSpacing.toFixed(1)}px (expected: >150px)`)
    expect(avgSpacing).toBeGreaterThan(150)

    // 4. Possession should change hands at least a few times (dynamic gameplay)
    console.log(`✓ Checking possession changes: ${metrics.totalPossessionChanges} (expected: ≥3)`)
    expect(metrics.totalPossessionChanges).toBeGreaterThanOrEqual(3)

    // 5. Teams should utilize space (not all bunched in center)
    const avgSpread = (metrics.spaceUtilization.blueSpread + metrics.spaceUtilization.redSpread) / 2
    console.log(`✓ Checking space utilization: ${avgSpread.toFixed(1)}px (expected: >100px)`)
    expect(avgSpread).toBeGreaterThan(100)

    // 6. Possession balance shouldn't be too one-sided (within 80/20 split)
    const totalPossessionTime = metrics.possessionTimeBlue + metrics.possessionTimeRed
    const bluePossessionPct = (metrics.possessionTimeBlue / totalPossessionTime) * 100
    const redPossessionPct = (metrics.possessionTimeRed / totalPossessionTime) * 100
    console.log(`✓ Checking possession fairness:`)
    console.log(`  - Blue: ${bluePossessionPct.toFixed(1)}% (expected: 20-80%)`)
    console.log(`  - Red: ${redPossessionPct.toFixed(1)}% (expected: 20-80%)`)
    expect(bluePossessionPct).toBeGreaterThan(20)
    expect(bluePossessionPct).toBeLessThan(80)
    expect(redPossessionPct).toBeGreaterThan(20)
    expect(redPossessionPct).toBeLessThan(80)

    console.log('\n✅ All quality assertions passed!\n')

    // Provide tuning recommendations
    console.log('💡 TUNING RECOMMENDATIONS:')

    if (totalGoals < 2) {
      console.log('   ⚠️  Low goal scoring rate. Consider:')
      console.log('       - Increasing offensive aggression')
      console.log('       - Improving shooting decision-making')
      console.log('       - Reducing defensive pressure')
    } else if (totalGoals > 6) {
      console.log('   ⚠️  High goal scoring rate. Consider:')
      console.log('       - Increasing defensive effectiveness')
      console.log('       - Reducing shooting frequency')
      console.log('       - Improving goalkeeper positioning')
    } else {
      console.log('   ✓ Goal scoring rate is balanced')
    }

    if (avgSpacing < 200) {
      console.log('   ⚠️  Players clustering too close. Consider:')
      console.log('       - Increasing spacing requirements')
      console.log('       - Adding repulsion forces between teammates')
      console.log('       - Improving formation positioning')
    } else if (avgSpacing > 400) {
      console.log('   ⚠️  Players too spread out. Consider:')
      console.log('       - Increasing cohesion forces')
      console.log('       - Improving support positioning')
      console.log('       - Reducing spacing requirements')
    } else {
      console.log('   ✓ Player spacing is good')
    }

    if (metrics.totalPossessionChanges < 5) {
      console.log('   ⚠️  Low possession changes (static gameplay). Consider:')
      console.log('       - Increasing defensive pressure')
      console.log('       - Improving interception logic')
      console.log('       - Adding more aggressive ball contests')
    } else if (metrics.totalPossessionChanges > 30) {
      console.log('   ⚠️  Too many possession changes (chaotic gameplay). Consider:')
      console.log('       - Reducing defensive pressure')
      console.log('       - Improving ball control')
      console.log('       - Increasing possession stability')
    } else {
      console.log('   ✓ Possession change rate is balanced')
    }

    const possessionImbalance = Math.abs(bluePossessionPct - 50)
    if (possessionImbalance > 20) {
      console.log('   ⚠️  Possession heavily favors one team. Consider:')
      console.log('       - Balancing team AI difficulty')
      console.log('       - Reviewing formation effectiveness')
      console.log('       - Checking for systemic biases')
    } else {
      console.log('   ✓ Possession balance is fair')
    }

    console.log('\n═══════════════════════════════════════════════════════════\n')
  })
})
