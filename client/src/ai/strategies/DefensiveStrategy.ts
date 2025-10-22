/**
 * DefensiveStrategy - Team-level defensive coordination
 *
 * Used when:
 * 1. Ball is loose (no one has possession)
 * 2. Opponent has the ball
 *
 * Responsibilities:
 * - Select ONE best player to chase the ball or intercept opponent
 * - Assign secondary roles to remaining players (mark opponents or receive pass)
 * - Set goals for all players on the team
 */

import { Vector2D, AIGameState, PlayerRole } from '../types'
import { PlayerData, GAME_CONFIG, Team } from '../../../../shared/src/types'
import { InterceptionCalculator } from '../utils/InterceptionCalculator'
import { SpreadPositionStrategy } from './SpreadPositionStrategy'
import { PassEvaluator } from '../utils/PassEvaluator'

export class DefensiveStrategy {
  private readonly ourGoal: Vector2D
  private readonly teamId: Team

  constructor(teamId: Team) {
    this.teamId = teamId
    const ourGoalX = teamId === 'blue' ? 0 : GAME_CONFIG.FIELD_WIDTH
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2
    this.ourGoal = { x: ourGoalX, y: goalY }
  }

  /**
   * Execute defensive strategy
   * Selects primary player, assigns secondary roles, and returns role assignments
   *
   * @param gameState - Current game state
   * @returns Map of player ID to role assignment
   */
  execute(gameState: AIGameState): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()
    const ball = gameState.ball
    let remainingPlayers = this.teamId === 'blue' ? gameState.bluePlayers : gameState.redPlayers
    let remainingOpponents = this.teamId === 'blue' ? gameState.redPlayers : gameState.bluePlayers

    // Find who reaches ball first (our team or opponent team)
    let weReachFirstBallPosition: Vector2D | null = null

    const { interceptor, interceptPoint } = this.selectBestChaser(
      remainingPlayers,
      ball.position,
      ball.velocity,
      remainingOpponents
    )

    // Check if interceptor is on our team
    if (remainingPlayers.some(p => p.id === interceptor.id)) {
      // We reach ball first - assign our player to get it
      roles.set(interceptor.id, { goal: 'getBall', target: interceptPoint })
      remainingPlayers = remainingPlayers.filter(p => p.id !== interceptor.id)
      weReachFirstBallPosition = interceptPoint
    } else {
      // Opponent reaches ball first - assign our player to intercept them
      const result = this.selectBestInterceptor(remainingPlayers, interceptor, this.ourGoal)
      roles.set(result.interceptor.id, { goal: 'interceptOpponent', target: result.target })
      remainingPlayers = remainingPlayers.filter(p => p.id !== result.interceptor.id)
      remainingOpponents = remainingOpponents.filter(o => o.id !== interceptor.id)
    }

    if (weReachFirstBallPosition) {
      const sorted = [...remainingPlayers].sort((a, b) =>
        InterceptionCalculator.distance(a.position, this.ourGoal) - InterceptionCalculator.distance(b.position, this.ourGoal))
      const defCount = Math.floor(remainingOpponents.length / 2)
      const defensive = sorted.slice(0, defCount)
      const offensive = sorted.slice(defCount)
      const sortedOpp = [...remainingOpponents].sort((a, b) =>
        InterceptionCalculator.distance(a.position, this.ourGoal) - InterceptionCalculator.distance(b.position, this.ourGoal))

      defensive.forEach((p, i) => {
        roles.set(p.id, this.getDefensivePassReceivePosition(sortedOpp[i], this.ourGoal))
      })

      // Calculate opponent goal for pass evaluation
      const opponentGoal: Vector2D = {
        x: this.ourGoal.x === 0 ? GAME_CONFIG.FIELD_WIDTH : 0,
        y: GAME_CONFIG.FIELD_HEIGHT / 2,
      }

      // Calculate pass options for offensive players
      const passOptions = PassEvaluator.evaluatePassOptions(
        weReachFirstBallPosition,
        offensive,
        remainingOpponents,
        opponentGoal
      )

      const spreadRoles = SpreadPositionStrategy.getSpreadPassReceivePositions(
        offensive,
        weReachFirstBallPosition,
        remainingOpponents,
        this.ourGoal,
        passOptions
      )
      spreadRoles.forEach((role, playerId) => roles.set(playerId, role))
    } else {
      // Defensive marking: mark all opponents
      const markingRoles = this.getOpponentMarking(remainingPlayers, remainingOpponents, this.ourGoal)
      markingRoles.forEach((role, playerId) => roles.set(playerId, role))
    }

