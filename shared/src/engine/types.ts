/**
 * Game Engine Types
 * Core interfaces for the shared game engine
 */

import type { Team, PlayerState, GamePhase } from '../types'

export interface EnginePlayerData {
  id: string
  team: Team
  isHuman: boolean
  isControlled: boolean
  x: number
  y: number
  velocityX: number
  velocityY: number
  state: PlayerState
  direction: number
  role?: 'defender' | 'forward'

  // Server-side only fields (not synced)
  kickingUntil?: number
}

export interface EngineBallData {
  x: number
  y: number
  velocityX: number
  velocityY: number
  possessedBy: string
  pressureLevel: number

  // Server-side only fields
  lastShotTime?: number
  lastShooter?: string
  inGoal?: boolean
}

export interface GameEngineState {
  players: Map<string, EnginePlayerData>
  ball: EngineBallData
  scoreBlue: number
  scoreRed: number
  matchTime: number
  phase: GamePhase
}

export interface EnginePlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number
  timestamp: number
  playerId?: string
}

export interface PhysicsConfig {
  fieldWidth: number
  fieldHeight: number
  playerSpeed: number
  ballRadius: number
  ballFriction: number
  shootSpeed: number
  minShootSpeed: number
  challengeRadius: number
  goalYMin: number
  goalYMax: number
}

// Physics-only constants (not needed outside physics engine)
export const PHYSICS_DEFAULTS = {
  PRESSURE_BUILDUP_RATE: 2,
  PRESSURE_DECAY_RATE: 3,
  PRESSURE_RELEASE_THRESHOLD: 1.0,
  CAPTURE_LOCKOUT_MS: 300,
  LOSS_LOCKOUT_MS: 300,
} as const

export interface GoalEvent {
  team: Team
  time: number
}
