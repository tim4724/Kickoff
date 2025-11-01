/**
 * HasBallStrategy - Ball carrier decision-making
 *
 * Evaluates the best action for a player in possession of the ball.
 * Returns a role assignment (shoot, dribble, pass) based on game state.
 */

import { Vector2D, PlayerRole } from '../types'
import { PlayerData, GAME_CONFIG } from '../../../../shared/src/types'
import { InterceptionCalculator } from '../utils/InterceptionCalculator'
import { PassOption } from '../utils/PassEvaluator'

export class HasBallStrategy {
  /**
   * Decide the best action for the ball carrier
   *
   * @param carrier - Player with ball possession
   * @param opponents - Opponent players
   * @param opponentGoal - Target goal position
   * @param passOptions - Pre-calculated pass options (optional, will calculate if not provided)
   * @returns Role assignment for the ball carrier
   */
  static decideBallCarrierAction(
    carrier: PlayerData,
    opponents: PlayerData[],
    opponentGoal: Vector2D,
    passOptions: PassOption[]
  ): PlayerRole {
    const distToGoal = InterceptionCalculator.distance(carrier.position, opponentGoal)

    // Step 1: Check if in shooting range (within 1/3 of field width)
    const SHOOTING_RANGE = GAME_CONFIG.FIELD_WIDTH / 3 // 640px
    if (distToGoal < SHOOTING_RANGE) {
      // Evaluate shot angles using interception logic
      const shotOption = this.findBestShotTarget(carrier, opponents, opponentGoal)

      if (shotOption) {
        const shootPower = Math.min(1.0, distToGoal / SHOOTING_RANGE) // Further = harder shot
        return { goal: 'shoot', target: shotOption.target, shootPower }
      }
    }

    // Step 2: Evaluate if opponents can intercept path to goal
    const { interceptDistance } = this.evaluateOpponentIntercept(
      carrier,
      opponents,
      opponentGoal
    )

    // Check if path is blocked (opponent can intercept within threshold)
    const INTERCEPT_THRESHOLD = 200
    const isPathBlocked = interceptDistance < INTERCEPT_THRESHOLD

    // Step 3: If path is blocked, try to pass
    if (isPathBlocked) {
      const passTarget = passOptions[0]?.position

      if (passTarget) {
        return { goal: 'pass', target: passTarget, shootPower: 0.5 }
      }

      // No viable pass - dribble to empty space
      const dribbleSpace = this.findBestDribbleSpace(carrier, opponents, opponentGoal)
      if (dribbleSpace) {
        return { goal: 'dribbleToSpace', target: dribbleSpace }
      }

      // Fallback: dribble toward goal anyway
      return { goal: 'dribbleToGoal', target: opponentGoal }
    }

    return { goal: 'dribbleToGoal', target: opponentGoal }
  }

  /**
   * Evaluate opponent interception of carrier's path to goal
   * Returns the closest intercept point and distance
   */
  private static evaluateOpponentIntercept(
    carrier: PlayerData,
    opponents: PlayerData[],
    goal: Vector2D
  ): { interceptPoint: Vector2D; interceptDistance: number } {
    // Direction vector from carrier to goal
    const dx = goal.x - carrier.position.x
    const dy = goal.y - carrier.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 1) {
      // Already at goal
      return { interceptPoint: goal, interceptDistance: Infinity }
    }

    const dirX = dx / dist
    const dirY = dy / dist

    // Predict carrier's path to goal (moving at player speed)
    const predictCarrierPosition = (t: number): Vector2D => {
      return InterceptionCalculator.predictPlayerBallPosition(
        carrier.position,
        { x: dirX, y: dirY },
        t
      )
    }

    // Find which opponent can intercept fastest
    const { interceptPoint } = InterceptionCalculator.calculateInterception(
      opponents,
      predictCarrierPosition
    )

    // Calculate distance from intercept point to carrier's current position
    const interceptDistance = InterceptionCalculator.distance(carrier.position, interceptPoint)

