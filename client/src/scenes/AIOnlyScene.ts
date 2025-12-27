import { Application, Text } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { AIManager } from '@/ai'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { PixiSceneManager } from '@/utils/PixiSceneManager'

/**
 * AI-Only Scene (PixiJS)
 * Development mode where all players are AI-controlled
 */
export class AIOnlyScene extends BaseGameScene {
  private paused: boolean = false
  private gameSpeed: number = 1.0
  private gameSpeedText!: Text

  constructor(app: Application, key: string, manager: PixiSceneManager) {
    super(app, key, manager)
  }

  protected setupInput(): void {
    // Override keyboard handling for AIOnly

    // We reuse BaseGameScene's keyboard setup implicitly if we call super.setupInput()?
    // But BaseGameScene binds space for shooting.
    // We want to override it.
    // BaseGameScene.setupInput() sets up space for shooting and L for debug.
    // We can call super.setupInput() and then add more, but overriding behavior is tricky if we don't clear.
    // The BaseGameScene uses a Set<string> for keys and checks in update loop or via event.
    // It uses `window.addEventListener` for `keydown`.

    // Let's implement custom input handling here without calling super.setupInput(), or carefully overriding.
    // BaseGameScene calls `this.setupInput()` in `create()`.
    // So we can fully override it.

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'KeyL') {
            this.debugEnabled = !this.debugEnabled
            this.aiDebugRenderer.setEnabled(this.debugEnabled)
            console.log('🐛 AI Debug Labels:', this.debugEnabled ? 'ON' : 'OFF')
        }

        if (e.code === 'Space') {
            this.paused = !this.paused
            if (this.paused) {
                GameClock.pause()
            } else {
                GameClock.resume()
            }
            this.updateSpeedDisplay()
            console.log('⏸️ Game:', this.paused ? 'PAUSED' : 'PLAYING')
        }

        if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
            this.adjustGameSpeed(-0.05)
        }

        if (e.code === 'Equal' || e.code === 'NumpadAdd') {
            this.adjustGameSpeed(0.05)
        }
    }

    window.addEventListener('keydown', onKeyDown)

    this.cleanupInput = () => {
        window.removeEventListener('keydown', onKeyDown)
    }
  }

  protected createMobileControls(): void {
    // No mobile controls
  }

  protected initializeGameState(): void {
    if (GameClock.isMockMode()) {
      console.warn('🕐 AIOnlyScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()

    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    this.gameEngine.addPlayer('ai-blue-team', 'blue', false)
    this.gameEngine.addPlayer('ai-red-team', 'red', false)

    console.log('🤖 AI-Only mode: 6 AI players created (3 blue, 3 red)')

    this.aiManager = new AIManager()
    this.aiManager.initialize(
      ['ai-blue-team-p1', 'ai-blue-team-p2', 'ai-blue-team-p3'],
      ['ai-red-team-p1', 'ai-red-team-p2', 'ai-red-team-p3'],
      (playerId, decision) => this.applyAIDecision(playerId, decision)
    )

    this.setupGameEngineCallbacks(true)
    this.gameEngine.startMatch()
    this.syncPlayersFromEngine()

    this.debugEnabled = true
    this.aiDebugRenderer.setEnabled(true)

    this.controlsHint.text = 'SPACE: Play/Pause • +/-: Speed • L: Toggle Debug'

    this.setupSpectatorControls()

    GameClock.resetTimeScale()
    GameClock.setTimeScale(this.gameSpeed)

    this.setupTestAPI({
      getState: () => ({
        paused: this.paused,
        gameSpeed: this.gameSpeed,
        debugEnabled: this.debugEnabled,
      }),
    })
  }

  protected getGameState(): any {
    return this.gameEngine!.getState()
  }

  protected updateGameState(delta: number): void {
    if (!this.paused) {
      this.updateAIForGameEngine()
      const scaledDelta = delta * this.gameSpeed
      this.gameEngine!.update(scaledDelta)
    }
    this.syncVisualsFromEngine()
  }

  protected handleShootAction(): void {
    // No-op - AI only scene
  }

  protected cleanupGameState(): void {
    // No-op
  }

  protected getUnifiedState() {
    return this.gameEngine!.getState()
  }

  private setupSpectatorControls() {
    const width = this.app.screen.width

    this.gameSpeedText = new Text({
        text: this.getSpeedDisplayText(),
        style: {
            fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 20,
            fill: '#ffffff',
            fontWeight: 'bold',
            // backgroundColor: '#000000aa', // Not supported in Text
        }
    })

    // Background for text
    // Not implemented for simplicity, or we can add a graphic behind it.

    this.gameSpeedText.anchor.set(1, 0)
    this.gameSpeedText.position.set(width - 20, 30)
    this.gameSpeedText.zIndex = 1000

    this.cameraManager.getUIContainer().addChild(this.gameSpeedText)
  }

  private adjustGameSpeed(delta: number): void {
    this.gameSpeed = Math.max(0.01, Math.min(1.0, this.gameSpeed + delta))
    GameClock.setTimeScale(this.gameSpeed)
    this.updateSpeedDisplay()
    console.log(`⏩ Game Speed: ${this.gameSpeed.toFixed(2)}x`)
  }

  private getSpeedDisplayText(): string {
    const pausedText = this.paused ? ' [PAUSED]' : ''
    return `Speed: ${this.gameSpeed.toFixed(2)}x${pausedText}`
  }

  private updateSpeedDisplay(): void {
    if (this.gameSpeedText) {
      this.gameSpeedText.text = this.getSpeedDisplayText()
    }
  }

  public resize(width: number, height: number): void {
    super.resize(width, height)
    if (this.gameSpeedText) {
      this.gameSpeedText.position.set(width - 20, 30)
    }
  }

  protected updatePlayerBorders(): void {
    // In AI-only mode, ALL players should have uncontrolled borders
    this.players.forEach((playerSprite, playerId) => {
        const fillColor = this.playerFillColors.get(playerId) || 0xffffff

        playerSprite.clear()
        playerSprite.circle(0, 0, GAME_CONFIG.PLAYER_RADIUS)
        playerSprite.fill(fillColor)
        playerSprite.stroke({ width: 3, color: VISUAL_CONSTANTS.BORDER_COLOR, alpha: 1 })
    })
  }

  private applyAIDecision(playerId: string, decision: any) {
    this.applyAIDecisionForGameEngine(playerId, decision, false)
  }
}
