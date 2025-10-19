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
  // Fixed coordinate system for client, server, and physics
  FIELD_WIDTH: 1920,
  FIELD_HEIGHT: 1080,

  // Physics
  PLAYER_SPEED: 284, // pixels per second (10% slower: 315 * 0.9 ≈ 284)
  BALL_RADIUS: 15, // ball visual radius (30x30 ellipse / 2)
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 1440, // max shoot speed at full power (10% slower: 1600 * 0.9)
  MIN_SHOOT_SPEED: 720, // min shoot speed (10% slower: 800 * 0.9)
  POSSESSION_RADIUS: 45, // reduced for less magnetic ball capture (requires more precise positioning)
  POSSESSION_BALL_OFFSET: 25, // distance ball is positioned in front of player during possession

  // Field boundaries and goals
  FIELD_MARGIN: 40, // px from edge (field line position)
  PLAYER_MARGIN: 60, // px from edge for player bounds
  GOAL_DEPTH: 40, // How far goal extends outside field boundary (matches FIELD_MARGIN)
  GOAL_Y_MIN: 360, // 1080/2 - 180 (33% of height, centered)
  GOAL_Y_MAX: 720, // 1080/2 + 180

  // Game timing
  TICK_RATE: 30, // server updates per second
  MATCH_DURATION: 120, // seconds (2 minutes)

  // Ball capture / pressure system
  PRESSURE_RADIUS: 45, // distance at which opponent applies pressure (matches possession radius)
  PRESSURE_BUILDUP_RATE: 2, // pressure per second per opponent (~0.5s to capture with 1 opponent)
  PRESSURE_DECAY_RATE: 3, // pressure decay per second when no opponents near
  PRESSURE_RELEASE_THRESHOLD: 1.0, // pressure level that causes ball release (100%)

  // Possession lockout periods
  CAPTURE_LOCKOUT_MS: 300, // can't lose possession for 300ms after capturing
  LOSS_LOCKOUT_MS: 300, // can't capture possession for 300ms after losing
} as const
