/**
 * AIManager - Coordinates all AI instances
 *
 * Main interface for the game scene to interact with the AI system.
 * Manages TeamAI instances which in turn manage their AIPlayer instances.
 */

import { TeamAI } from './TeamAI'
import { AIGameState, AIDecision } from './types'
import { Team } from '@shared/types'
import { GameEngineState } from '@shared/engine/types'

export class AIManager {
  private teamAIs: Map<Team, TeamAI>
  private enabled: boolean
  private applyDecisionCallback?: (playerId: string, decision: AIDecision) => void

  constructor() {
    this.teamAIs = new Map()
    this.enabled = false
  }

  /**
   * Initialize AI for specific players
   *
   * @param bluePlayerIds - Array of player IDs for blue team that should be AI-controlled
   * @param redPlayerIds - Array of player IDs for red team that should be AI-controlled
   * @param applyDecisionCallback - Callback to apply AI decisions (optional)
   */
  public initialize(
    bluePlayerIds: string[],
    redPlayerIds: string[],
    applyDecisionCallback?: (playerId: string, decision: AIDecision) => void
  ): void {
    this.cleanup()
    this.applyDecisionCallback = applyDecisionCallback

    if (bluePlayerIds.length > 0) {
      this.teamAIs.set('blue', new TeamAI('blue', bluePlayerIds))
    }
    if (redPlayerIds.length > 0) {
      this.teamAIs.set('red', new TeamAI('red', redPlayerIds))
    }

    this.enabled = true
  }

  /**
   * Update all AI instances
   * Should be called each frame with the current game state
   *
   * @param gameState - Current Game Engine state
   */
  public update(gameState: GameEngineState): void {
    if (!this.enabled) return

    const aiGameState = this.convertGameState(gameState)

    this.teamAIs.forEach(teamAI => {
      const teamDecisions = teamAI.update(aiGameState)
      teamDecisions.forEach((decision, playerId) => {
        this.applyDecision(playerId, decision)
      })
    })
  }

  /**
   * Enable or disable all AI
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Get a TeamAI instance by team
   */
  public getTeamAI(team: Team): TeamAI | undefined {
    return this.teamAIs.get(team)
  }

  /**
   * Clean up all AI instances
   */
  public cleanup(): void {
    this.teamAIs.clear()
    this.enabled = false
  }

  /**
   * Convert GameEngineState to AIGameState format
   */
  private convertGameState(gameState: GameEngineState): AIGameState {
    const allPlayers = Array.from(gameState.players.values())
    return {
      bluePlayers: allPlayers.filter(p => p.team === 'blue'),
      redPlayers: allPlayers.filter(p => p.team === 'red'),
      ball: gameState.ball,
      matchTime: gameState.matchTime,
    }
  }

  /**
   * Apply AI decision to game controls via callback
   */
  private applyDecision(playerId: string, decision: AIDecision): void {
    if (this.applyDecisionCallback) {
      this.applyDecisionCallback(playerId, decision)
    }
  }
}
