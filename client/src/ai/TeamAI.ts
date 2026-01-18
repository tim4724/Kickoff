/**
 * TeamAI - Team-level coordination and strategy
 *
 * Manages high-level team strategy and role assignments for AI players
 * Owns and coordinates AIPlayer instances
 */

import { AIGameState, AIDecision, PlayerRole, AI_DEFAULTS } from './types'
import { Team } from '@shared/types'
import { AIPlayer } from './AIPlayer'
import { DefensiveStrategy } from './strategies/DefensiveStrategy'
import { OffensiveStrategy } from './strategies/OffensiveStrategy'
import { gameClock } from '@shared/engine/GameClock'

export class TeamAI {
  private teamId: Team
  private players: AIPlayer[]
  private lastPossessingTeam: Team | null // Track which team had ball last
  private defensiveStrategy: DefensiveStrategy
  private offensiveStrategy: OffensiveStrategy

  // Goal persistence state
  private cachedRoles: Map<string, PlayerRole> | null = null
  private goalPersistUntil: number = 0
  private lastGameStateSnapshot: {
    ballPossessor: string
    scoreBlue: number
    scoreRed: number
  } | null = null

  // Random initial delay to prevent deterministic kickoff advantage
  private initialDelayMs: number
  private hasStarted: boolean = false

  constructor(teamId: Team, playerIds: string[]) {
    this.teamId = teamId
    this.players = playerIds.map(id => new AIPlayer(id))
    this.lastPossessingTeam = null
    this.defensiveStrategy = new DefensiveStrategy(teamId)
    this.offensiveStrategy = new OffensiveStrategy(teamId)

    // Random initial delay to vary reaction times at kickoff
    this.initialDelayMs = Math.random() * AI_DEFAULTS.INITIAL_DELAY_MAX_MS
  }

  public update(gameState: AIGameState): Map<string, AIDecision> {
    const currentTime = gameClock.now()

    // Apply initial delay to prevent deterministic kickoff advantage
    if (!this.hasStarted && currentTime < this.initialDelayMs) {
      // Return neutral decisions (no movement) during initial delay
      const neutralDecisions = new Map<string, AIDecision>()
      this.players.forEach(player => {
        neutralDecisions.set(player.getPlayerId(), { moveX: 0, moveY: 0, shoot: false })
      })
      return neutralDecisions
    }
    this.hasStarted = true

    // Check for critical events that force immediate re-evaluation
    const criticalEventOccurred = this.detectCriticalEvent(gameState)

    // Determine if we should recalculate roles
    const shouldRecalculate =
      this.cachedRoles === null ||           // No cache yet
      criticalEventOccurred ||                // Critical event detected
      currentTime >= this.goalPersistUntil   // Timer expired

    if (shouldRecalculate) {
      // Recalculate strategy and roles
      const roles = this.calculateRoles(gameState)

      // Cache the new roles
      this.cachedRoles = roles

      // Set timer for next recalculation
      this.goalPersistUntil = currentTime + AI_DEFAULTS.GOAL_PERSIST_DURATION_MS

      // Update snapshot for critical event detection
      this.updateGameStateSnapshot(gameState)
    }

    // Apply cached roles to AIPlayers (guaranteed to exist after shouldRecalculate logic)
    if (this.cachedRoles) {
      this.cachedRoles.forEach((role, playerId) => {
        const aiPlayer = this.players.find(p => p.getPlayerId() === playerId)
        if (aiPlayer) {
          aiPlayer.setGoal(role.goal, role.target, role.shoot)
        }
      })
    }

    // Execute decisions for all players (movement calculated every frame)
    const decisions = new Map<string, AIDecision>()
    this.players.forEach(player => {
      const playerId = player.getPlayerId()
      const decision = player.update(gameState)
      decisions.set(playerId, decision)
    })

    return decisions
  }

  /**
   * Calculate role assignments based on current game state
   * Extracted from original update() logic
   */
  private calculateRoles(gameState: AIGameState): Map<string, PlayerRole> {
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

    return roles
  }

  /**
   * Detect critical game events that should force immediate goal re-evaluation
   * Critical events:
   * 1. Ball possession changed (player gained/lost ball)
   * 2. Goal scored (score changed)
   */
  private detectCriticalEvent(gameState: AIGameState): boolean {
    // No snapshot yet - not a critical event, just first run
    if (this.lastGameStateSnapshot === null) {
      return false
    }

    const snapshot = this.lastGameStateSnapshot

    // Check 1: Ball possession changed
    const currentPossessor = gameState.ball.possessedBy
    if (currentPossessor !== snapshot.ballPossessor) {
      return true
    }

    // Check 2: Score changed (goal was scored)
    if (gameState.scoreBlue !== snapshot.scoreBlue ||
        gameState.scoreRed !== snapshot.scoreRed) {
      return true
    }

    return false
  }

  /**
   * Update the game state snapshot for critical event detection
   */
  private updateGameStateSnapshot(gameState: AIGameState): void {
    this.lastGameStateSnapshot = {
      ballPossessor: gameState.ball.possessedBy,
      scoreBlue: gameState.scoreBlue,
      scoreRed: gameState.scoreRed,
    }
  }

  public getPlayer(playerId: string): AIPlayer | undefined {
    return this.players.find(p => p.getPlayerId() === playerId)
  }

  /**
   * Get all player IDs managed by this TeamAI (for testing/debugging)
   */
  public getPlayerIds(): string[] {
    return this.players.map(p => p.getPlayerId())
  }

  /**
   * Clear cached state for clean game reset
   * Call this when the game restarts to prevent stale decision data
   */
  public cleanup(): void {
    this.cachedRoles = null
    this.goalPersistUntil = 0
    this.lastGameStateSnapshot = null
    this.lastPossessingTeam = null
    this.hasStarted = false
    this.initialDelayMs = Math.random() * AI_DEFAULTS.INITIAL_DELAY_MAX_MS
  }
}
