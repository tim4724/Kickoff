/**
 * AI Types and Interfaces
 *
 * Defines the structure for AI decision-making and state management
 */

import { PlayerData, BallData } from '../../../shared/src/types'

/**
 * Available game information for AI decision-making
 */
export interface AIGameState {
  // Players separated by team
  bluePlayers: PlayerData[]
  redPlayers: PlayerData[]

  // Ball state
  ball: BallData

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

/**
 * Vector2D type (position in 2D space)
 */
export interface Vector2D {
  x: number
  y: number
}
