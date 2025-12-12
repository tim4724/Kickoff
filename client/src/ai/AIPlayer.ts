/**
 * AIPlayer - Individual player AI logic
 *
 * Handles decision-making for a single AI-controlled player
 */

import { AIGameState, AIDecision, PlayerGoal } from './types'
import { GeometryUtils } from '../../../shared/src/utils/geometry'

export class AIPlayer {
  private playerId: string
  private targetX: number | null = null
  private targetY: number | null = null
  private goal: PlayerGoal | null = null // For debug labeling only
  private shootPower: number | null = null // Shooting power (null = no shoot, 0.0-1.0 = power level)

  constructor(playerId: string) {
    this.playerId = playerId
  }

  public setGoal(goal: PlayerGoal, targetPosition?: { x: number; y: number }, shootPower?: number | null): void {
    this.goal = goal // Store for debug purposes
    if (targetPosition) {
      this.targetX = targetPosition.x
      this.targetY = targetPosition.y
    }
    this.shootPower = shootPower ?? null // Default to null if not provided
  }

  public getGoal(): PlayerGoal | null {
    return this.goal
  }

  public getTargetPosition(): { x: number; y: number } | null {
    if (this.targetX === null || this.targetY === null) {
      return null
    }
    return { x: this.targetX, y: this.targetY }
  }

  public update(gameState: AIGameState): AIDecision {
    const movement = this.calculateMovement(gameState)

    // For shooting/passing, only trigger action when facing the target
    let actualShootPower = this.shootPower
    if (this.shootPower !== null && this.targetX !== null && this.targetY !== null) {
      const isFacingTarget = this.isFacingTarget(gameState)
      if (!isFacingTarget) {
        // Not facing target yet, don't shoot - just rotate
        actualShootPower = null
      }
    }

    return {
      moveX: movement.x,
      moveY: movement.y,
      shootPower: actualShootPower,
    }
  }

  private calculateMovement(gameState: AIGameState): { x: number; y: number } {
    if (this.targetX === null || this.targetY === null) {
      return { x: 0, y: 0 }
    }

    const currentPos = this.getMyPosition(gameState)
    if (!currentPos) {
      return { x: 0, y: 0 }
    }

    const dx = this.targetX - currentPos.x
    const dy = this.targetY - currentPos.y
    const distance = GeometryUtils.distance(currentPos, { x: this.targetX, y: this.targetY })

    // For shooting/passing, always return direction even if close (to rotate player)
    if (this.shootPower !== null) {
      if (distance < 1) {
        return { x: 0, y: 0 }
      }
      return {
        x: dx / distance,
        y: dy / distance,
      }
    }

    // For movement goals, stop when close enough
    const ARRIVAL_THRESHOLD = 5
    if (distance < ARRIVAL_THRESHOLD) {
      return { x: 0, y: 0 }
    }

    return {
      x: dx / distance,
      y: dy / distance,
    }
  }

  public getPlayerId(): string {
    return this.playerId
  }

  private getMyPosition(gameState: AIGameState): { x: number; y: number } | null {
    const allPlayers = [...gameState.bluePlayers, ...gameState.redPlayers]
    const player = allPlayers.find(p => p.id === this.playerId)
    return player ? { x: player.position.x, y: player.position.y } : null
  }

  /**
   * Check if player is facing the target direction
   * @returns true if player's direction is close to target direction
   */
  private isFacingTarget(gameState: AIGameState): boolean {
    if (this.targetX === null || this.targetY === null) {
      return true // No target, always allow
    }

    // Get player data
    const allPlayers = [...gameState.bluePlayers, ...gameState.redPlayers]
    const player = allPlayers.find(p => p.id === this.playerId)
    if (!player) return true

    // Calculate target direction
    const dx = this.targetX - player.position.x
    const dy = this.targetY - player.position.y
    const targetDirection = Math.atan2(dy, dx)

    // Calculate angular difference
    let angleDiff = Math.abs(player.direction - targetDirection)

    // Normalize to 0-PI range (handle wrapping)
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff
    }

    // Allow shooting if within ~17 degrees (0.3 radians)
    const DIRECTION_THRESHOLD = 0.3
    return angleDiff < DIRECTION_THRESHOLD
  }
}
