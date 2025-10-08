/**
 * TypeScript interfaces for GameScene server state
 */

export interface BallState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  possessedBy?: string
  pressureLevel?: number
}

export interface PlayerState {
  x: number
  y: number
  team: 'blue' | 'red'
  id: string
  inputQueue?: any[]
}

export interface GameState {
  ball: BallState
  players: Map<string, PlayerState>
  scoreBlue: number
  scoreRed: number
  matchTime: number
  phase: 'waiting' | 'playing' | 'ended'
}

export interface GoalScoredEvent {
  team: 'blue' | 'red'
  scorer?: string
}

export interface MatchEndEvent {
  winner: 'blue' | 'red' | 'draw'
  scoreBlue: number
  scoreRed: number
}
