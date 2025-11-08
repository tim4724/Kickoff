import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { AIManager } from '../ai'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { StateAdapter } from '../utils/StateAdapter'

/**
 * AI-Only Scene
 * Development mode where all players are AI-controlled
 * Useful for testing AI behavior and watching AI vs AI matches
 */
export class AIOnlyScene extends BaseGameScene {
  private paused: boolean = false
  private gameSpeed: number = 1.0 // Initial speed: 1.0 (range: 0.01 to 1.0)
  private gameSpeedText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'AIOnlyScene' })
  }

  /**
   * Override setupInput to remove player switching behavior
   */
  protected setupInput(): void {
    // Create cursor keys
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add WASD keys for movement (even though not used in AI-only, keeps consistency)
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    // Register 'L' key for AI debug toggle (from BaseGameScene)
    this.input.keyboard!.on('keydown-L', () => {
      this.debugEnabled = !this.debugEnabled
      this.aiDebugRenderer.setEnabled(this.debugEnabled)
      console.log('🐛 AI Debug Labels:', this.debugEnabled ? 'ON' : 'OFF')
    })

    // Spacebar will be handled in setupSpectatorControls instead (no shooting)
  }

  /**
   * Override createMobileControls to skip creating joystick and action button
   */
  protected createMobileControls(): void {
    // Do nothing - AI-only mode doesn't need controls
    // Joystick and action button will not be created
  }

  protected initializeGameState(): void {
    // Initialize game engine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Add AI-only teams (all players are AI-controlled)
    // Blue team: 3 equal AI players
    this.gameEngine.addPlayer('ai-blue-team', 'blue', false)

    // Red team: 3 equal AI players
    this.gameEngine.addPlayer('ai-red-team', 'red', false)

    console.log('🤖 AI-Only mode: 6 AI players created (3 blue, 3 red)')

    // Initialize AI system
    // Game engine creates 3 equal players per team
    this.aiManager = new AIManager()
    this.aiManager.initialize(
      ['ai-blue-team', 'ai-blue-team-bot1', 'ai-blue-team-bot2'],
      ['ai-red-team', 'ai-red-team-bot1', 'ai-red-team-bot2'],
      (playerId, decision) => this.applyAIDecision(playerId, decision)
    )

    // Set up common callbacks (including shoot callback)
    this.setupGameEngineCallbacks(true)

    // Start match immediately
    this.gameEngine.startMatch()

    // In AI-only mode, clear myPlayerId so the first player gets assigned to the main sprite
    // This prevents the main sprite from staying at the center unassigned
    this.myPlayerId = ''
    this.controlledPlayerId = ''

    // Initialize player visuals from engine state
    this.syncPlayersFromEngine()

    // After syncing, hide the main player sprite since all players should be rendered as remote players
    // The main sprite was used for the first player, but we want all players to have consistent styling
    // So we'll create a remote player for the first player and hide the main sprite
    if (this.myPlayerId) {
      const state = this.gameEngine.getState()
      const firstPlayerData = state.players.get(this.myPlayerId)
      if (firstPlayerData && !this.remotePlayers.has(this.myPlayerId)) {
        // Create remote player for the first player (to match all other players)
        this.createRemotePlayer(this.myPlayerId, firstPlayerData)
        // Hide the main player sprite (it's not needed in AI-only mode)
        this.player.setVisible(false)
        // Clear myPlayerId so syncVisualsFromEngine treats all players as remote
        this.myPlayerId = ''
      }
    }

    // Enable AI debug by default in AI-only mode
    this.debugEnabled = true
    this.aiDebugRenderer.setEnabled(true)

    // Update controls hint for AI-only mode
    this.controlsHint.setText('SPACE: Play/Pause • +/-: Speed • L: Toggle Debug')

    // Enable spectator camera controls
    this.setupSpectatorControls()

    // Set initial GameClock time scale to match game speed
    GameClock.setTimeScale(this.gameSpeed)

    // Set up test API with AIOnlyScene-specific methods
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
    // No human input - all players are AI-controlled

    // Update AI and apply decisions when not paused
    // GameClock.pause() ensures cooldown timers don't advance during pause
    if (!this.paused) {
      this.updateAIForGameEngine()

      // Scale delta by game speed
      const scaledDelta = delta * this.gameSpeed
      this.gameEngine!.update(scaledDelta)
    }

    // Sync visuals from engine state (always update visuals even when paused)
    this.syncVisualsFromEngine()

    // Note: AI debug visualization is handled by BaseGameScene.update()
  }

  protected handleShootAction(_power: number): void {
    // No shooting action in AI-only mode (all automated)
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup (if needed in future)
  }

  /**
   * Get unified game state (implements BaseGameScene abstract method)
   */
  protected getUnifiedState() {
    const engineState = this.gameEngine!.getState()
    return StateAdapter.fromGameEngine(engineState)
  }

  /**
   * Set up spectator controls
   */
  private setupSpectatorControls() {
    console.log('📹 AI-Only Mode - Spectator View')
    console.log('  - SPACE: Play/Pause')
    console.log('  - +/-: Adjust game speed (current: 0.05x)')
    console.log('  - D: Toggle AI debug visualization')

    // Create game speed display
    const width = this.scale.width
    this.gameSpeedText = this.add.text(width - 20, 30, this.getSpeedDisplayText(), {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 8 },
    })
    this.gameSpeedText.setOrigin(1, 0)
    this.gameSpeedText.setScrollFactor(0)
    this.gameSpeedText.setDepth(1000)

    // Make it visible only in UI camera (not game camera)
    this.cameraManager.getGameCamera().ignore([this.gameSpeedText])

    // Add SPACE key for play/pause
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.paused = !this.paused

      // Sync GameClock pause state
      if (this.paused) {
        GameClock.pause()
      } else {
        GameClock.resume()
      }

      this.updateSpeedDisplay()
      console.log('⏸️ Game:', this.paused ? 'PAUSED' : 'PLAYING')
    })

    // Add + key (PLUS and EQUALS for convenience) to increase game speed
    this.input.keyboard?.on('keydown-PLUS', () => {
      this.adjustGameSpeed(0.05)
    })
    this.input.keyboard?.on('keydown-EQUALS', () => {
      // Handle + without shift (= key)
      this.adjustGameSpeed(0.05)
    })

    // Add - key (MINUS) to decrease game speed
    this.input.keyboard?.on('keydown-MINUS', () => {
      this.adjustGameSpeed(-0.05)
    })

    // Note: L key for debug toggle is handled in BaseGameScene.setupInput()
  }

  /**
   * Adjust game speed within range (0.01 to 1.0)
   */
  private adjustGameSpeed(delta: number): void {
    this.gameSpeed = Math.max(0.01, Math.min(1.0, this.gameSpeed + delta))

    // Sync GameClock time scale with game speed
    GameClock.setTimeScale(this.gameSpeed)

    this.updateSpeedDisplay()
    console.log(`⏩ Game Speed: ${this.gameSpeed.toFixed(2)}x`)
  }

  /**
   * Get formatted speed display text
   */
  private getSpeedDisplayText(): string {
    const pausedText = this.paused ? ' [PAUSED]' : ''
    return `Speed: ${this.gameSpeed.toFixed(2)}x${pausedText}`
  }

  /**
   * Update speed display text
   */
  private updateSpeedDisplay(): void {
    if (this.gameSpeedText) {
      this.gameSpeedText.setText(this.getSpeedDisplayText())
    }
  }

  // syncPlayersFromEngine and syncVisualsFromEngine are inherited from BaseGameScene
  // The base implementation handles AI-only mode correctly (myPlayerId is set to first player)

  /**
   * Override updatePlayerBorders to prevent human control indicator in AI-only mode
   */
  protected updatePlayerBorders(): void {
    // In AI-only mode, ALL players should have no borders and 80% opacity (no human control)
    this.player.setStrokeStyle(
      VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
      VISUAL_CONSTANTS.BORDER_COLOR
    )
    this.player.setAlpha(0.8) // 80% opacity (no human control)
    this.player.isFilled = true

    this.remotePlayers.forEach((playerSprite) => {
      playerSprite.setStrokeStyle(
        VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
        VISUAL_CONSTANTS.BORDER_COLOR
      )
      playerSprite.setAlpha(0.8) // 80% opacity (no human control)
      playerSprite.isFilled = true
    })
  }

  /**
   * Apply AI decision by queuing input to game engine
   * In AI-only mode, all players are AI-controlled, so skipControlled=false
   */
  private applyAIDecision(playerId: string, decision: any) {
    // Use base class method with skipControlled=false (all players are AI)
    this.applyAIDecisionForGameEngine(playerId, decision, false)
  }
}
