import { Page } from '@playwright/test'
import { waitScaled } from './time-control'
import { GAME_CONFIG } from '../../shared/src/types'

/**
 * Test Helper Utilities
 *
 * Reusable functions for common test operations and assertions.
 * Improves test readability and maintainability.
 */

export const BLUE_COLOR = 26367      // 0x0066ff
export const RED_COLOR = 16729156    // 0xff4444

/**
 * Disable AI for single-player tests (prevents AI from interfering)
 */
export async function disableAI(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controls = (window as any).__gameControls
    if (controls?.test?.setAIEnabled) {
      controls.test.setAIEnabled(false)
    }
  })
}

/**
 * Disable auto-switching for single-player tests (prevents switching to AI players)
 */
export async function disableAutoSwitch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controls = (window as any).__gameControls
    if (controls?.test?.setAutoSwitchEnabled) {
      controls.test.setAutoSwitchEnabled(false)
    }
  })
}

/**
 * Get player's team color (from unified players map)
 */
export async function getPlayerColor(client: Page): Promise<number> {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const myPlayerId = scene?.myPlayerId
    const player = scene?.players?.get(myPlayerId)
    // Access internal _fillColor if available (PixiJS migration hack)
    // or try standard PixiJS properties if possible
    return (player as any)?._fillColor || 0
  })
}

/**
 * Get player's session ID
 */
export async function getSessionId(client: Page): Promise<string> {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.mySessionId || ''
  })
}

/**
 * Get server game state
 */
export async function getServerState(client: Page) {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return {
      phase: state?.phase || 'unknown',
      matchTimer: state?.matchTimer || 0,
      scoreBlue: state?.scoreBlue || 0,
      scoreRed: state?.scoreRed || 0,
      playerCount: state?.players?.size || 0,
      ball: {
        x: state?.ball?.x || 0,
        y: state?.ball?.y || 0,
        possessedBy: state?.ball?.possessedBy || '',
        velocityX: state?.ball?.velocityX || 0,
        velocityY: state?.ball?.velocityY || 0
      }
    }
  })
}

/**
 * Get player position (from unified players map)
 * Uses controlledPlayerId to track the actively controlled player (accounts for player switching)
 */
export async function getPlayerPosition(client: Page) {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    // Use controlledPlayerId because that's the player being moved by input
    // This accounts for player switching when AI teammates gain possession
    const controlledPlayerId = scene?.controlledPlayerId || scene?.myPlayerId
    const player = scene?.players?.get(controlledPlayerId)
    return {
      x: player?.x || 0,
      y: player?.y || 0
    }
  })
}

/**
 * Check if client sees a remote player (in unified players map)
 * Now checks for sessionId-p1 format in the unified players map
 */
export async function hasRemotePlayer(client: Page, remoteSessionId: string): Promise<boolean> {
  return client.evaluate((sessionId) => {
    const scene = (window as any).__gameControls?.scene
    const myPlayerId = scene?.myPlayerId
    // Check for the remote player's -p1 ID in unified players map
    const remotePlayerId = `${sessionId}-p1`
    return scene?.players?.has(remotePlayerId) && remotePlayerId !== myPlayerId
  }, remoteSessionId)
}

/**
 * Move player in direction for duration
 */
export async function movePlayer(
  client: Page,
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  durationMs: number
) {
  await client.keyboard.down(direction)
  await waitScaled(client, durationMs)
  await client.keyboard.up(direction)
  await waitScaled(client, 200) // Small buffer for state to settle
}

/**
 * Gain ball possession - uses deterministic condition waiting
 * instead of retry loops for better reliability under load
 * Note: Ball possession now uses myPlayerId format (sessionId-p1, sessionId-p2, sessionId-p3)
 */
export async function gainPossession(
  client: Page,
  timeoutMs: number = 10000
): Promise<boolean> {
  // Get myPlayerId (e.g., "sessionId-p1") instead of just sessionId
  const myPlayerId = await client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.myPlayerId || ''
  })

  // Check if already have possession
  const currentState = await getServerState(client)
  if (currentState.ball.possessedBy === myPlayerId) {
    return true
  }

  // Move toward ball and wait for possession condition
  await client.keyboard.down('ArrowRight')

  try {
    // Wait for possession to be gained (deterministic condition)
    await client.waitForFunction(
      (playerId) => {
        const scene = (window as any).__gameControls?.scene
        const state = scene?.networkManager?.getState()
        return state?.ball?.possessedBy === playerId
      },
      myPlayerId,
      { timeout: timeoutMs }
    )

    await client.keyboard.up('ArrowRight')
    await waitScaled(client, 100) // Small buffer for state to settle
    return true
  } catch (error) {
    await client.keyboard.up('ArrowRight')
    return false
  }
}

