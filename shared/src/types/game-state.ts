/**
 * Type definitions for game state abstractions
 */

import type { EnginePlayerData, EngineBallData } from '../engine/types.js'
import type { GamePhase } from '../types.js'

/**
 * Unified game state interface used across all game modes
 * This is the abstract interface returned by getGameState()
 */
export interface UnifiedGameState {
  /** Map of player ID to player data */
  players: Map<string, EnginePlayerData>

  /** Ball state */
  ball: EngineBallData

  /** Blue team score */
  scoreBlue: number

  /** Red team score */
  scoreRed: number

  /** Remaining match time in seconds */
  matchTime: number

  /** Current game phase */
  phase: GamePhase
}
