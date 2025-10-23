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
import { GAME_CONFIG, Team } from '../../../../shared/src/types'
import { HasBallStrategy } from './HasBallStrategy'
import { InterceptionCalculator } from '../utils/InterceptionCalculator'
import { SpreadPositionStrategy } from './SpreadPositionStrategy'
import { PassEvaluator, PassOption } from '../utils/PassEvaluator'

export class OffensiveStrategy {
  private readonly opponentGoal: Vector2D
  private readonly teamId: Team

  constructor(teamId: Team) {
    this.teamId = teamId
    const opponentGoalX = teamId === 'blue' ? GAME_CONFIG.FIELD_WIDTH : 0
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2
    this.opponentGoal = { x: opponentGoalX, y: goalY }
  }

  /**
   * Execute offensive strategy
   *
   * Flow:
   * 1. Calculate pass options once (shared by ball carrier and off-ball players)
   * 2. Assign ball carrier or interceptor role
   * 3. Remove assigned player from myPlayers
   * 4. Spread position remaining players using pre-calculated pass options
   *
   * @param gameState - Current game state
   * @returns Map of player ID to role assignment
   */
  execute(gameState: AIGameState): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()

    // Get team-specific players (mutable - we'll remove assigned players)
    let myPlayers = this.teamId === 'blue' ? gameState.bluePlayers : gameState.redPlayers
    const opponents = this.teamId === 'blue' ? gameState.redPlayers : gameState.bluePlayers
    const ball = gameState.ball

    let passOptions: PassOption[] = []

    // Step 1: Assign ball carrier or interceptor role
    const ballCarrier = ball.possessedBy
      ? myPlayers.find(p => p.id === ball.possessedBy)
      : null

    if (ballCarrier) {
      // We have possession - ball carrier decides action
      const teammates = myPlayers.filter(p => p.id !== ballCarrier.id)

      // Calculate pass options once for both ball carrier and off-ball positioning
      passOptions = PassEvaluator.evaluatePassOptions(
        ball.position,
        teammates,
        opponents,
        this.opponentGoal
      )

      const carrierRole = HasBallStrategy.decideBallCarrierAction(
        ballCarrier,
        teammates,
        opponents,
        this.opponentGoal,
        passOptions
      )

      roles.set(ballCarrier.id, carrierRole)

      // Remove ball carrier from myPlayers
      myPlayers = teammates
    } else {
      // Ball is loose - find best interceptor
      const predictBallPosition = (t: number): Vector2D => {
        return InterceptionCalculator.simulateBallPosition(ball.position, ball.velocity, t)
      }

      const { interceptor, interceptPoint } = InterceptionCalculator.calculateInterception(
        myPlayers,
        predictBallPosition,
        ball.position
      )

      roles.set(interceptor.id, { goal: 'receive-pass', target: interceptPoint })

      // Remove interceptor from myPlayers
      myPlayers = myPlayers.filter(p => p.id !== interceptor.id)
    }

    // Step 2: Spread position remaining players using pre-calculated pass options
    if (myPlayers.length > 0) {
      const spreadRoles = SpreadPositionStrategy.getSpreadPassReceivePositions(
        myPlayers,
        passOptions
      )

      spreadRoles.forEach((role, playerId) => roles.set(playerId, role))
    }

    return roles
  }
}
