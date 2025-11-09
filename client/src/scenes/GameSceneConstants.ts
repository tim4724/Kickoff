/**
 * GameScene-specific constants for visual and interaction settings
 */

export const VISUAL_CONSTANTS = {
  // Player border widths
  CONTROLLED_PLAYER_BORDER: 4, // Thicker border for controlled player
  UNCONTROLLED_PLAYER_BORDER: 2, // Thin border for uncontrolled players (better visibility)

  // Interpolation factors (reduced for lower latency)
  BALL_LERP_FACTOR: 0.5, // Increased from 0.3 for faster ball sync
  REMOTE_PLAYER_LERP_FACTOR: 0.5, // Increased from 0.3 for faster remote player sync

  // Reconciliation factors (increased for faster correction)
  BASE_RECONCILE_FACTOR: 0.2, // Increased from 0.05 for faster correction
  MODERATE_RECONCILE_FACTOR: 0.5, // Increased from 0.3
  STRONG_RECONCILE_FACTOR: 0.8, // Increased from 0.6

  // Error thresholds for reconciliation
  MODERATE_ERROR_THRESHOLD: 25,
  LARGE_ERROR_THRESHOLD: 50,

  // Movement detection thresholds
  MIN_MOVEMENT_INPUT: 0.01,
  MIN_POSITION_CHANGE: 0.5,
  MIN_CORRECTION: 2,
  REMOTE_MOVEMENT_THRESHOLD: 1,

  // Debug logging
  STATE_UPDATE_LOG_INTERVAL: 60, // Log every 60 updates (~2 seconds at 30fps)

  // Team colors (darkened for ball)
  BALL_BLUE_COLOR: 0x0047b3,
  BALL_RED_COLOR: 0xb33030,

  // Player colors (standard)
  PLAYER_BLUE_COLOR: 0x0066ff,
  PLAYER_RED_COLOR: 0xff4444,

  // Moving player colors (lightened)
  PLAYER_BLUE_MOVING: 0x0088ff,
  PLAYER_RED_MOVING: 0xff6666,

  // Border color
  BORDER_COLOR: 0xffffff,
} as const

export type TeamColor = 'blue' | 'red'
