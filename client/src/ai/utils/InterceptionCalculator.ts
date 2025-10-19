/**
 * InterceptionCalculator - Calculate ball interception points
 *
 * Provides utilities for calculating where and when players can intercept
 * the ball, used for both defensive interceptions and passing calculations.
 *
 * Extracted from TeamAI.ts existing logic.
 */

import { Vector2D } from '../types'
import { PlayerData } from '../../../../shared/src/types'
import { GAME_CONFIG } from '../../../../shared/src/types'
import { PhysicsEngine } from '../../../../shared/src/engine/PhysicsEngine'

export class InterceptionCalculator {
  /**
   * Find earliest interception from multiple players
   * Checks all players at each time step, returns immediately when first match found
   * Much more efficient than calculating all time steps for each player individually
   *
   * IMPORTANT: Accounts for POSSESSION_RADIUS - players can capture ball when within 70px,
   * not just at exact position. This is critical for accurate pass/interception calculations.
   */
  static calculateInterception(
    players: PlayerData[],
    predictPosition: (timeSeconds: number) => Vector2D,
    fallbackPosition: Vector2D
  ): { interceptor: PlayerData; interceptPoint: Vector2D } {
    const playerSpeed = GAME_CONFIG.PLAYER_SPEED
    const possessionRadius = GAME_CONFIG.POSSESSION_RADIUS
    const maxLookAhead = 4.0 // seconds
    const timeStep = 0.1 // check every 0.1 seconds

    // Check each time step, trying all players before moving to next time
    for (let t = timeStep; t <= maxLookAhead; t += timeStep) {
      const futurePos = predictPosition(t)

      // Check if ANY player can get within capture range at this time
      for (const player of players) {
        const distance = this.distance(player.position, futurePos)

        // Account for possession radius - player doesn't need to reach exact position
        // They just need to get within POSSESSION_RADIUS (70px) to capture the ball
        const captureDistance = Math.max(0, distance - possessionRadius)
        const timeToReach = captureDistance / playerSpeed

        if (timeToReach <= t) {
          // Found first player who can intercept! Return immediately
          return { interceptor: player, interceptPoint: futurePos }
        }
      }
    }

    // No interception possible, return first player with fallback position
    return { interceptor: players[0], interceptPoint: fallbackPosition }
  }

  /**
   * Simulate ball position after timeSeconds accounting for friction AND wall bounces
   * Uses PhysicsEngine.simulateBallStep for accurate physics matching game engine
   */
  static simulateBallPosition(
    startPos: Vector2D,
    startVel: Vector2D,
    timeSeconds: number
  ): Vector2D {
    const dt = 1 / GAME_CONFIG.TICK_RATE // delta time per tick
    const steps = Math.ceil(timeSeconds / dt)

    // Physics config matching game engine
    const physicsConfig = {
      ballFriction: GAME_CONFIG.BALL_FRICTION,
      fieldWidth: GAME_CONFIG.FIELD_WIDTH,
      fieldHeight: GAME_CONFIG.FIELD_HEIGHT,
      fieldMargin: 10,
      goalYMin: GAME_CONFIG.GOAL_Y_MIN,
      goalYMax: GAME_CONFIG.GOAL_Y_MAX,
    }

    let x = startPos.x
    let y = startPos.y
    let vx = startVel.x
    let vy = startVel.y

    // Simulate step-by-step using actual PhysicsEngine logic
    for (let i = 0; i < steps; i++) {
      const result = PhysicsEngine.simulateBallStep(x, y, vx, vy, dt, physicsConfig)

      x = result.x
      y = result.y
      vx = result.vx
      vy = result.vy

      // Stop if ball stopped
      if (vx === 0 && vy === 0) break
    }

    return { x, y }
  }

  /**
   * Predict ball position when opponent has possession and moves in a direction
   * Ball stays POSSESSION_BALL_OFFSET ahead of opponent as they move at PLAYER_SPEED
   */
  static predictOpponentBallPosition(
    opponentPos: Vector2D,
    direction: Vector2D,
    timeSeconds: number
  ): Vector2D {
    // Current ball position (25px in front of opponent)
    const currentBallX = opponentPos.x + direction.x * GAME_CONFIG.POSSESSION_BALL_OFFSET
    const currentBallY = opponentPos.y + direction.y * GAME_CONFIG.POSSESSION_BALL_OFFSET

    // Ball moves with opponent at PLAYER_SPEED
    return {
      x: currentBallX + direction.x * GAME_CONFIG.PLAYER_SPEED * timeSeconds,
      y: currentBallY + direction.y * GAME_CONFIG.PLAYER_SPEED * timeSeconds,
    }
  }

  /**
   * Calculate distance between two points
   */
  static distance(p1: Vector2D, p2: Vector2D): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}
