/**
 * AI Controller
 * Handles autonomous bot behavior
 * Shared between client single-player and server multiplayer
 */

import type { EnginePlayerData, EngineBallData, EnginePlayerInput } from '../engine/types'
import type { Team } from '../types'

interface AIConfig {
  fieldWidth: number
  fieldHeight: number
  chaseDistance: number // Distance at which AI chases ball
  shootDistance: number // Distance at which AI attempts to shoot
  passDistance: number // Distance to consider passing
}

export class AIController {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  /**
   * Generate input for an AI player
   */
  generateAIInput(
    player: EnginePlayerData,
    ball: EngineBallData,
    allPlayers: Map<string, EnginePlayerData>
  ): EnginePlayerInput {
    // Default input (no movement, no action)
    const input: EnginePlayerInput = {
      movement: { x: 0, y: 0 },
      action: false,
      timestamp: Date.now(),
    }

    // Role-based behavior
    if (player.role === 'defender') {
      this.defenderBehavior(player, ball, input)
    } else {
      // Forward or no role specified
      this.forwardBehavior(player, ball, input)
    }

    // Shooting/passing logic (shared by all roles)
    if (ball.possessedBy === player.id) {
      this.shootingLogic(player, ball, allPlayers, input)
    }

    return input
  }

  /**
   * Defender behavior: Defensive positioning, chase ball when nearby
   */
  private defenderBehavior(player: EnginePlayerData, ball: EngineBallData, input: EnginePlayerInput): void {
    const dx = ball.x - player.x
    const dy = ball.y - player.y
    const distToBall = Math.sqrt(dx * dx + dy * dy)

    // Defensive home position (near own goal)
    const homeX =
      player.team === 'blue'
        ? this.config.fieldWidth * 0.19 // Left side
        : this.config.fieldWidth * 0.81 // Right side

    const homeY = player.y // Maintain vertical lane

    const dxHome = homeX - player.x
    const dyHome = homeY - player.y
    const distToHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome)

    // Decision: Chase ball if close, otherwise return to position
    if (distToBall < this.config.chaseDistance) {
      // Chase ball
      const length = Math.max(distToBall, 1)
      input.movement.x = dx / length
      input.movement.y = dy / length
    } else if (distToHome > 50) {
      // Return to defensive position
      const length = Math.max(distToHome, 1)
      input.movement.x = dxHome / length
      input.movement.y = dyHome / length
    }
  }

  /**
   * Forward behavior: Aggressive ball pursuit, press opponent goal
   */
  private forwardBehavior(player: EnginePlayerData, ball: EngineBallData, input: EnginePlayerInput): void {
    // Always chase the ball aggressively
    const dx = ball.x - player.x
    const dy = ball.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 10) {
      // Move toward ball
      input.movement.x = dx / dist
      input.movement.y = dy / dist
    }
  }

  /**
   * Shooting logic: Decide when to shoot vs pass
   */
  private shootingLogic(
    player: EnginePlayerData,
    ball: EngineBallData,
    allPlayers: Map<string, EnginePlayerData>,
    input: EnginePlayerInput
  ): void {
    // Determine opponent goal position
    const opponentGoalX =
      player.team === 'blue'
        ? this.config.fieldWidth // Right goal
        : 0 // Left goal

    const opponentGoalY = this.config.fieldHeight / 2

    // Calculate distance to opponent goal
    const dx = opponentGoalX - ball.x
    const dy = opponentGoalY - ball.y
    const distToGoal = Math.sqrt(dx * dx + dy * dy)

    // Face toward goal
    player.direction = Math.atan2(dy, dx)

    // Shoot if close enough to goal
    if (distToGoal < this.config.shootDistance) {
      input.action = true
      input.actionPower = 0.9 // High power shot
    } else if (distToGoal < this.config.passDistance) {
      // Consider passing or dribbling
      // For now, just move toward goal (dribble)
      // Future: Check for open teammates and pass
    }
  }

  /**
   * Update all AI-controlled players
   */
  updateAllAI(
    players: Map<string, EnginePlayerData>,
    ball: EngineBallData
  ): Map<string, EnginePlayerInput> {
    const aiInputs = new Map<string, EnginePlayerInput>()

    players.forEach((player) => {
      // Only generate input for AI players that are not being controlled by a human
      if (!player.isHuman && !player.isControlled) {
        const input = this.generateAIInput(player, ball, players)
        aiInputs.set(player.id, input)
      }
    })

    return aiInputs
  }
}
