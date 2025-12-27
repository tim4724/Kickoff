/**
 * Type definitions for Colyseus room options and configuration
 */

import type { Team } from '@kickoff/shared/types'

/**
 * Options passed when creating a MatchRoom
 */
export interface MatchRoomOptions {
  /** Unique room name for matchmaking (used by filterBy) */
  roomName?: string

  /** Time scale multiplier for testing (10x = tests run 10x faster) */
  timeScale?: number
}

/**
 * Player ready event data sent to client after join
 */
export interface PlayerReadyEvent {
  /** Client session ID */
  sessionId: string

  /** Assigned team (blue or red) */
  team: Team

  /** Room name for this match */
  roomName: string
}

/**
 * Match start event broadcast to all clients
 */
export interface MatchStartEvent {
  /** Match duration in seconds */
  duration: number
}

/**
 * Match end event broadcast to all clients
 */
export interface MatchEndEvent {
  /** Blue team final score */
  scoreBlue: number

  /** Red team final score */
  scoreRed: number

  /** Winning team */
  winner: 'blue' | 'red'
}

/**
 * Room closed event (when opponent leaves)
 */
export interface RoomClosedEvent {
  /** Reason for room closure */
  reason: 'opponent_left' | 'timeout' | 'server_shutdown'
}
