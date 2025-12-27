/**
 * Shared TypeScript types for Kickoff
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

// Constants needed for derived calculations
const FIELD_WIDTH = 1700
const FIELD_HEIGHT = 1000
const GOAL_HEIGHT_RATIO = 0.3
const PLAYER_RADIUS = 50

export const GAME_CONFIG = {
  // Field dimensions
  FIELD_WIDTH,
  FIELD_HEIGHT,

  // Player and ball sizing (derived from PLAYER_RADIUS)
  PLAYER_RADIUS,
  BALL_RADIUS: Math.round(PLAYER_RADIUS * 0.4), 
  POSSESSION_BALL_OFFSET: PLAYER_RADIUS - Math.round(PLAYER_RADIUS * 0.4) / 2,
  CHALLENGE_RADIUS: PLAYER_RADIUS + Math.round(PLAYER_RADIUS * 0.4),

  // Player physics
  PLAYER_SPEED: Math.round(FIELD_HEIGHT * 0.35),

  // Ball physics
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 1440,

  // Goal bounds (derived from field dimensions)
  GOAL_Y_MIN: Math.round(FIELD_HEIGHT / 2 - (FIELD_HEIGHT * GOAL_HEIGHT_RATIO) / 2),
  GOAL_Y_MAX: Math.round(FIELD_HEIGHT / 2 + (FIELD_HEIGHT * GOAL_HEIGHT_RATIO) / 2),

  // Game timing
  MATCH_DURATION: 120,
} as const
