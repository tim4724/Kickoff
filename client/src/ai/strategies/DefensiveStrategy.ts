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
import { PlayerData, GAME_CONFIG, Team } from '@shared/types'
import { InterceptionCalculator } from '../utils/InterceptionCalculator'
import { SpreadPositionStrategy } from './SpreadPositionStrategy'
import { PassEvaluator } from '../utils/PassEvaluator'
import { GeometryUtils } from '@shared/utils/geometry'

export class DefensiveStrategy {
  private readonly ourGoal: Vector2D
  private readonly opponentGoal: Vector2D
  private readonly targetBehindGoal: Vector2D
  private readonly teamId: Team

  constructor(teamId: Team) {
    this.teamId = teamId
    const ourGoalX = teamId === 'blue' ? 0 : GAME_CONFIG.FIELD_WIDTH
    const opponentGoalX = teamId === 'blue' ? GAME_CONFIG.FIELD_WIDTH : 0
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2
    this.ourGoal = { x: ourGoalX, y: goalY }
    this.opponentGoal = { x: opponentGoalX, y: goalY }
    
    // Target behind goal: x position offset by goal size/2 from goal line
    const goalSize = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const xOffset = goalSize / 2
    const targetX = teamId === 'blue' 
      ? -xOffset
      : GAME_CONFIG.FIELD_WIDTH + xOffset
    this.targetBehindGoal = { x: targetX, y: goalY }
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

    let ballInterceptor: PlayerData | null = null
    let ballInterceptPoint: Vector2D

    ballInterceptor = remainingOpponents.find(p => p.id === ball.possessedBy) || null
    if (ballInterceptor === null) {
      const result = this.selectBestChaser(
        [...remainingPlayers, ...remainingOpponents],
        ball.position,
        ball.velocity
      )
      ballInterceptor = result.interceptor
      ballInterceptPoint = result.interceptPoint
    } else {
      ballInterceptPoint = ballInterceptor.position
    }

    // Check if interceptor is on our team
    if (remainingPlayers.some(p => p.id === ballInterceptor.id)) {
      // We reach ball first - assign our player to get it
      roles.set(ballInterceptor.id, { goal: 'getBall', target: ballInterceptPoint })
      remainingPlayers = remainingPlayers.filter(p => p.id !== ballInterceptor.id)

      // Sort remaining players by distance to our goal (closest = most defensive)
      remainingPlayers.sort((a, b) =>
        GeometryUtils.distanceSquared(a.position, this.ourGoal) - GeometryUtils.distanceSquared(b.position, this.ourGoal))
      remainingOpponents.sort((a, b) =>
        GeometryUtils.distanceSquared(a.position, this.ourGoal) - GeometryUtils.distanceSquared(b.position, this.ourGoal))

      const defensive = remainingPlayers.slice(0,  Math.floor(remainingOpponents.length / 2))

      defensive.forEach((p, i) => {
        roles.set(p.id, this.getDefensivePassReceivePosition(remainingOpponents[i], this.ourGoal))
      })

      // Remove defensive players from remainingPlayers (only offensive players remain)
      remainingPlayers = remainingPlayers.slice(defensive.length)

      // Calculate pass options for offensive players
      const passOptions = PassEvaluator.evaluatePassOptions(
        ballInterceptPoint,
        remainingPlayers,
        remainingOpponents,
        this.opponentGoal
      )

      const spreadRoles = SpreadPositionStrategy.getSpreadPassReceivePositions(
        remainingPlayers,
        passOptions
      )
      spreadRoles.forEach((role, playerId) => roles.set(playerId, role))
    } else {
      // Opponent reaches ball first - assign our player to intercept them
      let predictPath: (t: number) => Vector2D = () => ball.position
      if (GeometryUtils.distanceSquared(ball.position, this.ourGoal) <= GeometryUtils.distanceSquared(ballInterceptor.position, this.ourGoal)) {
        predictPath = this.createOpponentPathPredictor(ballInterceptor)
      }
      const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
        remainingPlayers,
        predictPath,
        0
      )
      roles.set(interceptor.id, { goal: 'interceptOpponent', target: interceptPoint })
      remainingPlayers = remainingPlayers.filter(p => p.id !== interceptor.id)
      remainingOpponents = remainingOpponents.filter(o => o.id !== ballInterceptor.id)

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
    players: PlayerData[],
    ballPosition: Vector2D,
    ballVelocity: Vector2D,
  ): { interceptor: PlayerData; interceptPoint: Vector2D } {
    const ballSpeedSquared = ballVelocity.x ** 2 + ballVelocity.y ** 2
    const isBallMoving = ballSpeedSquared >= 1

    // Determine ball prediction function
    const predictBallPosition = isBallMoving
      ? (t: number) => InterceptionCalculator.simulateBallPosition(ballPosition, ballVelocity, t)
      : () => ballPosition

    // Find best interceptor among ALL players (ours + opponents)
    const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
      players,
      predictBallPosition,
      GAME_CONFIG.POSSESSION_RADIUS
    )

