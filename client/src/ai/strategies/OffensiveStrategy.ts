/**
 * OffensiveStrategy - Team-level offensive coordination
 *
 * Used when our team has possession of the ball.
 *
 * Responsibilities:
 * - Ball carrier decision-making (shoot, pass, or dribble)
 * - Off-ball player positioning (support runs, attacking runs)
 * - Creating passing triangles and space
 * - Coordinating attacks toward opponent goal
 */

import { Vector2D, AIGameState, PlayerRole } from '../types'
import { GAME_CONFIG, Team } from '@shared/types'
import { HasBallStrategy } from './HasBallStrategy'
import { InterceptionCalculator } from '../utils/InterceptionCalculator'
import { SpreadPositionStrategy } from './SpreadPositionStrategy'
import { PassEvaluator, PassOption } from '../utils/PassEvaluator'

export class OffensiveStrategy {
  private readonly opponentGoal: Vector2D
  private readonly targetBehindGoal: Vector2D
  private readonly teamId: Team

  constructor(teamId: Team) {
    this.teamId = teamId
    const opponentGoalX = teamId === 'blue' ? GAME_CONFIG.FIELD_WIDTH : 0
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2
    this.opponentGoal = { x: opponentGoalX, y: goalY }
    
    // Target behind opponent goal: x position offset by goal size/2 from goal line
    const goalSize = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const xOffset = goalSize / 2
    const targetX = teamId === 'blue' 
      ? GAME_CONFIG.FIELD_WIDTH + xOffset
      : -xOffset
    this.targetBehindGoal = { x: targetX, y: goalY }
  }

  /**
   * Execute offensive strategy
   *
   * @param gameState - Current game state
   * @returns Map of player ID to role assignment
   */
  execute(gameState: AIGameState): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()

    // Get team-specific players (mutable - we'll remove assigned players)
    let remainingPlayers = this.teamId === 'blue' ? gameState.bluePlayers : gameState.redPlayers
    const opponents = this.teamId === 'blue' ? gameState.redPlayers : gameState.bluePlayers
    const ball = gameState.ball

    let passOptions: PassOption[] = []

    // Step 1: Assign ball carrier or interceptor role
    const ballCarrier = ball.possessedBy
      ? remainingPlayers.find(p => p.id === ball.possessedBy)
      : null

    if (ballCarrier) {
      // We have possession - ball carrier decides action
      remainingPlayers = remainingPlayers.filter(p => p.id !== ballCarrier.id)

      // Calculate pass options once for both ball carrier and off-ball positioning
      passOptions = PassEvaluator.evaluatePassOptions(
        ball,
        remainingPlayers,
        opponents,
        this.opponentGoal
      )

      const carrierRole = HasBallStrategy.decideBallCarrierAction(
        ballCarrier,
        opponents,
        this.opponentGoal,
        this.targetBehindGoal,
        passOptions
      )

      roles.set(ballCarrier.id, carrierRole)
    } else {
      // Ball is loose - find best interceptor
      const predictBallPosition = (t: number): Vector2D => {
        return InterceptionCalculator.simulateBallPosition(ball, ball.velocityX, ball.velocityY, t)
      }

      const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
        remainingPlayers,
        predictBallPosition,
        GAME_CONFIG.CHALLENGE_RADIUS
      )

      roles.set(interceptor.id, { goal: 'receive-pass', target: interceptPoint })

      // Remove interceptor from myPlayers
      remainingPlayers = remainingPlayers.filter(p => p.id !== interceptor.id)

      // Calculate pass options from intercept position so teammates can move proactively
      // This makes off-ball players position themselves for passes before ball is received
      passOptions = PassEvaluator.evaluatePassOptions(
        interceptPoint,
        remainingPlayers,
        opponents,
        this.opponentGoal
      )
    }

    // Step 2: Spread position remaining players using pre-calculated pass options
    if (remainingPlayers.length > 0) {
      const spreadRoles = SpreadPositionStrategy.getSpreadPassReceivePositions(
        remainingPlayers,
        passOptions
      )

      spreadRoles.forEach((role, playerId) => roles.set(playerId, role))
    }

    return roles
  }
}
