/**
 * Type definitions for game state abstractions
 */

import type { EnginePlayerData, EngineBallData } from '../engine/types.js'
import type { GamePhase } from '../types.js'

/**
 * Unified game state interface used across all game modes
 *
 * This is the standard interface for client-side game state access across
 * different game modes (single-player, multiplayer, AI-only).
 *
 * **Use this interface for:**
 * - BaseGameScene.getGameState() return type
 * - Client-side game state representations
 * - Cross-mode compatible game logic
 *
 * **Different from:**
 * - `GameEngineState` (shared/engine/types.ts): Identical structure but used
 *   internally by the game engine. UnifiedGameState is the public-facing version.
 * - `GameStateData` (client/network/NetworkManager.ts): Network-specific state
 *   representation used for multiplayer synchronization. Uses RemotePlayer instead
 *   of EnginePlayerData and has a different ball structure for network transfer.
 *
 * **Why separate from GameEngineState?**
 * While structurally identical, UnifiedGameState serves as a stable public API
 * that won't change if internal engine implementation changes. It provides a
 * contract between game scenes and game state providers.
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
