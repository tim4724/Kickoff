/**
 * InterceptionCalculator - Calculate ball interception points
 *
 * Provides utilities for calculating where and when players can intercept
 * the ball, used for both defensive interceptions and passing calculations.
 *
 * Extracted from TeamAI.ts existing logic.
 */

import { Vector2D } from '../types'
import { GAME_CONFIG } from '@shared/types'
import { EnginePlayerData } from '@shared/engine/types'
import { PhysicsEngine } from '@shared/engine/PhysicsEngine'
import { GeometryUtils } from '@shared/utils/geometry'

export class InterceptionCalculator {
  // Reused objects to prevent allocation in simulateBallPosition
  // This method is called thousands of times per frame in AI pass evaluation
  private static reusedStepResult = { x: 0, y: 0, vx: 0, vy: 0 }

  // Physics config matching game engine (full field bounds, no margin)
  private static readonly physicsConfig = {
    ballFriction: GAME_CONFIG.BALL_FRICTION,
    fieldWidth: GAME_CONFIG.FIELD_WIDTH,
    fieldHeight: GAME_CONFIG.FIELD_HEIGHT,
    goalYMin: GAME_CONFIG.GOAL_Y_MIN,
    goalYMax: GAME_CONFIG.GOAL_Y_MAX,
  }

  /**
   * Find earliest interception from multiple players
   * Returns the first player to intercept, the point, and the time.
   *
   * IMPORTANT: Accounts for interceptionRadius - players can capture ball when within this distance,
   * not just at exact position. This is critical for accurate pass/interception calculations.
   *
   * @param players - Array of players that could potentially intercept
   * @param predictPosition - Function that predicts ball position at a given time
   * @param interceptionRadius - Maximum distance at which a player can intercept the ball
   * @returns Interception data with time (Infinity if no interception within lookahead)
   */
  static calculateInterception(
    players: EnginePlayerData[],
    predictPosition: (timeSeconds: number) => Vector2D,
    interceptionRadius: number
  ): { interceptor: EnginePlayerData; interceptPoint: Vector2D; time: number } {
    const playerSpeed = GAME_CONFIG.PLAYER_SPEED
    const maxLookAhead = 4.0 // seconds
    const timeStep = 0.1 // check every 0.1 seconds

    let lastFuturePos: Vector2D | null = null

    // For each time step, check if any player can reach the ball
    for (let t = timeStep; t <= maxLookAhead; t += timeStep) {
      const futurePos = predictPosition(t)
      lastFuturePos = futurePos
      const maxPlayerTravel = playerSpeed * t

      // Find ALL players who can intercept at this time, then pick the closest
      let closestInterceptor: EnginePlayerData | null = null
      let closestDistance = Infinity

      for (const player of players) {
        const distanceToBall = GeometryUtils.distancePoint(player, futurePos)

        // Can this player reach the ball (within interception radius) in time t?
        if (distanceToBall - interceptionRadius <= maxPlayerTravel) {
          if (distanceToBall < closestDistance) {
            closestInterceptor = player
            closestDistance = distanceToBall
          }
        }
      }

      // If any player can intercept at this time, return the closest one
      if (closestInterceptor) {
        return { interceptor: closestInterceptor, interceptPoint: futurePos, time: t }
      }
    }

    // No interception possible - return player closest to final ball position
    const finalPos = lastFuturePos || predictPosition(0)

    // Guard against empty players array
    if (players.length === 0) {
      throw new Error('InterceptionCalculator: players array cannot be empty')
    }

    const closestPlayer = players.reduce((best, p) =>
      GeometryUtils.distanceSquaredPoint(p, finalPos) < GeometryUtils.distanceSquaredPoint(best, finalPos) ? p : best
    , players[0])

    return { interceptor: closestPlayer, interceptPoint: finalPos, time: Infinity }
  }

  /**
   * Simulate ball position after timeSeconds accounting for friction AND wall bounces
   * Uses PhysicsEngine.simulateBallStep for accurate physics matching game engine
   */
  static simulateBallPosition(
    startPos: Vector2D,
    startVelX: number,
    startVelY: number,
    timeSeconds: number
  ): Vector2D {
    // IMPORTANT: Use 60Hz physics timestep to match GameEngine's FIXED_TIMESTEP
    // TICK_RATE (30Hz) is for network updates, not physics simulation
    const PHYSICS_HZ = 60
    const dt = 1 / PHYSICS_HZ // 0.01666s per step (matches GameEngine)
    const steps = Math.ceil(timeSeconds / dt)

    let x = startPos.x
    let y = startPos.y
    let vx = startVelX
    let vy = startVelY

    // Reuse static object to avoid allocation in tight loop
    const stepResult = InterceptionCalculator.reusedStepResult
    const physicsConfig = InterceptionCalculator.physicsConfig

    // Simulate step-by-step using actual PhysicsEngine logic
    for (let i = 0; i < steps; i++) {
      PhysicsEngine.simulateBallStep(x, y, vx, vy, dt, physicsConfig, stepResult)

      x = stepResult.x
      y = stepResult.y
      vx = stepResult.vx
      vy = stepResult.vy

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
}
