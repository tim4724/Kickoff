import { Page } from '@playwright/test'
import { waitForFrames } from './time-control'

const MS_PER_FRAME = 1000 / 60

/**
 * Get server game state
 */
export async function getServerState(client: Page) {
  return client.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState() || scene?.gameEngine?.getState()
    return {
      phase: state?.phase || 'unknown',
      matchTime: state?.matchTime || 0,
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
    const controlledPlayerId = scene?.controlledPlayerId || scene?.myPlayerId
    const player = scene?.players?.get(controlledPlayerId)
    return {
      x: player?.x || 0,
      y: player?.y || 0
    }
  })
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
  await waitForFrames(client, Math.ceil(durationMs / MS_PER_FRAME))
  await client.keyboard.up(direction)
  await waitForFrames(client, 2)
}

/**
 * Shoot the ball
 */
export async function shoot(client: Page, holdDurationMs: number = 200) {
  await client.keyboard.down('Space')
  await waitForFrames(client, Math.ceil(holdDurationMs / MS_PER_FRAME))
  await client.keyboard.up('Space')
  await waitForFrames(client, 2)
}

/**
 * Wait for player to move from initial position
 */
export async function waitForPlayerMovement(
  page: Page,
  initialX: number,
  initialY: number,
  minDistance = 10,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ x, y, dist }) => {
      const scene = (window as any).__gameControls?.scene
      const controlledPlayerId = scene?.controlledPlayerId || scene?.myPlayerId
      const player = scene?.players?.get(controlledPlayerId)
      if (!player) return false

      const dx = player.x - x
      const dy = player.y - y
      return Math.sqrt(dx * dx + dy * dy) > dist
    },
    { x: initialX, y: initialY, dist: minDistance },
    { timeout }
  )
}
