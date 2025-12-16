/**
 * State Adapter
 *
 * Provides a unified interface for accessing game state from different sources.
 * Normalizes state structures between GameEngine (SinglePlayer/AIOnly) and
 * NetworkManager (Multiplayer) to eliminate duplication and simplify scene code.
 *
 * @example Basic usage
 * ```typescript
 * // In SinglePlayerScene
 * protected getUnifiedState() {
 *   return StateAdapter.fromGameEngine(this.gameEngine.getState())
 * }
 *
 * // In GameScene
 * protected getUnifiedState() {
 *   const state = this.networkManager?.getState()
 *   return state ? StateAdapter.fromNetwork(state) : null
 * }
 *
 * // Common usage in BaseGameScene
 * const unified = this.getUnifiedState()
 * const myTeam = StateAdapter.getPlayerTeam(unified, this.myPlayerId)
 * const teammates = StateAdapter.getTeammateIds(unified, this.myPlayerId)
 * ```
 *
 * @module StateAdapter
 */

import type { EnginePlayerData, GameEngineState } from '@shared/engine/types'
import { GeometryUtils } from '@shared/utils/geometry'
import type { GameStateData, Team } from '@shared/types'

/**
 * Unified player interface with normalized position/velocity access
 */
export interface UnifiedPlayerData {
  id: string
  team: Team
  isHuman: boolean
  isControlled: boolean
  x: number
  y: number
  velocityX: number
  velocityY: number
  state: 'idle' | 'running' | 'kicking'
  direction: number
  role?: 'defender' | 'forward'
}

/**
 * Unified ball interface with normalized position/velocity access
 */
export interface UnifiedBallData {
  x: number
  y: number
  velocityX: number
  velocityY: number
  possessedBy: string
  pressureLevel?: number
}

/**
 * Unified game state interface
 */
export interface UnifiedGameState {
  players: Map<string, UnifiedPlayerData>
  ball: UnifiedBallData
  scoreBlue: number
  scoreRed: number
  matchTime: number
  phase: 'waiting' | 'kickoff' | 'playing' | 'goal' | 'ended'
}

/**
 * State Adapter - converts any game state to unified format
 */
export class StateAdapter {
  /**
   * Convert GameEngine state (SinglePlayer/AIOnly) to unified format
   */
  static fromGameEngine(state: GameEngineState): UnifiedGameState {
    // Players are already in flat format, just copy them
    const unifiedPlayers = new Map<string, UnifiedPlayerData>()
    state.players.forEach((player: EnginePlayerData, id: string) => {
      unifiedPlayers.set(id, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        state: player.state,
        direction: player.direction,
        role: player.role,
      })
    })

    return {
      players: unifiedPlayers,
      ball: {
        x: state.ball.x,
        y: state.ball.y,
        velocityX: state.ball.velocityX,
        velocityY: state.ball.velocityY,
        possessedBy: state.ball.possessedBy,
        pressureLevel: state.ball.pressureLevel,
      },
      scoreBlue: state.scoreBlue,
      scoreRed: state.scoreRed,
      matchTime: state.matchTime,
      phase: state.phase,
    }
  }

  /**
   * Convert UnifiedGameState to GameStateData format (for AI)
   * This is the format expected by AIManager
   */
  static toGameStateData(state: UnifiedGameState): any {
    const playersMap = new Map()
    state.players.forEach((player: any, id: string) => {
      playersMap.set(id, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        position: { x: player.x, y: player.y },
        velocity: { x: player.velocityX, y: player.velocityY },
        state: player.state,
        direction: player.direction,
      })
    })

    return {
      players: playersMap,
      ball: {
        position: { x: state.ball.x, y: state.ball.y },
        velocity: { x: state.ball.velocityX, y: state.ball.velocityY },
        possessedBy: state.ball.possessedBy,
      },
      scoreBlue: state.scoreBlue,
      scoreRed: state.scoreRed,
      matchTime: state.matchTime,
      phase: state.phase,
    }
  }

  /**
   * Convert NetworkManager state (Multiplayer) to unified format
   */
  static fromNetwork(state: GameStateData): UnifiedGameState {
    // Players use nested position/velocity, need to flatten
    const unifiedPlayers = new Map<string, UnifiedPlayerData>()
    state.players.forEach((player, id) => {
      unifiedPlayers.set(id, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        x: player.position?.x ?? 0,
        y: player.position?.y ?? 0,
        velocityX: player.velocity?.x ?? 0,
        velocityY: player.velocity?.y ?? 0,
        state: player.state,
        direction: player.direction,
      })
    })

    return {
      players: unifiedPlayers,
      ball: {
        x: state.ball.position?.x ?? 0,
        y: state.ball.position?.y ?? 0,
        velocityX: state.ball.velocity?.x ?? 0,
        velocityY: state.ball.velocity?.y ?? 0,
        possessedBy: state.ball.possessedBy,
      },
      scoreBlue: state.scoreBlue,
      scoreRed: state.scoreRed,
      matchTime: state.matchTime,
      phase: state.phase,
    }
  }

  /**
   * Get player team by ID
   */
  static getPlayerTeam(state: UnifiedGameState, playerId: string): Team | null {
    const player = state.players.get(playerId)
    return player ? player.team : null
  }

  /**
   * Get all teammate IDs for a given player
   */
  static getTeammateIds(state: UnifiedGameState, myPlayerId: string): string[] {
    const myTeam = this.getPlayerTeam(state, myPlayerId)
    if (!myTeam) return []

    const teammates: string[] = []
    state.players.forEach((player, playerId) => {
      if (player.team === myTeam) {
        teammates.push(playerId)
      }
    })
    return teammates
  }

  /**
   * Find the teammate closest to the ball
   */
  static findBestInterceptor(
    state: UnifiedGameState,
    teammateIds: string[]
  ): string | null {
    if (teammateIds.length === 0) return null

    let bestPlayerId: string | null = null
    let bestDistance = Number.MAX_VALUE

    const ballX = state.ball.x
    const ballY = state.ball.y

    for (const playerId of teammateIds) {
      const player = state.players.get(playerId)
      if (!player) continue

      const distance = GeometryUtils.distanceSquared(
        { x: player.x, y: player.y },
        { x: ballX, y: ballY }
      )

      if (distance < bestDistance) {
        bestDistance = distance
        bestPlayerId = playerId
      }
    }

    return bestPlayerId
  }
}
