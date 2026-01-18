/**
 * AI Types and Interfaces
 *
 * Defines the structure for AI decision-making and state management
 */

import { EnginePlayerData, EngineBallData } from '@shared/engine/types'
import { Point } from '@shared/utils/geometry'

// Re-export Point as Vector2D for semantic clarity in AI code
export type Vector2D = Point

/**
 * Available game information for AI decision-making
 */
export interface AIGameState {
  // Players separated by team
  bluePlayers: EnginePlayerData[]
  redPlayers: EnginePlayerData[]

  // Ball state
  ball: EngineBallData

  // Match time
  matchTime: number

  // Score (for critical event detection)
  scoreBlue: number
  scoreRed: number
}

/**
 * AI decision output for player movement and actions
 */
export interface AIDecision {
  // Movement direction (-1 to 1 for x and y)
  moveX: number
  moveY: number

  // Whether to shoot/pass
  shoot: boolean
}

/**
 * Player goal types (debug strings)
 */
export type PlayerGoal = string

/**
 * Player role assignment from strategy
 */
export interface PlayerRole {
  goal: PlayerGoal
  target: Vector2D
  shoot?: boolean // Whether to shoot when in position
}

/**
 * AI behavior constants
 * Centralized configuration for AI decision-making parameters
 */
export const AI_DEFAULTS = {
  /**
   * How long AI persists with current goal before recalculating (ms)
   * Lower = more responsive but higher CPU, Higher = smoother but less reactive
   * 200ms chosen as balance: ~5 recalcs/sec vs 60/sec (frame-by-frame)
   */
  GOAL_PERSIST_DURATION_MS: 200,

  /**
   * Maximum random delay at game start (ms)
   * Prevents deterministic kickoff advantage where one team always reacts first
   * 150ms range provides noticeable variation without feeling unresponsive
   */
  INITIAL_DELAY_MAX_MS: 150,
} as const

