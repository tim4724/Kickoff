/**
 * PassEvaluator - Unified pass evaluation logic
 *
 * Evaluates fixed grid positions across the field to find best pass targets.
 * Returns one best position per teammate with anti-clustering.
 */

import { Vector2D } from '../types'
import { PlayerData, GAME_CONFIG } from '../../../../shared/src/types'
import { InterceptionCalculator } from './InterceptionCalculator'

export interface PassOption {
  teammate: PlayerData
  position: Vector2D
  score: number
}

export class PassEvaluator {
  private static readonly GRID_COLS = 15
  private static readonly GRID_ROWS = 8
  private static readonly MIN_PASS_DISTANCE = 50
  private static readonly PASS_POWER = 0.5
  private static gridPositions: Vector2D[] | null = null

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
   * Calculate distance between two positions
   */
  private static dist(a: Vector2D, b: Vector2D): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Create ball trajectory predictor for interception calculation
   */
  private static ballPredictor(from: Vector2D, to: Vector2D, speed: number) {
    const dist = this.dist(from, to)
    const vx = dist > 0 ? ((to.x - from.x) / dist) * speed : 0
    const vy = dist > 0 ? ((to.y - from.y) / dist) * speed : 0
    return (t: number) => InterceptionCalculator.simulateBallPosition(from, { x: vx, y: vy }, t)
  }

  /**
   * Evaluate pass options: one best position per teammate with anti-clustering
   */
  static evaluatePassOptions(
    ballPos: Vector2D,
    teammates: PlayerData[],
    opponents: PlayerData[],
    opponentGoal: Vector2D,
    minSpacing = 200
  ): PassOption[] {
    if (teammates.length === 0) return []

    const allPlayers = [...teammates, ...opponents]
    const passSpeed =
      GAME_CONFIG.MIN_SHOOT_SPEED +
      (GAME_CONFIG.SHOOT_SPEED - GAME_CONFIG.MIN_SHOOT_SPEED) * this.PASS_POWER

    // Group options by teammate
    const optionsByTeammate = new Map(teammates.map(t => [t.id, [] as PassOption[]]))

    // Evaluate each grid position
    for (const pos of this.getGrid()) {
      const passDist = this.dist(ballPos, pos)
      if (passDist < this.MIN_PASS_DISTANCE) continue

      // Check who intercepts
      const predictor = this.ballPredictor(ballPos, pos, passSpeed)
      const { interceptor } = InterceptionCalculator.calculateInterception(allPlayers, predictor)

      const options = optionsByTeammate.get(interceptor.id)
      if (!options) continue

      // Score: forward progress + space - movement distance
      const forwardProgress = this.dist(ballPos, opponentGoal) - this.dist(pos, opponentGoal)
      const spaceAtTarget = Math.min(...opponents.map(opp => this.dist(pos, opp.position)))
      const movement = this.dist(interceptor.position, pos)
      const score = forwardProgress * 0.5 + spaceAtTarget * 0.3 - movement * 0.2

      options.push({ teammate: interceptor, position: pos, score })
    }

    // Select best position per teammate with anti-clustering
    const selected: PassOption[] = []
    const usedPositions: Vector2D[] = [ballPos] // Include ball position to avoid clustering near it

    // Sort teammates by best option score
    const sorted = teammates
      .map(t => ({ t, best: optionsByTeammate.get(t.id)!.sort((a, b) => b.score - a.score)[0] }))
      .filter(x => x.best)
      .sort((a, b) => b.best.score - a.best.score)

    // Assign positions with spacing constraint (from ball and other positions)
    for (const { t } of sorted) {
      const options = optionsByTeammate.get(t.id)!.sort((a, b) => b.score - a.score)
      const option =
        options.find(o => usedPositions.every(p => this.dist(o.position, p) >= minSpacing)) ||
        options[0]

      if (option) {
        selected.push(option)
        usedPositions.push(option.position)
      }
    }

    return selected.sort((a, b) => b.score - a.score)
  }

  /**
   * Find best pass target (highest scoring position)
   */
  static findBestPassTarget(options: PassOption[]): Vector2D | null {
    return options[0]?.position || null
  }
}
