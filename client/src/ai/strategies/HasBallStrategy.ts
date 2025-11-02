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
  // Shooting constants
  private static readonly SHOOTING_RANGE = GAME_CONFIG.FIELD_WIDTH / 3 // 640px
  private static readonly MIN_INTERCEPT_DISTANCE = 150 // Minimum distance for safe shot
  private static readonly GOAL_MARGIN = 20 // Margin from goal edges for shot targets
  private static readonly MAX_SHOOT_POWER = 1.0

  // Path blocking constants
  private static readonly INTERCEPT_THRESHOLD = 200 // Distance threshold for blocked path

  // Dribble constants
  private static readonly DRIBBLE_DISTANCES = [150, 250] // Two distance rings
  private static readonly DRIBBLE_ANGLES = 8 // 45° increments

  // Pass constants
  private static readonly PASS_SHOOT_POWER = 0.5

  // Scoring constants
  private static readonly MAX_SPACE_CAP = 300 // Maximum space value in scoring calculation
  private static readonly SCORE_WEIGHT_SPACE = 1.0
  private static readonly SCORE_WEIGHT_FORWARD_PROGRESS = 0.2
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

    if (distToGoal < this.SHOOTING_RANGE) {
      // Evaluate shot angles using interception logic
      const shotOption = this.findBestShotTarget(carrier, opponents, opponentGoal)

      if (shotOption) {
        const shootPower = Math.min(this.MAX_SHOOT_POWER, distToGoal / this.SHOOTING_RANGE) // Further = harder shot
        return { goal: 'shoot', target: shotOption.target, shootPower }
      }
    }

    const { interceptDistance } = this.evaluateOpponentIntercept(
      carrier,
      opponents,
      opponentGoal
    )

    // Check if path is blocked (opponent can intercept within threshold)
    const isPathBlocked = interceptDistance < this.INTERCEPT_THRESHOLD

    if (!isPathBlocked) {
      return { goal: 'dribbleToGoal', target: opponentGoal }
    }

    const passOption = passOptions[0]
    const dribbleOption = this.findBestDribbleSpace(carrier, opponents, opponentGoal)

    // XOR case: Only one option available - choose it
    const hasPass = passOption !== undefined

     // Both available - compare scores and choose better option
     if (hasPass) {
       const passScore = this.evaluatePassScore(carrier, passOption, opponentGoal, opponents)
       // Choose option with higher score
       if (passScore > dribbleOption.score) {
         return { goal: 'pass', target: passOption.position, shootPower: this.PASS_SHOOT_POWER }
       } else {
         return { goal: 'dribbleToSpace', target: dribbleOption.position }
       }
    }

    return { goal: 'dribbleToSpace', target: dribbleOption.position }
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
      predictCarrierPosition,
      GAME_CONFIG.PRESSURE_RADIUS
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
      GAME_CONFIG.GOAL_Y_MIN + this.GOAL_MARGIN, // Top corner (with margin)
      GAME_CONFIG.GOAL_Y_MIN + (GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN) / 3, // Upper third
      opponentGoal.y, // Center
      GAME_CONFIG.GOAL_Y_MAX - (GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN) / 3, // Lower third
      GAME_CONFIG.GOAL_Y_MAX - this.GOAL_MARGIN, // Bottom corner (with margin)
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
        predictBallPosition,
        GAME_CONFIG.PRESSURE_RADIUS
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
    if (bestShot.interceptDistance < this.MIN_INTERCEPT_DISTANCE) {
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
   * @returns Best dribble target position with score, or null if no good space found
   */
  private static findBestDribbleSpace(
    carrier: PlayerData,
    opponents: PlayerData[],
    opponentGoal: Vector2D
  ): { position: Vector2D; score: number } {
    // Initialize best option with opponentGoal and infinity score (fallback if no better option found)
    let bestOption: { position: Vector2D; score: number } = {
      position: opponentGoal,
      score: 0
    }

    const angleIncrement = (2 * Math.PI) / this.DRIBBLE_ANGLES
    for (let i = 0; i < this.DRIBBLE_ANGLES; i++) {
      const angle = i * angleIncrement

      for (const distance of this.DRIBBLE_DISTANCES) {
        const x = carrier.position.x + Math.cos(angle) * distance
        const y = carrier.position.y + Math.sin(angle) * distance

        // Skip if out of bounds
        if (x < 0 || x > GAME_CONFIG.FIELD_WIDTH || y < 0 || y > GAME_CONFIG.FIELD_HEIGHT) {
          continue
        }

        const position: Vector2D = { x, y }
        const score = this.evaluatePositionScore(carrier, position, opponentGoal, opponents)

        // Track best option so far
        if (score > bestOption.score) {
          bestOption = { position, score }
        }
      }
    }
    return bestOption
  }

  /**
   * Shared scoring function for both pass and dribble options
   * Ensures fair comparison using identical metrics
   *
   * @param carrier - Player with the ball
   * @param targetPosition - Position to evaluate (pass target or dribble position)
   * @param opponentGoal - Target goal position
   * @param opponents - Opponent players
   * @returns Score (higher = better)
   */
  private static evaluatePositionScore(
    carrier: PlayerData,
    targetPosition: Vector2D,
    opponentGoal: Vector2D,
    opponents: PlayerData[]
  ): number {
    // Space from opponents (higher = better)
    const space =
      opponents.length > 0
        ? Math.min(...opponents.map(opp => InterceptionCalculator.distance(targetPosition, opp.position)))
        : Infinity

    // Forward progress toward goal (positive = forward, negative = backward)
    const forwardProgress =
      InterceptionCalculator.distance(carrier.position, opponentGoal) -
      InterceptionCalculator.distance(targetPosition, opponentGoal)

    // Simplified scoring: prioritize space and forward progress
    return Math.min(this.MAX_SPACE_CAP, space) * this.SCORE_WEIGHT_SPACE + forwardProgress * this.SCORE_WEIGHT_FORWARD_PROGRESS
  }

  /**
   * Evaluate pass option using comparable scoring metric
   * Uses same scoring as dribble for fair comparison
   *
   * @param carrier - Player with the ball
   * @param passOption - Pass option to evaluate
   * @param opponentGoal - Target goal position
   * @param opponents - Opponent players
   * @returns Score for pass option (higher = better)
   */
  private static evaluatePassScore(
    carrier: PlayerData,
    passOption: PassOption,
    opponentGoal: Vector2D,
    opponents: PlayerData[]
  ): number {
    return this.evaluatePositionScore(carrier, passOption.position, opponentGoal, opponents)
  }
}
