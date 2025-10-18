import { Page } from '@playwright/test'
import { waitScaled } from './time-control'

/**
 * Test Helper Utilities
 *
 * Reusable functions for common test operations and assertions.
 * Improves test readability and maintainability.
 */

export const BLUE_COLOR = 26367      // 0x0066ff
export const RED_COLOR = 16729156    // 0xff4444

/**
 * Get player's team color
 */
export async function getPlayerColor(client: Page): Promise<number> {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.player?.fillColor || 0
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
 * Get player position
 */
export async function getPlayerPosition(client: Page) {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return {
      x: scene?.player?.x || 0,
      y: scene?.player?.y || 0
    }
  })
}

/**
 * Check if client sees a remote player
 */
export async function hasRemotePlayer(client: Page, remoteSessionId: string): Promise<boolean> {
  return client.evaluate((sessionId) => {
    const scene = (window as any).__gameControls?.scene
    const remotePlayers = Array.from(scene?.remotePlayers?.values() || [])
    return remotePlayers.some((p: any) => p.sessionId === sessionId)
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
 * Gain ball possession (retry up to maxAttempts times)
 */
export async function gainPossession(
  client: Page,
  maxAttempts: number = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = await getServerState(client)
    const sessionId = await getSessionId(client)

    if (state.ball.possessedBy === sessionId) {
      return true
    }

    // Move toward ball (much longer duration for CPU-throttled parallel workers)
    // With 10x time acceleration and 8 workers, we need 3000ms game time = 300ms real time
    await movePlayer(client, 'ArrowRight', 3000)
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
      scene.scene.restart()
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
