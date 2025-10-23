import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import type { EnginePlayerData, EnginePlayerInput } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { AIManager } from '../ai'
import { gameClock as GameClock } from '@shared/engine/GameClock'

/**
 * AI-Only Scene
 * Development mode where all players are AI-controlled
 * Useful for testing AI behavior and watching AI vs AI matches
 */
export class AIOnlyScene extends BaseGameScene {
  private gameEngine!: GameEngine
  private aiManager!: AIManager
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

    this.gameEngine.onShoot((playerId: string, power: number) => {
      console.log(`🎯 Player ${playerId} shot with power ${power.toFixed(2)}`)
    })

    // Start match immediately
    this.gameEngine.startMatch()

    // Initialize player visuals from engine state
    this.syncPlayersFromEngine()

    // Enable AI debug by default in AI-only mode
    this.debugEnabled = true
    this.aiDebugRenderer.setEnabled(true)

    // Update controls hint for AI-only mode
    this.controlsHint.setText('SPACE: Play/Pause • +/-: Speed • L: Toggle Debug')

    // Enable spectator camera controls
    this.setupSpectatorControls()

    // Set initial GameClock time scale to match game speed
    GameClock.setTimeScale(this.gameSpeed)

    // Expose controls for testing (development only)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      ;(window as any).__gameControls = {
        scene: this,
        test: {
          getState: () => ({
            paused: this.paused,
            gameSpeed: this.gameSpeed,
            debugEnabled: this.debugEnabled,
          }),
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
    // No human input - all players are AI-controlled

    // Update AI and apply decisions when not paused
    // GameClock.pause() ensures cooldown timers don't advance during pause
    if (!this.paused) {
      this.updateAI()

      // Scale delta by game speed
      const scaledDelta = delta * this.gameSpeed
      this.gameEngine.update(scaledDelta)
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

  private syncPlayersFromEngine() {
    const state = this.gameEngine.getState()

    // In AI-only mode, we don't have a "myPlayerId"
    // Create all players as remote players for rendering
    let isFirstPlayer = true

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (isFirstPlayer) {
        // Use the main player sprite for the first AI player (visual consistency)
        this.player.setPosition(playerData.x, playerData.y)
        const color =
          playerData.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
        this.player.setFillStyle(color)
        this.player.isFilled = true
        this.playerTeamColor = color
        // In AI-only mode, use no border and 80% opacity (no human control)
        this.player.setStrokeStyle(
          VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
          VISUAL_CONSTANTS.BORDER_COLOR
        )
        this.player.setAlpha(0.8) // 80% opacity (no human control)
        this.player.isFilled = true
        // Store reference so we can update it
        this.myPlayerId = playerId
        isFirstPlayer = false
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

    // Update players
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        // Update the main player sprite
        this.player.setPosition(playerData.x, playerData.y)
        this.player.setFillStyle(this.playerTeamColor)
        this.player.isFilled = true
      } else {
        // Update remote player sprites
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
   * Update AI and apply decisions to game engine
   */
  private updateAI() {
    const engineState = this.gameEngine.getState()

    // Convert GameEngineState to GameStateData format
    const gameStateData = this.convertEngineStateToGameStateData(engineState)

    // Update AI Manager (this will call TeamAI.update() which calls each AIPlayer.update())
    this.aiManager.update(gameStateData)
  }

  /**
   * Apply AI decision by queuing input to game engine
   */
  private applyAIDecision(playerId: string, decision: any) {

    const input: EnginePlayerInput = {
      movement: {
        x: decision.moveX,
        y: decision.moveY,
      },
      action: decision.shootPower !== null,
      actionPower: decision.shootPower ?? 0,
      timestamp: this.gameEngine.frameCount,
      playerId: playerId,
    }

    this.gameEngine.queueInput(playerId, input)
  }

  /**
   * Convert GameEngineState to GameStateData format for AI
   */
  private convertEngineStateToGameStateData(engineState: any): any {
    // Convert players map
    const playersMap = new Map()
    engineState.players.forEach((player: EnginePlayerData, playerId: string) => {
      playersMap.set(playerId, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        position: { x: player.x, y: player.y },
        velocity: { x: player.velocityX, y: player.velocityY },
        state: player.state,
        direction: player.direction,
      })
    })

    // Convert ball
    const ball = {
      position: { x: engineState.ball.x, y: engineState.ball.y },
      velocity: { x: engineState.ball.velocityX, y: engineState.ball.velocityY },
      possessedBy: engineState.ball.possessedBy,
    }

    return {
      players: playersMap,
      ball: ball,
      scoreBlue: engineState.scoreBlue,
      scoreRed: engineState.scoreRed,
      matchTime: engineState.matchTime,
      phase: engineState.phase,
    }
  }

  /**
   * Update AI debug visualization (called from BaseGameScene when debug is enabled)
   */
  protected updateAIDebugLabels(): void {
    const state = this.gameEngine.getState()

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      // Get AI player instance from AIManager
      const teamAI = this.aiManager.getTeamAI(playerData.team)
      const aiPlayer = teamAI?.getPlayer(playerId)

      // Get goal text from AIPlayer (debug label)
      const goal = aiPlayer?.getGoal()
      let goalText = goal ? goal.toUpperCase() : ''

      // Update goal label
      this.aiDebugRenderer.updatePlayerLabel(
        playerId,
        { x: playerData.x, y: playerData.y },
        goalText,
        playerData.team
      )

      // Get target position from AIPlayer
      const targetPos = aiPlayer?.getTargetPosition()
      if (targetPos) {
        // Draw target line to AI's actual target position
        this.aiDebugRenderer.updateTargetLine(
          playerId,
          { x: playerData.x, y: playerData.y },
          targetPos,
          playerData.team
        )
      }
    })
  }
}