    return { interceptPoint, interceptDistance }
  }


  /**
   * Find the best shot target using interception calculations
   * Evaluates multiple angles within the goal and chooses the most open shot
   *
   * @param carrier - Player with the ball
   * @param opponents - Opponent players
   * @param opponentGoal - Center of goal position
   * @returns Best shot target and score, or null if all shots blocked
   */
  private static findBestShotTarget(
    carrier: PlayerData,
    opponents: PlayerData[],
    opponentGoal: Vector2D
  ): { target: Vector2D; interceptDistance: number } | null {
    // Generate candidate shot targets across the goal
    const goalX = opponentGoal.x
    const candidateYPositions = [
      GAME_CONFIG.GOAL_Y_MIN + 20, // Top corner (with margin)
      GAME_CONFIG.GOAL_Y_MIN + (GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN) / 3, // Upper third
      opponentGoal.y, // Center
      GAME_CONFIG.GOAL_Y_MAX - (GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN) / 3, // Lower third
      GAME_CONFIG.GOAL_Y_MAX - 20, // Bottom corner (with margin)
    ]

    interface ShotOption {
      target: Vector2D
      interceptDistance: number
    }

    const shotOptions: ShotOption[] = []

    for (const targetY of candidateYPositions) {
      const shotTarget: Vector2D = { x: goalX, y: targetY }

      // Calculate shot trajectory direction
      const dx = shotTarget.x - carrier.position.x
      const dy = shotTarget.y - carrier.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 1) continue // Skip if already at target

      const dirX = dx / dist
      const dirY = dy / dist

      // Predict ball position along shot trajectory
      const predictBallPosition = (t: number): Vector2D => {
        return InterceptionCalculator.simulateBallPosition(
          carrier.position,
          { x: dirX * GAME_CONFIG.SHOOT_SPEED, y: dirY * GAME_CONFIG.SHOOT_SPEED },
          t
        )
      }

      // Check if opponents can intercept this shot
      const { interceptPoint } = InterceptionCalculator.calculateInterception(
        opponents,
        predictBallPosition
      )

      // Calculate how far the intercept point is from carrier (further = better)
      const interceptDistance = InterceptionCalculator.distance(carrier.position, interceptPoint)

      shotOptions.push({ target: shotTarget, interceptDistance })
    }

    // No viable shots
    if (shotOptions.length === 0) return null

    // Choose shot with maximum intercept distance (most open shot)
    shotOptions.sort((a, b) => b.interceptDistance - a.interceptDistance)

    const bestShot = shotOptions[0]

    // Only shoot if intercept distance is reasonable (opponent can't easily block)
    const MIN_INTERCEPT_DISTANCE = 150
    if (bestShot.interceptDistance < MIN_INTERCEPT_DISTANCE) {
      return null // All shots too risky
    }

    return bestShot
  }

  /**
   * Find the best empty space to dribble to when path is blocked
   * Evaluates positions around the carrier for space from opponents
   *
   * @param carrier - Player with the ball
   * @param opponents - Opponent players
   * @param opponentGoal - Target goal position
   * @returns Best dribble target position, or null if no good space found
   */
  private static findBestDribbleSpace(
    carrier: PlayerData,
    opponents: PlayerData[],
    opponentGoal: Vector2D
  ): Vector2D | null {
    // Generate candidate dribble positions around carrier
    const DRIBBLE_DISTANCES = [150, 250] // Two distance rings
    const ANGLES = 8 // 45° increments

    interface DribbleOption {
      position: Vector2D
      score: number
    }

    const dribbleOptions: DribbleOption[] = []

    // Calculate forward direction toward goal
    const toGoalX = opponentGoal.x - carrier.position.x
    const toGoalY = opponentGoal.y - carrier.position.y
    const toGoalDist = Math.sqrt(toGoalX * toGoalX + toGoalY * toGoalY)
    const forwardX = toGoalDist > 1 ? toGoalX / toGoalDist : 1
    const forwardY = toGoalDist > 1 ? toGoalY / toGoalDist : 0

    const angleIncrement = (2 * Math.PI) / ANGLES
    for (let i = 0; i < ANGLES; i++) {
      const angle = i * angleIncrement

      for (const distance of DRIBBLE_DISTANCES) {
        const x = carrier.position.x + Math.cos(angle) * distance
        const y = carrier.position.y + Math.sin(angle) * distance

        // Skip if out of bounds
        if (x < 0 || x > GAME_CONFIG.FIELD_WIDTH || y < 0 || y > GAME_CONFIG.FIELD_HEIGHT) {
          continue
        }

        const position: Vector2D = { x, y }

        // Calculate space from nearest opponent (higher = better)
        const spaceFromOpponents = Math.min(
          ...opponents.map(opp => InterceptionCalculator.distance(position, opp.position))
        )

        // Calculate forward progress toward goal (positive = progress, negative = backward)
        const currentDistToGoal = InterceptionCalculator.distance(carrier.position, opponentGoal)
        const newDistToGoal = InterceptionCalculator.distance(position, opponentGoal)
        const forwardProgress = currentDistToGoal - newDistToGoal

        // Calculate lateral component (perpendicular to goal direction)
        const dirX = x - carrier.position.x
        const dirY = y - carrier.position.y
        const dirDist = Math.sqrt(dirX * dirX + dirY * dirY)
        const normDirX = dirDist > 0 ? dirX / dirDist : 0
        const normDirY = dirDist > 0 ? dirY / dirDist : 0

        // Dot product with forward direction (1 = straight ahead, -1 = backward)
        const forwardDot = normDirX * forwardX + normDirY * forwardY

        // Score: prioritize space, slight preference for forward/lateral over backward
        const score = spaceFromOpponents * 1.0 + forwardProgress * 0.2 + forwardDot * 50

        dribbleOptions.push({ position, score })
      }
    }

    if (dribbleOptions.length === 0) return null

    // Sort by score (highest first)
    dribbleOptions.sort((a, b) => b.score - a.score)

    const bestOption = dribbleOptions[0]

    // Only use if we find reasonable space (at least 100px from opponents)
    const MIN_SPACE = 100
    const spaceAtBest = Math.min(
      ...opponents.map(opp => InterceptionCalculator.distance(bestOption.position, opp.position))
    )

    if (spaceAtBest < MIN_SPACE) {
      return null // No good space found
    }

    return bestOption.position
  }
}
