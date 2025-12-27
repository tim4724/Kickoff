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

// Base field dimensions
const FIELD_WIDTH = 1700
const FIELD_HEIGHT = 1000

// Goal configuration
const GOAL_HEIGHT_RATIO = 0.25 // Goal spans 25% of field height

// Player and ball sizing (derived from possession mechanics)
const POSSESSION_BALL_OFFSET = 25 // distance ball is positioned in front of player
const PLAYER_RADIUS = Math.round(POSSESSION_BALL_OFFSET * 1.4) // ~35px, player visual radius
const BALL_RADIUS = Math.round(PLAYER_RADIUS * 0.4) // ~14px, ball visual radius

export const GAME_CONFIG = {
  // Field dimensions
  FIELD_WIDTH,
  FIELD_HEIGHT,

  // Player physics
  PLAYER_SPEED: 284, // pixels per second
  PLAYER_RADIUS, // derived from POSSESSION_BALL_OFFSET

  // Ball physics
  BALL_RADIUS, // derived from PLAYER_RADIUS
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 1440, // max shoot speed at full power
  MIN_SHOOT_SPEED: 720, // min shoot speed

  // Possession mechanics
  POSSESSION_RADIUS: 45, // capture distance
  POSSESSION_BALL_OFFSET, // ball offset when possessed
  PRESSURE_RADIUS: 45, // opponent pressure distance

  // Pressure system
  PRESSURE_BUILDUP_RATE: 2, // per second per opponent
  PRESSURE_DECAY_RATE: 3, // per second when no opponents
  PRESSURE_RELEASE_THRESHOLD: 1.0, // triggers ball release

  // Possession lockouts
  CAPTURE_LOCKOUT_MS: 300,
  LOSS_LOCKOUT_MS: 300,

  // Goal bounds (derived from field height)
  GOAL_HEIGHT_RATIO,
  GOAL_Y_MIN: FIELD_HEIGHT / 2 - (FIELD_HEIGHT * GOAL_HEIGHT_RATIO) / 2,
  GOAL_Y_MAX: FIELD_HEIGHT / 2 + (FIELD_HEIGHT * GOAL_HEIGHT_RATIO) / 2,

  // Game timing
  TICK_RATE: 30, // server ticks per second
  MATCH_DURATION: 120, // seconds
} as const
