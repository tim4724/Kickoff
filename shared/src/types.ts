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
  PLAYER_SPEED: 600, // pixels per second (increased from 200 for playable movement)
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 400,
  PASS_SPEED: 300,
  POSSESSION_RADIUS: 70, // increased from 50 for easier ball capture

  // Field boundaries and goals
  FIELD_MARGIN: 40, // px from edge
  PLAYER_MARGIN: 60, // px from edge for player bounds
  GOAL_WIDTH: 40,
  GOAL_Y_MIN: 360, // 1080/2 - 180 (33% of height, centered)
  GOAL_Y_MAX: 720, // 1080/2 + 180

  // Game timing
  TICK_RATE: 30, // server updates per second
  MATCH_DURATION: 120, // seconds (2 minutes)

  // Ball capture / pressure system
  PRESSURE_RADIUS: 40, // distance at which opponent applies pressure
  PRESSURE_BUILDUP_RATE: 1.0, // pressure per second per opponent
  PRESSURE_DECAY_RATE: 1.2, // pressure decay per second when no opponents near
  PRESSURE_RELEASE_THRESHOLD: 1.0, // pressure level that causes ball release (100%)
} as const
