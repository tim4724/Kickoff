/**
 * Shared TypeScript types for Socca2
 * Used by both client and server
 */

export interface PlayerInput {
  movement: {
    x: number // -1 to 1
    y: number // -1 to 1
  }
  action: boolean // pass/shoot button state
  timestamp: number
}

export type Team = 'blue' | 'red'

export type PlayerState = 'idle' | 'running' | 'kicking'

export type GamePhase = 'waiting' | 'playing' | 'ended'

export interface Vector2D {
  x: number
  y: number
}

export interface PlayerData {
  id: string
  team: Team
  isHuman: boolean
  isControlled: boolean
  position: Vector2D
  velocity: Vector2D
  state: PlayerState
  direction: number // radians
}

export interface BallData {
  position: Vector2D
  velocity: Vector2D
  possessedBy: string // player ID or empty string
}

export interface GameStateData {
  matchTime: number // seconds elapsed
  scoreBlue: number
  scoreRed: number
  phase: GamePhase
  players: Map<string, PlayerData>
  ball: BallData
}

export const GAME_CONFIG = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PLAYER_SPEED: 200, // pixels per second
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 400,
  PASS_SPEED: 300,
  POSSESSION_RADIUS: 30,
  TICK_RATE: 30, // server updates per second
  MATCH_DURATION: 120, // seconds (2 minutes)
} as const
