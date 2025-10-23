/**
 * PassEvaluator - Unified pass evaluation logic
 *
 * Provides common utilities for evaluating pass targets and positioning.
 * Used by both ball carrier decision-making (HasBallStrategy) and
 * off-ball positioning (OffensiveStrategy).
 */

import { Vector2D } from '../types'
import { PlayerData, GAME_CONFIG } from '../../../../shared/src/types'
import { InterceptionCalculator } from './InterceptionCalculator'

export interface PassOption {
  position: Vector2D
  score: number
  interceptor: PlayerData
  teammate: PlayerData
  forwardProgress: number
  spaceAtTarget: number
  passDistance: number
  teammateMovement: number
}

export class PassEvaluator {
  /**
   * Evaluate all possible pass targets for given teammates
   * Generates candidate positions, simulates physics, checks interception, scores
   *
   * @param ballPosition - Position to pass from
   * @param teammates - Teammates to consider as pass receivers
   * @param opponents - Opponent players
   * @param opponentGoal - Target goal position
   * @returns Array of viable pass options sorted by score (best first)
   */
  static evaluatePassOptions(
    ballPosition: Vector2D,
    teammates: PlayerData[],
    opponents: PlayerData[],
    opponentGoal: Vector2D
  ): PassOption[] {
    if (teammates.length === 0) return []

    const allPlayers = [...teammates, ...opponents]
    const options: PassOption[] = []
    const PASS_POWER = 0.5
    const passSpeed = GAME_CONFIG.MIN_SHOOT_SPEED +
      (GAME_CONFIG.SHOOT_SPEED - GAME_CONFIG.MIN_SHOOT_SPEED) * PASS_POWER

    for (const teammate of teammates) {
      const candidates = this.generateCandidatePositions(teammate, opponentGoal)

      for (const position of candidates) {
        const dx = position.x - ballPosition.x
        const dy = position.y - ballPosition.y
        const passDistance = Math.sqrt(dx * dx + dy * dy)

        if (passDistance < 50) continue
        const predictBallPosition = this.createBallPredictor(ballPosition, position, passSpeed)
        const { interceptor } = InterceptionCalculator.calculateInterception(
          allPlayers,
          predictBallPosition,
          ballPosition
        )

        if (interceptor.id !== teammate.id) continue

        const forwardProgress =
          InterceptionCalculator.distance(ballPosition, opponentGoal) -
          InterceptionCalculator.distance(position, opponentGoal)

        const spaceAtTarget = Math.min(
          ...opponents.map(opp => InterceptionCalculator.distance(position, opp.position))
        )

        const teammateMovement = InterceptionCalculator.distance(teammate.position, position)

        const score = forwardProgress * 0.5 + spaceAtTarget * 0.3 - teammateMovement * 0.2

        options.push({
          position,
          score,
          interceptor,
          teammate,
          forwardProgress,
          spaceAtTarget,
          passDistance,
          teammateMovement,
        })
      }
    }

    return options.sort((a, b) => b.score - a.score)
  }

  /**
   * Generate candidate positions around a teammate
   * Creates ~30 positions in various directions and forward-biased positions
   */
  private static generateCandidatePositions(
    teammate: PlayerData,
    opponentGoal: Vector2D
  ): Vector2D[] {
    const candidates: Vector2D[] = []
    const CANDIDATE_DISTANCES = [100, 200, 300]
    const CANDIDATE_ANGLES = 8 // 45° increments

    // Determine forward direction (toward opponent goal)
    const toGoalX = opponentGoal.x - teammate.position.x
    const toGoalY = opponentGoal.y - teammate.position.y
    const toGoalDist = Math.sqrt(toGoalX * toGoalX + toGoalY * toGoalY)
    const forwardX = toGoalDist > 1 ? toGoalX / toGoalDist : 1
    const forwardY = toGoalDist > 1 ? toGoalY / toGoalDist : 0

    // Add positions in various directions (8 angles × 3 distances = 24 positions)
    const angleIncrement = (2 * Math.PI) / CANDIDATE_ANGLES
    for (let i = 0; i < CANDIDATE_ANGLES; i++) {
      const angle = i * angleIncrement
      for (const distance of CANDIDATE_DISTANCES) {
        const x = teammate.position.x + Math.cos(angle) * distance
        const y = teammate.position.y + Math.sin(angle) * distance

        if (x >= 0 && x <= GAME_CONFIG.FIELD_WIDTH && y >= 0 && y <= GAME_CONFIG.FIELD_HEIGHT) {
          candidates.push({ x, y })
        }
      }
    }

    // Add forward-biased positions (toward goal) (2 distances × 3 lateral = 6 positions)
    for (const distance of [150, 250]) {
      for (const lateralOffset of [-100, 0, 100]) {
        const perpX = -forwardY // Perpendicular to forward direction
        const perpY = forwardX

        const x = teammate.position.x + forwardX * distance + perpX * lateralOffset
        const y = teammate.position.y + forwardY * distance + perpY * lateralOffset

        if (x >= 0 && x <= GAME_CONFIG.FIELD_WIDTH && y >= 0 && y <= GAME_CONFIG.FIELD_HEIGHT) {
          candidates.push({ x, y })
        }
      }
    }

    return candidates
  }

  /**
   * Create ball position predictor function
   * Simulates a pass from ballPosition to targetPosition at passSpeed
   */
  private static createBallPredictor(
    ballPosition: Vector2D,
    targetPosition: Vector2D,
    passSpeed: number
  ): (t: number) => Vector2D {
    // Calculate pass direction
    const dx = targetPosition.x - ballPosition.x
    const dy = targetPosition.y - ballPosition.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const dirX = dist > 0 ? dx / dist : 0
    const dirY = dist > 0 ? dy / dist : 0
    const velocity = { x: dirX * passSpeed, y: dirY * passSpeed }

    // Simulate pass with friction and bounces
    return (t: number) => InterceptionCalculator.simulateBallPosition(ballPosition, velocity, t)
  }

  /**
   * Find best pass target from evaluated options
   * Returns the highest-scoring position, or null if no viable passes
   */
  static findBestPassTarget(options: PassOption[]): Vector2D | null {
    if (options.length === 0) return null
    return options[0].position // Already sorted by score
  }

  /**
   * Find best receive position for a specific player
   * Returns the best position where this player can receive the ball
   */
  static findBestReceivePosition(
    player: PlayerData,
    options: PassOption[]
  ): Vector2D | null {
    const playerOptions = options.filter(opt => opt.teammate.id === player.id)
    if (playerOptions.length === 0) return null
    return playerOptions[0].position
  }
}
