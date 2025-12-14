/**
 * Test Constants and Tolerances
 *
 * Centralized configuration for test assertions and timing.
 */

// Standard tolerances for assertions
export const TEST_TOLERANCES = {
  POSITION: 5,          // ±5px for position checks
  VELOCITY: 0.1,        // ±10% for velocity
  TIME: 100,            // ±100ms for timing (with time acceleration)
  DISTANCE: 10,         // ±10px for distance measurements
} as const

// Physics constants (from shared/src/types.ts)
export const PHYSICS_CONSTANTS = {
  POSSESSION_RADIUS: 70,
  PRESSURE_RADIUS: 70,
  PLAYER_SPEED: 450,
  SHOOT_SPEED: 2000,
  MIN_SHOOT_SPEED: 800,
  FIELD_WIDTH: 1600,
  FIELD_HEIGHT: 1000,
} as const

// Test timing constants
export const TEST_TIMING = {
  NETWORK_PROPAGATION: 200,  // Expected network round-trip time
  STATE_SYNC_TIMEOUT: 5000,  // Maximum time to wait for state sync
  POSSESSION_TIMEOUT: 3000,  // Time to wait for possession to stabilize
  MOVEMENT_TIMEOUT: 5000,    // Time to wait for movement to complete
} as const
