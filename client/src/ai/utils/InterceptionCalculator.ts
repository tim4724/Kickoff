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
   * IMPORTANT: Accounts for PRESSURE_RADIUS - players can capture ball when within 70px,
   * not just at exact position. This is critical for accurate pass/interception calculations.
   *
   * @returns Interception data if any player can intercept, null otherwise
   */
  static calculateInterception(
    players: PlayerData[],
    predictPosition: (timeSeconds: number) => Vector2D
  ): { interceptor: PlayerData; interceptPoint: Vector2D } {
    const playerSpeed = GAME_CONFIG.PLAYER_SPEED
    const pressureRadius = GAME_CONFIG.PRESSURE_RADIUS
    const maxLookAhead = 4.0 // seconds
    const timeStep = 0.1 // check every 0.1 seconds

    let lastFuturePos: Vector2D | null = null

    // For each time step, check if any player can reach the ball
    for (let t = timeStep; t <= maxLookAhead; t += timeStep) {
      const futurePos = predictPosition(t)
      lastFuturePos = futurePos
      const maxPlayerTravel = playerSpeed * t // How far can a player travel in time t?

      // Find ALL players who can intercept at this time, then pick the closest
      let closestInterceptor: PlayerData | null = null
      let closestDistance = Infinity

      for (const player of players) {
        const distanceToBall = this.distance(player.position, futurePos)

        // Can this player reach the ball (within pressure radius) in time t?
        if (distanceToBall - pressureRadius <= maxPlayerTravel) {
          // This player CAN intercept - check if they're closest
          if (distanceToBall < closestDistance) {
            closestInterceptor = player
            closestDistance = distanceToBall
          }
        }
      }

      // If any player can intercept at this time, return the closest one
      if (closestInterceptor) {
        return { interceptor: closestInterceptor, interceptPoint: futurePos }
      }
    }

    // No interception possible - return player closest to final ball position
    const finalPos = lastFuturePos || predictPosition(0)

    // Guard against empty players array
    if (players.length === 0) {
      throw new Error('InterceptionCalculator: players array cannot be empty')
    }

    const closestPlayer = players.reduce((best, p) =>
      this.distance(p.position, finalPos) < this.distance(best.position, finalPos) ? p : best
    , players[0]) // Provide initial value to avoid reduce error

    return { interceptor: closestPlayer, interceptPoint: finalPos }
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
    // IMPORTANT: Use 60Hz physics timestep to match GameEngine's FIXED_TIMESTEP
    // TICK_RATE (30Hz) is for network updates, not physics simulation
    const PHYSICS_HZ = 60
    const dt = 1 / PHYSICS_HZ // 0.01666s per step (matches GameEngine)
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
  static predictPlayerBallPosition(
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
