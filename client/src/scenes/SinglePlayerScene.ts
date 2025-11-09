import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '../ai'
import { StateAdapter } from '../utils/StateAdapter'

/**
 * Single Player Scene
 * Extends BaseGameScene to provide local GameEngine-based gameplay with AI opponents
 * Features:
 * - AI teammates for human player
 * - AI opponents
 * - Auto-switching to ball carrier
 * - Manual switching with action button (short press)
 */
export class SinglePlayerScene extends BaseGameScene {
  private aiEnabled: boolean = true

  constructor() {
    super({ key: 'SinglePlayerScene' })
  }

  protected initializeGameState(): void {
    // Ensure we resume real-time mode (tests may have left the clock in mock mode)
    if (GameClock.isMockMode()) {
      console.warn('🕐 SinglePlayerScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()

    // Set GameClock to normal speed (1.0x) to prevent state pollution from other scenes
    GameClock.resetTimeScale()
    GameClock.setTimeScale(1.0)

    // Initialize game engine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Add players (3v3: 3 players per team)
    this.gameEngine.addPlayer('player1', 'blue', true) // Human controlled team
    this.gameEngine.addPlayer('player2', 'red', false) // AI controlled team

    // Initialize AI system for both teams
    this.aiManager = new AIManager()
    this.aiManager.initialize(
      ['player1', 'player1-bot1', 'player1-bot2'], // Blue team (human + 2 AI teammates)
      ['player2', 'player2-bot1', 'player2-bot2'], // Red team (3 AI opponents)
      (playerId, decision) => this.applyAIDecision(playerId, decision)
    )

    console.log('🤖 SinglePlayer mode: Human player with AI teammates vs AI opponents')

    // Set up common callbacks
    this.setupGameEngineCallbacks()

    // Start match immediately
    this.gameEngine.startMatch()

    // Initialize player visuals from engine state
    this.syncPlayersFromEngine()

    // Set up test API with SinglePlayerScene-specific methods
    this.setupTestAPI({
      getState: () => ({
        joystick: this.joystick.__test_getState(),
        button: this.actionButton.__test_getState(),
        aiEnabled: this.aiEnabled,
        autoSwitchEnabled: this.autoSwitchEnabled,
      }),
      setAIEnabled: (enabled: boolean) => {
        this.aiEnabled = enabled
        console.log(`🤖 AI ${enabled ? 'enabled' : 'disabled'}`)
      },
      setAutoSwitchEnabled: (enabled: boolean) => {
        this.autoSwitchEnabled = enabled
        console.log(`🔄 Auto-switch ${enabled ? 'enabled' : 'disabled'}`)
      },
      // Direct input method (bypasses UI simulation)
      // Queues continuous input for specified duration
      // durationMs is in GAME TIME - we convert to frames based on time scale
      directMove: async (dx: number, dy: number, gameTimeDurationMs: number) => {
        // Normalize direction vector
        const length = Math.sqrt(dx * dx + dy * dy)
        const normalizedX = length > 0 ? dx / length : 0
        const normalizedY = length > 0 ? dy / length : 0

        const timeScale = GameClock.getTimeScale()

        // Calculate frames needed: at 60fps, each frame is ~16.67ms real time
        // With time scale, we process (16.67 * timeScale)ms game time per frame
        const realTimeDurationMs = gameTimeDurationMs / timeScale
        const framesNeeded = Math.ceil(realTimeDurationMs / 16.67)

        console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)}) for ${framesNeeded} frames`)

        let frameCount = 0

        return new Promise<void>((resolve) => {
          const queueInput = () => {
            if (frameCount >= framesNeeded) {
              console.log(`🎮 [Test] Direct move complete: ${frameCount} frames`)
              resolve()
              return
            }

            // Queue one input per frame
            this.gameEngine!.queueInput(this.myPlayerId, {
              movement: { x: normalizedX, y: normalizedY },
              action: false,
              timestamp: this.gameEngine!.frameCount,
            })

            frameCount++
            requestAnimationFrame(queueInput)
          }

          requestAnimationFrame(queueInput)
        })
      },
    })
  }

  protected getGameState(): any {
    return this.gameEngine!.getState()
  }

  protected updateGameState(delta: number): void {
    // Update AI for all non-controlled players
    if (this.aiEnabled) {
      this.updateAIForGameEngine()
    }

    // Get input from keyboard/joystick for controlled player
    const movement = this.collectMovementInput()

    // Queue input for controlled player
    if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
      this.gameEngine!.queueInput(this.controlledPlayerId, {
        movement,
        action: false,
        timestamp: this.gameEngine!.frameCount,
      })
    }

    // Update game engine
    this.gameEngine!.update(delta)

    // Sync visuals from engine state
    this.syncVisualsFromEngine()
  }

  protected handleShootAction(power: number): void {
    // Shoot with variable power
    // (BaseGameScene already checks hasBall before calling this method)
    this.gameEngine!.queueInput(this.controlledPlayerId, {
      movement: { x: 0, y: 0 },
      action: true,
      actionPower: power,
      timestamp: this.gameEngine!.frameCount,
    })

    // Auto-switching is handled by BaseGameScene.checkAutoSwitchOnPossession() when ball becomes loose
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup (if needed in future)
  }

  /**
   * Apply AI decision by queuing input to game engine
   * Only applies if the player is NOT human-controlled
   */
  private applyAIDecision(playerId: string, decision: any) {
    // Use base class method with skipControlled=true to skip human-controlled players
    this.applyAIDecisionForGameEngine(playerId, decision, true)
  }

  /**
   * Get unified game state (implements BaseGameScene abstract method)
   */
  protected getUnifiedState() {
    const engineState = this.gameEngine!.getState()
    return StateAdapter.fromGameEngine(engineState)
  }

  /**
   * Called after player switch completes - update GameEngine control
   */
  protected onPlayerSwitched(playerId: string): void {
    this.gameEngine!.setPlayerControl(this.myPlayerId, playerId)
  }
}
