/**
 * TeamAI - Team-level coordination and strategy
 *
 * Manages high-level team strategy and role assignments for AI players
 * Owns and coordinates AIPlayer instances
 */

import { AIGameState, AIDecision } from './types'
import { Team } from '../../../shared/src/types'
import { AIPlayer } from './AIPlayer'
import { DefensiveStrategy } from './strategies/DefensiveStrategy'
import { OffensiveStrategy } from './strategies/OffensiveStrategy'

export class TeamAI {
  private teamId: Team
  private players: AIPlayer[]
  private lastPossessingTeam: Team | null // Track which team had ball last
  private defensiveStrategy: DefensiveStrategy
  private offensiveStrategy: OffensiveStrategy
  private onReceivePassCallback?: (playerId: string) => void

  constructor(teamId: Team, playerIds: string[], onReceivePass?: (playerId: string) => void) {
    this.teamId = teamId
    this.players = playerIds.map(id => new AIPlayer(id))
    this.lastPossessingTeam = null
    this.defensiveStrategy = new DefensiveStrategy(teamId)
    this.offensiveStrategy = new OffensiveStrategy(teamId)
    this.onReceivePassCallback = onReceivePass
  }

  public update(gameState: AIGameState): Map<string, AIDecision> {
    const allPlayers = [...gameState.bluePlayers, ...gameState.redPlayers]
    const holderPlayer = gameState.ball.possessedBy
      ? allPlayers.find(p => p.id === gameState.ball.possessedBy)
      : null

    // Track possession for strategy switching
    if (holderPlayer) {
      this.lastPossessingTeam = holderPlayer.team
    }

    // Determine strategy and execute
    let roles
    if (this.lastPossessingTeam !== this.teamId) {
      // Opponent has/had the ball - defensive play
      roles = this.defensiveStrategy.execute(gameState)
    } else {
      // Our team has the ball - offensive play
      roles = this.offensiveStrategy.execute(gameState)
    }

    // Apply roles to AIPlayers
    roles.forEach((role, playerId) => {
      const aiPlayer = this.players.find(p => p.getPlayerId() === playerId)
      if (aiPlayer) {
        aiPlayer.setGoal(role.goal, role.target, role.shootPower)

        // Trigger control handover when AI sets receive-pass goal
        if (role.goal === 'receive-pass' && this.onReceivePassCallback) {
          this.onReceivePassCallback(playerId)
        }
      }
    })

    // Execute decisions for all players
    const decisions = new Map<string, AIDecision>()
    this.players.forEach(player => {
      const playerId = player.getPlayerId()
      const decision = player.update(gameState)
      decisions.set(playerId, decision)
    })

    return decisions
  }

  public getPlayer(playerId: string): AIPlayer | undefined {
    return this.players.find(p => p.getPlayerId() === playerId)
  }
}