    return roles
  }

  /**
   * Select best player to chase loose ball
   * Returns the player (from any team) who can reach the ball first and the interception point
   */
  private selectBestChaser(
    myPlayers: PlayerData[],
    ballPosition: Vector2D,
    ballVelocity: Vector2D,
    opponents: PlayerData[]
  ): { interceptor: PlayerData; interceptPoint: Vector2D } {
    const ballSpeedSquared = ballVelocity.x ** 2 + ballVelocity.y ** 2
    const isBallMoving = ballSpeedSquared >= 1

    // Determine ball prediction function
    const predictBallPosition = isBallMoving
      ? (t: number) => InterceptionCalculator.simulateBallPosition(ballPosition, ballVelocity, t)
      : () => ballPosition

    // Find best interceptor among ALL players (ours + opponents)
    const allPlayers = [...myPlayers, ...opponents]
    const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
      allPlayers,
      predictBallPosition,
      ballPosition
    )

    return { interceptor, interceptPoint }
  }

  /**
   * Create opponent path predictor function
   * Predicts opponent's movement toward our goal over time
   */
  private createOpponentPathPredictor(
    opponent: PlayerData,
    ourGoal: Vector2D
  ): (t: number) => Vector2D {
    // Direction from opponent toward our goal
    const dx = ourGoal.x - opponent.position.x
    const dy = ourGoal.y - opponent.position.y
    const dist = Math.sqrt(dx ** 2 + dy ** 2)

    const direction = dist < 1 ? { x: 1, y: 0 } : { x: dx / dist, y: dy / dist }

    return (t: number) => InterceptionCalculator.predictOpponentBallPosition(opponent.position, direction, t)
  }

  /**
   * Select best player to intercept opponent with ball
   * Returns the player who can intercept the opponent's path to goal
   */
  private selectBestInterceptor(
    myPlayers: PlayerData[],
    opponent: PlayerData,
    ourGoal: Vector2D
  ): { interceptor: PlayerData; target: Vector2D } {
    const predictPath = this.createOpponentPathPredictor(opponent, ourGoal)
    const currentBallPos = predictPath(0)

    // Calculate interception using InterceptionCalculator
    const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
      myPlayers,
      predictPath,
      currentBallPos
    )

    return { interceptor, target: interceptPoint }
  }

  /**
   * Get defensive pass receive position - stay behind specific opponent but at passing distance
   * Position between opponent and our goal, deeper than opponent, offset laterally for passing angle
   */
  private getDefensivePassReceivePosition(
    opponent: PlayerData,
    ourGoal: Vector2D
  ): PlayerRole {
    const DEFENSIVE_DEPTH = 200 // How far behind opponent toward our goal
    const LATERAL_OFFSET = 100 // Lateral offset for passing angle

    // Direction from opponent toward our goal
    const dx = ourGoal.x - opponent.position.x
    const dy = ourGoal.y - opponent.position.y
    const dist = Math.sqrt(dx ** 2 + dy ** 2)

    if (dist < 1) {
      // Opponent is at our goal, stay nearby
      return { goal: 'receivePass-defensive', target: ourGoal }
    }

    const dirX = dx / dist
    const dirY = dy / dist

    // Position behind opponent (toward our goal), deep enough to defend
    const baseX = opponent.position.x + dirX * DEFENSIVE_DEPTH
    const baseY = opponent.position.y + dirY * DEFENSIVE_DEPTH

    // Add lateral offset based on opponent's Y position
    // If opponent is in upper half (y < center), offset down (south)
    // If opponent is in lower half (y > center), offset up (north)
    const fieldCenter = GAME_CONFIG.FIELD_HEIGHT / 2
    const lateralDirection = opponent.position.y < fieldCenter ? 1 : -1

    const targetX = baseX
    const targetY = baseY + LATERAL_OFFSET * lateralDirection

    // Clamp to field bounds
    const clampedY = Math.max(0, Math.min(GAME_CONFIG.FIELD_HEIGHT, targetY))

    return { goal: 'receivePass-defensive', target: { x: targetX, y: clampedY } }
  }

  /**
   * Get one-to-one opponent marking assignments
   * Prioritizes opponents by distance to goal (most dangerous first)
   * Then assigns best interceptor to each opponent
   */
  private getOpponentMarking(
    ownRemainingPlayers: PlayerData[],
    opponentRemainingPlayers: PlayerData[],
    ourGoal: Vector2D
  ): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()

    if (opponentRemainingPlayers.length === 0) return roles

    // Track which players have been assigned
    const assignedPlayers = new Set<string>()

    // Sort opponents by distance to our goal (closest = most dangerous = highest priority)
    const sortedOpponents = [...opponentRemainingPlayers].sort((a, b) => {
      const aDist = InterceptionCalculator.distance(a.position, ourGoal)
      const bDist = InterceptionCalculator.distance(b.position, ourGoal)
      return aDist - bDist
    })

    // For each opponent (in priority order), assign best interceptor
    for (const opponent of sortedOpponents) {
      // Get available players (not yet assigned)
      const availablePlayers = ownRemainingPlayers.filter(p => !assignedPlayers.has(p.id))

      if (availablePlayers.length === 0) break

      // Find best interceptor for this opponent
      const predictPath = this.createOpponentPathPredictor(opponent, ourGoal)
      const currentPos = predictPath(0)

      const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
        availablePlayers,
        predictPath,
        currentPos
      )

      assignedPlayers.add(interceptor.id)
      roles.set(interceptor.id, { goal: 'markOpponent', target: interceptPoint })
    }

    // Any unassigned players stay in defensive position
    for (const player of ownRemainingPlayers) {
      if (!assignedPlayers.has(player.id)) {
        roles.set(player.id, { goal: 'markOpponent', target: { x: player.position.x, y: player.position.y } })
      }
    }

    return roles
  }
}
