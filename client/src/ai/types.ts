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
}

/**
 * AI decision output for player movement and actions
 */
export interface AIDecision {
  // Movement direction (-1 to 1 for x and y)
  moveX: number
  moveY: number

  // Shooting power (null = no shoot, 0.0-1.0 = power level)
  shootPower: number | null
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
  shootPower?: number | null // 0.0-1.0 shooting power, or null for no shoot
}