    return { interceptor, interceptPoint }
  }

  /**
   * Create opponent path predictor function
   * Predicts opponent's movement toward target behind our goal over time
   */
  private createOpponentPathPredictor(
    opponent: PlayerData
  ): (t: number) => Vector2D {
    // Use target behind goal instead of goal center for better defensive coverage
    // Direction from opponent toward target behind goal
    const dx = this.targetBehindGoal.x - opponent.position.x
    const dy = this.targetBehindGoal.y - opponent.position.y
    const dist = GeometryUtils.distance(opponent.position, this.targetBehindGoal)

    const direction = dist < 1 ? { x: 1, y: 0 } : { x: dx / dist, y: dy / dist }

    return (t: number) => InterceptionCalculator.predictPlayerBallPosition(opponent.position, direction, t)
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
    const dist = GeometryUtils.distance(opponent.position, ourGoal)

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
   * Positioning strategy:
   * - In defensive third (close to our goal): Mark tightly (intercept opponent)
   * - In other areas: Position between opponent, ball, and goal (zonal defense)
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

    // Calculate defensive third boundary (1/3 of field from our goal)
    const defensiveThirdBoundary = this.teamId === 'blue'
      ? GAME_CONFIG.FIELD_WIDTH / 3
      : (GAME_CONFIG.FIELD_WIDTH * 2) / 3

    // Sort opponents by distance to our goal (closest = most dangerous = highest priority)
    const sortedOpponents = [...opponentRemainingPlayers].sort((a, b) =>
      GeometryUtils.distanceSquared(a.position, ourGoal) - GeometryUtils.distanceSquared(b.position, ourGoal)
    )

    // For each opponent (in priority order), assign best defender
    for (const opponent of sortedOpponents) {
      // Get available players (not yet assigned)
      const availablePlayers = ownRemainingPlayers.filter(p => !assignedPlayers.has(p.id))

      if (availablePlayers.length === 0) break

      // Check if opponent is in defensive third
      const opponentInDefensiveThird = this.teamId === 'blue'
        ? opponent.position.x < defensiveThirdBoundary
        : opponent.position.x > defensiveThirdBoundary

      let markingTarget: Vector2D
      let assignedPlayer: PlayerData

      if (opponentInDefensiveThird) {
        // Close marking: Intercept opponent's path to goal
        const predictPath = this.createOpponentPathPredictor(opponent)

        const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
          availablePlayers,
          predictPath,
          0
        )

        assignedPlayer = interceptor
        markingTarget = interceptPoint
      } else {
        // Zonal marking: Position between opponent, ball, and goal
        markingTarget = this.getZonalMarkingPosition(opponent)

        // Assign closest available player
        assignedPlayer = availablePlayers[0]
        let closestDistSq = GeometryUtils.distanceSquared(assignedPlayer.position, markingTarget)

        for (const player of availablePlayers) {
          const distSq = GeometryUtils.distanceSquared(player.position, markingTarget)
          if (distSq < closestDistSq) {
            assignedPlayer = player
            closestDistSq = distSq
          }
        }
      }

      assignedPlayers.add(assignedPlayer.id)
      roles.set(assignedPlayer.id, { goal: 'markOpponent', target: markingTarget })
    }

    // Any unassigned players stay in defensive position
    for (const player of ownRemainingPlayers) {
      if (!assignedPlayers.has(player.id)) {
        roles.set(player.id, { goal: 'markOpponent', target: { x: player.position.x, y: player.position.y } })
      }
    }

    return roles
  }

  /**
   * Calculate zonal marking position between opponent and our goal
   * If ball is more dangerous (closer to goal), blend in ball coverage
   */
  private getZonalMarkingPosition(opponent: PlayerData): Vector2D {
    const target = this.targetBehindGoal
    // Base position: 60% from opponent toward target behind goal
    const baseX = opponent.position.x + (target.x - opponent.position.x) * 0.5
    const baseY = opponent.position.y + (target.y - opponent.position.y) * 0.5
    return { x: baseX, y: baseY }
  }
}
