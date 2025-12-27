/**
 * Type definitions for game state abstractions
 */

import type { GameEngineState } from '../engine/types.js'

/**
 * Unified game state type used across all game modes
 *
 * This is the standard type for client-side game state access across
 * different game modes (single-player, multiplayer, AI-only).
 *
 * **Type Alias**: This is an alias of `GameEngineState` to provide a stable
 * public API name for game scenes. While functionally identical, using
 * `UnifiedGameState` in public APIs ensures that client code won't break if
 * internal engine implementation details change.
 *
 * **Use this type for:**
 * - BaseGameScene.getGameState() return type
 * - Client-side game state representations
 * - Cross-mode compatible game logic
 *
 * **Structure:**
 * ```typescript
 * {
 *   players: Map<string, EnginePlayerData>
 *   ball: EngineBallData
 *   scoreBlue: number
 *   scoreRed: number
 *   matchTime: number
 *   phase: GamePhase
 * }
 * ```
 *
 * **Different from:**
 * - `ColyseusGameState` (client/network/NetworkManager.ts): Network-specific state
 *   representation for Colyseus WebSocket synchronization. Uses ColyseusMapSchema
 *   and Colyseus schema types instead of plain Map and engine types.
 * - `GameStateData` (client/network/NetworkManager.ts): Legacy network state
 *   representation with RemotePlayer type.
 */
export type UnifiedGameState = GameEngineState
