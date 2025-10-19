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

  // Shooting power (null = no shoot, 0.0 = min power, 1.0 = max power)
  shootPower: number | null // 0.0 to 1.0, or null for no shoot
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
  shootPower?: number | null // 0.0 to 1.0 (shooting power), or null/undefined for no shoot
}

/**
 * Vector2D type (position in 2D space)
 */
export interface Vector2D {
  x: number
  y: number
}

/**
 * Action score returned by scorers
 */
export interface ActionScore {
  action: 'shoot' | 'dribble' | 'pass' | 'move'
  score: number // 0-1, higher is better
  target: Vector2D // Where to aim/move
  reasoning: string // Debug info
  metadata?: Record<string, any> // Action-specific data
}

/**
 * Context provided to action scorers
 */
export interface ActionContext {
  // The player making the decision
  me: PlayerData

  // Ball carrier (if someone has possession)
  carrier?: PlayerData

  // Opponent ball carrier (if opponent has possession)
  opponentCarrier?: PlayerData

  // My teammates (excluding me)
  teammates: PlayerData[]

  // Opponent players
  opponents: PlayerData[]

  // Ball state
  ball: BallData

  // Goal positions
  opponentGoal: Vector2D
  ownGoal: Vector2D

  // Match state
  matchTime: number
  scoreBlue: number
  scoreRed: number

  // Additional metadata
  metadata?: Record<string, any>
}