/**
 * Move toward ball and wait for possession (deterministic, handles CPU throttling)
 * Calculates direction toward ball and holds key until possession is gained
 */
export async function moveTowardBallAndCapture(
  client: Page,
  timeoutMs: number = 10000
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const state = await client.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      const netState = scene?.networkManager?.getState()
      const controlledId = scene?.controlledPlayerId || scene?.mySessionId || ''
      const player = controlledId ? netState?.players?.get(controlledId) : null
      const ball = netState?.ball
      return {
        controlledId,
        ballPossessor: ball?.possessedBy || '',
        playerX: player?.x || 0,
        playerY: player?.y || 0,
        ballX: ball?.x || 0,
        ballY: ball?.y || 0,
        hasMoveHelper: !!(scene && (window as any).__gameControls?.test?.movePlayerDirect),
      }
    })

    if (!state.controlledId) {
      await waitScaled(client, 100)
      continue
    }

    const dx = state.ballX - state.playerX
    const dy = state.ballY - state.playerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (state.ballPossessor === state.controlledId || distance < GAME_CONFIG.POSSESSION_RADIUS) {
      return true
    }

    if (state.hasMoveHelper) {
      await client.evaluate(async ({ moveX, moveY }) => {
        const controls = (window as any).__gameControls
        if (controls?.test?.movePlayerDirect) {
          await controls.test.movePlayerDirect(moveX, moveY, 500)
        }
      }, { moveX: dx, moveY: dy })
    } else {
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const key = horizontal
        ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft')
        : (dy > 0 ? 'ArrowDown' : 'ArrowUp')
      await client.keyboard.down(key)
      await waitScaled(client, 300)
      await client.keyboard.up(key)
    }

    await waitScaled(client, 200)
  }

  return false
}

/**
 * Shoot the ball
 */
export async function shoot(client: Page, holdDurationMs: number = 200) {
  await client.keyboard.down('Space')
  await waitScaled(client, holdDurationMs)
  await client.keyboard.up('Space')
  await waitScaled(client, 200)
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate velocity magnitude
 */
export function calculateVelocity(vx: number, vy: number): number {
  return Math.sqrt(vx * vx + vy * vy)
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(
  checkFn: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await checkFn()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return false
}

/**
 * Restart scene for a client
 */
export async function restartScene(client: Page) {
  await client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    if (scene) {
      const manager = (window as any).sceneManager;
      if (manager) {
          manager.start(scene.sceneKey);
      }
    }
  })
}

/**
 * Assert colors are different between two clients
 */
export async function assertDifferentColors(client1: Page, client2: Page) {
  const [color1, color2] = await Promise.all([
    getPlayerColor(client1),
    getPlayerColor(client2)
  ])

  const client1IsBlue = color1 === BLUE_COLOR
  const client2IsBlue = color2 === BLUE_COLOR

  if (client1IsBlue === client2IsBlue) {
    throw new Error(
      `Colors are the same! Client1: ${client1IsBlue ? 'BLUE' : 'RED'}, Client2: ${client2IsBlue ? 'BLUE' : 'RED'}`
    )
  }

  return { color1, color2, client1IsBlue, client2IsBlue }
}

/**
 * Assert ball is at center field
 */
export async function assertBallAtCenter(client: Page, variance: number = 100) {
  const state = await getServerState(client)
  const distanceFromCenter = calculateDistance(state.ball.x, state.ball.y, 960, 540)

  if (distanceFromCenter > variance) {
    throw new Error(
      `Ball not at center! Position: (${state.ball.x}, ${state.ball.y}), Distance from center: ${distanceFromCenter}px`
    )
  }
}

/**
 * Assert ball has no possession
 */
export async function assertBallFree(client: Page) {
  const state = await getServerState(client)

  if (state.ball.possessedBy !== '') {
    throw new Error(`Ball is possessed by ${state.ball.possessedBy}, expected free`)
  }
}

/**
 * Assert player count
 */
export async function assertPlayerCount(client: Page, expectedCount: number) {
  const state = await getServerState(client)

  if (state.playerCount !== expectedCount) {
    throw new Error(
      `Player count is ${state.playerCount}, expected ${expectedCount}`
    )
  }
}

/**
 * Assert match phase
 */
export async function assertPhase(
  client: Page,
  expectedPhase: 'waiting' | 'playing' | 'ended'
) {
  const state = await getServerState(client)

  if (state.phase !== expectedPhase) {
    throw new Error(`Phase is ${state.phase}, expected ${expectedPhase}`)
  }
}
