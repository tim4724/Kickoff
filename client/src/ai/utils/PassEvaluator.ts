/**
 * PassEvaluator - Unified pass evaluation logic
 *
 * Evaluates fixed grid positions across the field to find best pass targets.
 * Returns one best position per teammate with anti-clustering.
 */

import { Vector2D } from '../types'
import { GAME_CONFIG } from '@shared/types'
import { EnginePlayerData } from '@shared/engine/types'
import { GeometryUtils } from '@shared/utils/geometry'
import { InterceptionCalculator } from './InterceptionCalculator'

export interface PassOption {
  teammate: EnginePlayerData
  position: Vector2D
  score: number
}

export class PassEvaluator {
  private static readonly GRID_COLS = 15
  private static readonly GRID_ROWS = 8
  private static gridPositions: Vector2D[] | null = null

  // Scoring weights for pass evaluation
  private static readonly SCORE_WEIGHT_FORWARD_PROGRESS = 0.4
  private static readonly SCORE_WEIGHT_SPACE = 0.5
  private static readonly SCORE_WEIGHT_MOVEMENT = 0.1
  private static readonly SPACE_CAP = GAME_CONFIG.FIELD_HEIGHT / 3
  private static readonly MIN_SPACING = PassEvaluator.SPACE_CAP / 2
  private static readonly MIN_SPACING_SQUARED = PassEvaluator.MIN_SPACING * PassEvaluator.MIN_SPACING

  /**
   * Get cached fixed grid positions (15×8 = 120 positions)
   */
  private static getGrid(): Vector2D[] {
    if (this.gridPositions) return this.gridPositions

    const colSpacing = GAME_CONFIG.FIELD_WIDTH / (this.GRID_COLS + 1)
    const rowSpacing = GAME_CONFIG.FIELD_HEIGHT / (this.GRID_ROWS + 1)
    const positions: Vector2D[] = []

    for (let row = 1; row <= this.GRID_ROWS; row++) {
      for (let col = 1; col <= this.GRID_COLS; col++) {
        positions.push({ x: col * colSpacing, y: row * rowSpacing })
      }
    }

    return (this.gridPositions = positions)
  }

  /**
   * Create ball trajectory predictor for interception calculation
   */
  private static ballPredictor(from: Vector2D, to: Vector2D, speed: number) {
    const dist = GeometryUtils.distancePoint(from, to)
    const vx = dist > 0 ? ((to.x - from.x) / dist) * speed : 0
    const vy = dist > 0 ? ((to.y - from.y) / dist) * speed : 0
    return (t: number) => InterceptionCalculator.simulateBallPosition(from, vx, vy, t)
  }

  /**
   * Evaluate pass options: one best position per teammate with anti-clustering
   */
  static evaluatePassOptions(
    ballPos: Vector2D,
    teammates: EnginePlayerData[],
    opponents: EnginePlayerData[],
    opponentGoal: Vector2D
  ): PassOption[] {
    if (teammates.length === 0) return []

    // All passes use full power now
    const passSpeed = GAME_CONFIG.SHOOT_SPEED

    // Group options by teammate
    const optionsByTeammate = new Map(teammates.map(t => [t.id, [] as PassOption[]]))

    // Evaluate each grid position
    for (const pos of this.getGrid()) {
      // Use squared distance for comparison (no sqrt needed)
      if (GeometryUtils.distanceSquaredPoint(ballPos, pos) < this.MIN_SPACING_SQUARED) continue

      const predictor = this.ballPredictor(ballPos, pos, passSpeed)

      // Find earliest opponent interception and use that opponent for space calculation
      let earliestOpponentTime = Infinity
      let spaceAtTarget: number
      if (opponents.length > 0) {
        const { interceptor, time } = InterceptionCalculator.calculateInterception(
          opponents,
          predictor,
          GAME_CONFIG.CHALLENGE_RADIUS
        )
        earliestOpponentTime = time
        spaceAtTarget = GeometryUtils.distancePoint(pos, interceptor)
      } else {
        spaceAtTarget = this.SPACE_CAP
      }

      // Forward progress is same for all teammates at this position
      const forwardProgress = GeometryUtils.distancePoint(ballPos, opponentGoal) - GeometryUtils.distancePoint(pos, opponentGoal)

      // Check each teammate's interception time
      for (const teammate of teammates) {
        const { time } = InterceptionCalculator.calculateInterception(
          [teammate],
          predictor,
          GAME_CONFIG.CHALLENGE_RADIUS
        )

        // Skip if teammate intercepts at or after earliest opponent
        if (time >= earliestOpponentTime) continue

        const options = optionsByTeammate.get(teammate.id)
        if (!options) continue

        // Score: forward progress + space - movement distance
        const movement = GeometryUtils.distancePoint(teammate, pos)
        const score =
          forwardProgress * this.SCORE_WEIGHT_FORWARD_PROGRESS +
          Math.min(this.SPACE_CAP, spaceAtTarget) * this.SCORE_WEIGHT_SPACE -
          movement * this.SCORE_WEIGHT_MOVEMENT

        options.push({ teammate, position: pos, score })
      }
    }

    // Sort options in-place per teammate (by score, descending)
    for (const options of optionsByTeammate.values()) {
      options.sort((a, b) => b.score - a.score)
    }

    // Select best position per teammate with anti-clustering
    const selected: PassOption[] = []
    const usedPositions: Vector2D[] = [ballPos] // Include ball position to avoid clustering near it

    // Sort teammates by their best option score (descending)
    // Filter out teammates with no options - they won't get a position assigned
    const teammatesByBestOption = teammates
      .map(t => {
        const options = optionsByTeammate.get(t.id) || []
        return { options, bestOption: options[0] }
      })
      .filter(x => x.bestOption !== undefined)
      .sort((a, b) => b.bestOption.score - a.bestOption.score)

    // Assign positions with spacing constraint (from ball and other positions)
    // Process teammates in order of best option score to prioritize higher-quality passes
    for (const { options } of teammatesByBestOption) {
      // Find first option with minimum spacing, or fallback to best option
      const option = options.find(candidate =>
        usedPositions.every(p => GeometryUtils.distanceSquaredPoint(candidate.position, p) >= this.MIN_SPACING_SQUARED)
      ) || options[0]

      if (option) {
        selected.push(option)
        usedPositions.push(option.position)
      }
    }

    // Final result is already sorted by teammate priority, but sort by score for consistency
    // Note: This maintains order for teammates with similar scores
    return selected.sort((a, b) => b.score - a.score)
  }
}
