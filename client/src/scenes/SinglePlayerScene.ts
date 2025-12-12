import { Application } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '@/ai'
import { StateAdapter } from '@/utils/StateAdapter'
import { PixiSceneManager } from '@/utils/PixiSceneManager'

/**
 * Single Player Scene (PixiJS)
 * Extends BaseGameScene to provide local GameEngine-based gameplay with AI opponents
 */
export class SinglePlayerScene extends BaseGameScene {
  private aiEnabled: boolean = true

  constructor(app: Application, key: string, manager: PixiSceneManager) {
    super(app, key, manager)
  }

  protected initializeGameState(): void {
    if (GameClock.isMockMode()) {
      console.warn('🕐 SinglePlayerScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()

    GameClock.resetTimeScale()
    GameClock.setTimeScale(1.0)

    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    this.gameEngine.addPlayer('player1', 'blue', true) // Human controlled team
    this.gameEngine.addPlayer('player2', 'red', false) // AI controlled team

    this.aiManager = new AIManager()
    this.aiManager.initialize(
      ['player1-p1', 'player1-p2', 'player1-p3'], // Blue team
      ['player2-p1', 'player2-p2', 'player2-p3'], // Red team
      (playerId, decision) => this.applyAIDecision(playerId, decision)
    )

    console.log('🤖 SinglePlayer mode: Human player with AI teammates vs AI opponents')

    this.setupGameEngineCallbacks()
    this.gameEngine.startMatch()
    this.syncPlayersFromEngine()

    this.setupTestAPI({
      getState: () => ({
        joystick: this.joystick ? this.joystick.__test_getState() : null,
        button: this.actionButton ? this.actionButton.__test_getState() : null,
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
      directMove: async (dx: number, dy: number, gameTimeDurationMs: number) => {
        const length = Math.sqrt(dx * dx + dy * dy)
        const normalizedX = length > 0 ? dx / length : 0
        const normalizedY = length > 0 ? dy / length : 0

        const timeScale = GameClock.getTimeScale()
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
      teleportPlayer: (x: number, y: number, playerId?: string) => {
        if (!this.gameEngine) return
        const state = this.gameEngine.getState()
        const targetId = playerId || this.controlledPlayerId
        const player = state.players.get(targetId)
        if (player) {
            player.x = x
            player.y = y
            player.velocityX = 0
            player.velocityY = 0
            console.log(`🔮 Teleport player ${targetId} to ${x}, ${y}`)
        }
      },
      teleportBall: (x: number, y: number) => {
        if (!this.gameEngine) return
        const state = this.gameEngine.getState()
        state.ball.x = x
        state.ball.y = y
        state.ball.velocityX = 0
        state.ball.velocityY = 0
        console.log(`🔮 Teleport ball to ${x}, ${y}`)
      },
    })
  }

  protected getGameState(): any {
    return this.gameEngine!.getState()
  }

  protected updateGameState(delta: number): void {
    if (this.aiEnabled) {
      this.updateAIForGameEngine()
    }

    const movement = this.collectMovementInput()

    if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
      this.gameEngine!.queueInput(this.controlledPlayerId, {
        movement,
        action: false,
        timestamp: this.gameEngine!.frameCount,
      })
    }

    this.gameEngine!.update(delta)
    this.syncVisualsFromEngine()
  }

  protected handleShootAction(power: number): void {
    this.gameEngine!.queueInput(this.controlledPlayerId, {
      movement: { x: 0, y: 0 },
      action: true,
      actionPower: power,
      timestamp: this.gameEngine!.frameCount,
    })
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup
  }

  private applyAIDecision(playerId: string, decision: any) {
    this.applyAIDecisionForGameEngine(playerId, decision, true)
  }

  protected getUnifiedState() {
    const engineState = this.gameEngine!.getState()
    return StateAdapter.fromGameEngine(engineState)
  }

  protected onPlayerSwitched(playerId: string): void {
    this.gameEngine!.setPlayerControl(this.myPlayerId, playerId)
  }
}
