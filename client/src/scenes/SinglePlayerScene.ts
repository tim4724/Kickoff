import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import type { EnginePlayerData } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { gameClock as GameClock } from '@shared/engine/GameClock'

/**
 * Single Player Scene
 * Extends BaseGameScene to provide local GameEngine-based gameplay with AI opponents
 */
export class SinglePlayerScene extends BaseGameScene {
  private gameEngine!: GameEngine

  constructor() {
    super({ key: 'SinglePlayerScene' })
  }

  protected initializeGameState(): void {
    // Initialize game engine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Add players (3v3: 3 players per team)
    this.gameEngine.addPlayer('player1', 'blue', true) // Human controlled team
    this.gameEngine.addPlayer('player2', 'red', false) // Non-human controlled team

    // Set up callbacks
    this.gameEngine.onGoal((event: { team: 'blue' | 'red'; time: number }) => {
      console.log('⚽ Goal!', event.team)
      if (!this.goalScored) {
        this.onGoalScored(event.team)
      }
    })

    this.gameEngine.onMatchEnd(() => {
      console.log('🏁 Match ended')
      if (!this.matchEnded) {
        this.onMatchEnd()
      }
    })

    // Start match immediately
    this.gameEngine.startMatch()

    // Initialize player visuals from engine state
    this.syncPlayersFromEngine()

    // Expose controls for testing (development only)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      ;(window as any).__gameControls = {
        joystick: this.joystick,
        button: this.actionButton,
        scene: this,
        test: {
          touchJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateTouch(x, y)
          },
          dragJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateDrag(x, y)
          },
          releaseJoystick: () => {
            this.joystick.__test_simulateRelease()
          },
          pressButton: () => {
            this.actionButton.__test_simulatePress()
          },
          releaseButton: (holdMs: number = 500) => {
            this.actionButton.__test_simulateRelease(holdMs)
          },
          getState: () => ({
            joystick: this.joystick.__test_getState(),
            button: this.actionButton.__test_getState(),
          }),
          // Direct input method (bypasses UI simulation)
          // Queues continuous input for specified duration
          // durationMs is in GAME TIME - we convert to real time based on time scale
          directMove: async (dx: number, dy: number, gameTimeDurationMs: number) => {
            // Normalize direction vector
            const length = Math.sqrt(dx * dx + dy * dy)
            const normalizedX = length > 0 ? dx / length : 0
            const normalizedY = length > 0 ? dy / length : 0

            const timeScale = GameClock.getTimeScale()

            // Convert game time to real time
            // With 10x acceleration: 2000ms game time = 200ms real time (2000 / 10)
            const realTimeDurationMs = gameTimeDurationMs / timeScale

            console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`)
            console.log(`  Game time: ${gameTimeDurationMs}ms, Real time: ${realTimeDurationMs}ms, Scale: ${timeScale}x`)

            const startTime = performance.now()
            const endTime = startTime + realTimeDurationMs

            // Queue input continuously in real time
            // Queue multiple inputs per iteration to ensure smooth movement under CPU load
            let iterations = 0
            while (performance.now() < endTime) {
              // Queue 3 inputs per iteration for redundancy
              for (let i = 0; i < 3; i++) {
                this.gameEngine.queueInput(this.myPlayerId, {
                  movement: { x: normalizedX, y: normalizedY },
                  action: false,
                  power: undefined
                })
              }
              iterations++

              // Small delay to avoid overwhelming the queue (real time)
              await new Promise(resolve => setTimeout(resolve, 5))
            }

            const actualRealTime = performance.now() - startTime
            console.log(`🎮 [Test] Direct move complete: ${iterations} iterations, ${actualRealTime.toFixed(1)}ms real time`)
          },
        },
      }
      // Expose GameClock for time control in tests
      ;(window as any).GameClock = GameClock
      console.log('🧪 Testing API exposed: window.__gameControls')
      console.log('🕐 GameClock exposed for time control')
    }
  }

  protected getGameState(): any {
    return this.gameEngine.getState()
  }

  protected updateGameState(delta: number): void {
    // Get input from joystick or keyboard
    const movement = { x: 0, y: 0 }

    if (this.joystick && this.joystick.isPressed()) {
      const joystickInput = this.joystick.getInput()
      movement.x = joystickInput.x
      movement.y = joystickInput.y
    } else if (this.cursors) {
      if (this.cursors.left.isDown) movement.x = -1
      else if (this.cursors.right.isDown) movement.x = 1

      if (this.cursors.up.isDown) movement.y = -1
      else if (this.cursors.down.isDown) movement.y = 1

      const length = Math.sqrt(movement.x * movement.x + movement.y * movement.y)
      if (length > 0) {
        movement.x /= length
        movement.y /= length
      }
    }

    // Queue input for controlled player
    if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
      this.gameEngine.queueInput(this.controlledPlayerId, {
        movement,
        action: false,
        timestamp: Date.now(),
      })
    }

    // Update game engine
    this.gameEngine.update(delta)

    // Sync visuals from engine state
    this.syncVisualsFromEngine()
  }

  protected handleShootAction(power: number): void {
    this.gameEngine.queueInput(this.controlledPlayerId, {
      movement: { x: 0, y: 0 },
      action: true,
      actionPower: power,
      timestamp: Date.now(),
    })
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup (if needed in future)
  }

  private syncPlayersFromEngine() {
    const state = this.gameEngine.getState()

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        this.player.setPosition(playerData.x, playerData.y)
        const color =
          playerData.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
        this.player.setFillStyle(color)
        this.player.isFilled = true // Restore fill after setFillStyle
        this.playerTeamColor = color
      } else {
        this.createRemotePlayer(playerId, playerData)
      }
    })
  }

  private syncVisualsFromEngine() {
    const state = this.gameEngine.getState()

    // Update ball
    this.ball.setPosition(state.ball.x, state.ball.y)
    this.ballShadow.setPosition(state.ball.x + 2, state.ball.y + 3)

    // Update players - sync all sprites based on their actual IDs
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        // Always update the main player sprite (represents original human player)
        this.player.setPosition(playerData.x, playerData.y)
        // Ensure color is always set
        this.player.setFillStyle(this.playerTeamColor)
        this.player.isFilled = true // Restore fill after setFillStyle
      } else {
        // Update remote player sprites (teammates and opponents)
        const sprite = this.remotePlayers.get(playerId)
        if (sprite) {
          sprite.setPosition(playerData.x, playerData.y)
        }
      }
    })

    // Update UI
    this.scoreText.setText(`${state.scoreBlue} - ${state.scoreRed}`)

    const minutes = Math.floor(state.matchTime / 60)
    const seconds = Math.floor(state.matchTime % 60)
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

    if (state.matchTime <= 30 && state.matchTime > 0) {
      this.timerText.setColor('#ff4444')
    } else {
      this.timerText.setColor('#ffffff')
    }
  }
}
