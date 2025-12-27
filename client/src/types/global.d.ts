/**
 * Global type definitions for window extensions
 * Used for test utilities and debug tools
 */

import type { GameEngine } from '@shared/engine/GameEngine'
import type { Application, Container } from 'pixi.js'
import type { VirtualJoystick } from '@/controls/VirtualJoystick'
import type { ActionButton } from '@/controls/ActionButton'
import type { gameClock } from '@shared/engine/GameClock'
import type { PixiScene } from '@/utils/PixiScene'

declare global {
  interface Window {
    // Menu scene flag
    __menuLoaded?: boolean

    // Test server configuration
    __SERVER_URL__?: string
    __testRoomId?: string
    __testRoomName?: string
    __testTimeScale?: string

    // Game controls for testing
    __gameControls?: {
      scene: PixiScene
      game: Application
      joystick?: VirtualJoystick
      button?: ActionButton
      backButton?: Container
      test?: GameControlsTestAPI
    }

    // Game clock for testing
    GameClock?: typeof gameClock
  }
}

/**
 * Test API for mobile controls
 * Allows custom extensions for specific scene types
 */
export interface GameControlsTestAPI {
  // Joystick controls
  touchJoystick: (x: number, y: number) => void
  dragJoystick: (x: number, y: number) => void
  releaseJoystick: () => void

  // Action button controls
  pressButton: () => void
  releaseButton: () => void

  // State inspection - allows custom extensions
  getState: () => {
    joystick?: any
    button?: any
    [key: string]: any
  }

  // Allow any additional custom methods for scene-specific extensions
  [key: string]: any
}

export {}
