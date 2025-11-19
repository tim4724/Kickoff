import Phaser from 'phaser'
import { sceneRouter } from '../utils/SceneRouter'
import { GAME_CONFIG } from '@shared/types'
import type { EnginePlayerData, EnginePlayerInput } from '@shared'
import { GameEngine } from '@shared'
import { VirtualJoystick } from '../controls/VirtualJoystick'
import { ActionButton } from '../controls/ActionButton'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { FieldRenderer } from '../utils/FieldRenderer'
import { BallRenderer } from '../utils/BallRenderer'
import { CameraManager } from '../utils/CameraManager'
import { AIDebugRenderer } from '../utils/AIDebugRenderer'
import { StateAdapter, type UnifiedGameState } from '../utils/StateAdapter'
import { AIManager } from '../ai'
import { gameClock as GameClock } from '@shared/engine/GameClock'

/**
 * Base Game Scene
 * Abstract base class containing all shared rendering, UI, and visual logic
 * for both single-player and multiplayer game modes.
 */
export abstract class BaseGameScene extends Phaser.Scene {
  // Visual objects - unified player sprites
  protected players: Map<string, Phaser.GameObjects.Arc> = new Map()
  protected ball!: Phaser.GameObjects.Ellipse
  protected ballShadow!: Phaser.GameObjects.Ellipse
  protected gameObjects: Phaser.GameObjects.GameObject[] = []
  protected uiObjects: Phaser.GameObjects.GameObject[] = []
  protected controlArrow?: Phaser.GameObjects.Graphics

  // UI elements
  protected scoreText!: Phaser.GameObjects.Text
  protected timerText!: Phaser.GameObjects.Text
  protected controlsHint!: Phaser.GameObjects.Text
  protected backButton!: Phaser.GameObjects.Container

  // Camera manager
  protected cameraManager!: CameraManager

  // AI Debug renderer
  protected aiDebugRenderer!: AIDebugRenderer
  protected debugEnabled: boolean = false

  // Mobile controls
  protected joystick!: VirtualJoystick
  protected actionButton!: ActionButton
  protected isMobile: boolean = false

  // Controls
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  protected wasd!: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
  }

  // State
  /**
   * myPlayerId: The player identity that belongs to THIS client/session (NEVER changes).
   * - Determines team membership and teammates
   * - Used for network reconciliation in multiplayer
   * - Example: "session1-p1" (the human player for this session)
   */
  protected myPlayerId: string = 'player1-p1'

  /**
   * controlledPlayerId: The player currently being controlled via input (CHANGES when switching).
   * - Can be any teammate: "session1-p1", "session1-p2", "session1-p3"
   * - Changes when pressing SPACE to switch teammates
   * - Determines which player receives joystick/button input
   */
  protected controlledPlayerId: string = 'player1-p1'

  protected previousBallPossessor?: string
  protected playerTeamColor: number = VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
  protected goalScored: boolean = false
  protected matchEnded: boolean = false

  // Auto-switch state
  protected lastBallPossessor: string = ''
  protected autoSwitchEnabled: boolean = true

  // Optional GameEngine and AI support (used by SinglePlayerScene and AIOnlyScene)
  protected gameEngine?: GameEngine
  protected aiManager?: AIManager

  // Abstract methods that subclasses must implement
  protected abstract initializeGameState(): void
  protected abstract getGameState(): any
  protected abstract updateGameState(delta: number): void
  protected abstract handleShootAction(power: number): void
  protected abstract cleanupGameState(): void

  /**
   * Get unified game state (normalized format)
   * Subclasses implement this to convert their specific state format to unified format
   */
  protected abstract getUnifiedState(): UnifiedGameState | null

  // Optional method for AI debug - subclasses can override if they have AI
  protected updateAIDebugLabels(): void {
    // Default implementation for GameEngine-based scenes
    if (!this.gameEngine || !this.aiManager) {
      return
    }

    const state = this.gameEngine.getState()
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      // Get AI player instance from AIManager
      const teamAI = this.aiManager!.getTeamAI(playerData.team)
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

  // ========== COMMON HELPER METHODS FOR GAME ENGINE SCENES ==========

  /**
   * Update AI for GameEngine-based scenes
   * Used by SinglePlayerScene and AIOnlyScene
   * 
   * Converts: GameEngine → UnifiedGameState → GameStateData → AI
   */
  protected updateAIForGameEngine(): void {
    if (!this.gameEngine || !this.aiManager) {
      return
    }

    const unifiedState = this.getUnifiedState()
    if (!unifiedState) {
      return
    }

    const gameStateData = StateAdapter.toGameStateData(unifiedState)
    this.aiManager.update(gameStateData)
  }

  /**
   * Apply AI decision to GameEngine
   * Used by SinglePlayerScene and AIOnlyScene
   * @param skipControlled - If true, skip players that are controlled (for SinglePlayerScene)
   */
  protected applyAIDecisionForGameEngine(
    playerId: string,
    decision: any,
    skipControlled: boolean = false
  ): void {
    if (!this.gameEngine) {
      return
    }

    // Check if player is controlled (for SinglePlayerScene)
    if (skipControlled) {
      const engineState = this.gameEngine.getState()
      const player = engineState.players.get(playerId)
      if (player && player.isControlled) {
        return
      }
    }

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
   * Sync player sprites from GameEngine state
   * Used by SinglePlayerScene and AIOnlyScene
   * Creates all player sprites uniformly
   */
  protected syncPlayersFromEngine(): void {
    if (!this.gameEngine) {
      return
    }

    const state = this.gameEngine.getState()

    // Find the human-controlled player (for SinglePlayerScene)
    let humanPlayerId: string | undefined
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerData.isHuman && playerData.isControlled) {
        humanPlayerId = playerId
      }
    })

    // Create sprites for all players uniformly
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (!this.players.has(playerId)) {
        this.createPlayerSprite(playerId, playerData.x, playerData.y, playerData.team)

        // Set myPlayerId to human player if found, otherwise first player
        if (!this.myPlayerId || this.myPlayerId === 'player1-p1') {
          if (humanPlayerId && playerId === humanPlayerId) {
            this.myPlayerId = playerId
            this.controlledPlayerId = playerId
            this.playerTeamColor = playerData.team === 'blue'
              ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
              : VISUAL_CONSTANTS.PLAYER_RED_COLOR
          } else if (!humanPlayerId) {
            // AI-only mode: just pick first player
            this.myPlayerId = playerId
            this.controlledPlayerId = playerId
            this.playerTeamColor = playerData.team === 'blue'
              ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
              : VISUAL_CONSTANTS.PLAYER_RED_COLOR
          }
        }
      }
    })

    // Initialize control arrow
    this.initializeControlArrow()

    // Update borders to reflect controlled player
    this.updatePlayerBorders()
  }

  /**
   * Sync visual elements from GameEngine state
   * Used by SinglePlayerScene and AIOnlyScene
   */
  protected syncVisualsFromEngine(): void {
    if (!this.gameEngine) {
      return
    }

    const state = this.gameEngine.getState()

    // Update ball
    this.ball.setPosition(state.ball.x, state.ball.y)
    this.ballShadow.setPosition(state.ball.x + 2, state.ball.y + 3)

    // Update all player sprites uniformly
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      const sprite = this.players.get(playerId)
      if (sprite) {
        sprite.setPosition(playerData.x, playerData.y)
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
   * Set up common GameEngine callbacks (goal, match end)
   * Used by SinglePlayerScene and AIOnlyScene
   */
  protected setupGameEngineCallbacks(includeShoot: boolean = false): void {
    if (!this.gameEngine) {
      return
    }

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

    if (includeShoot) {
      this.gameEngine.onShoot((playerId: string, power: number) => {
        console.log(`🎯 Player ${playerId} shot with power ${power.toFixed(2)}`)
      })
    }
  }

  create() {
    console.log(`🎮 ${this.scene.key} - Creating...`)

    // Clear menu scene flag (if coming from menu)
    if (typeof window !== 'undefined' && (window as any).__menuLoaded) {
      ; (window as any).__menuLoaded = false
      console.log('🧹 Cleared __menuLoaded flag from previous menu scene')
    }

    // Detect mobile
    this.isMobile =
      this.sys.game.device.os.android ||
      this.sys.game.device.os.iOS ||
      this.sys.game.device.os.iPad ||
      this.sys.game.device.os.iPhone

    // Setup camera manager
    this.cameraManager = new CameraManager(this)

    // Initialize AI debug renderer (pass UI camera so debug elements only show on game camera)
    this.aiDebugRenderer = new AIDebugRenderer(this, this.cameraManager.getUICamera())

    // Create visual elements
    FieldRenderer.createField(this, this.gameObjects, this.cameraManager.getUICamera())
    const ballObjects = BallRenderer.createBall(this, this.gameObjects, this.cameraManager.getUICamera())
    this.ball = ballObjects.ball
    this.ballShadow = ballObjects.shadow
    // All player sprites are created uniformly in this.players Map during scene initialization
    this.createUI()
    this.setupInput()
    this.createMobileControls()
    this.createBackButton()
    this.scale.on('resize', this.onResize, this)

    // Also listen for native orientation change events (important for fullscreen on mobile)
    window.addEventListener('orientationchange', this.handleOrientationChange)

    // Create particle texture for celebrations
    this.createParticleTexture()

    // Expose for testing
    if (typeof window !== 'undefined') {
      ; (window as any).__gameControls = {
        scene: this,
        game: this.game,
      }
    }

    // Initialize game state (GameEngine or NetworkManager)
    this.initializeGameState()

    console.log(`✅ ${this.scene.key} ready`)
  }

  /**
   * Create a player sprite (unified method for all players)
   */
  protected createPlayerSprite(playerId: string, x: number, y: number, team: 'blue' | 'red'): Phaser.GameObjects.Arc {
    const color =
      team === 'blue'
        ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
        : VISUAL_CONSTANTS.PLAYER_RED_COLOR

    const playerSprite = this.add.circle(x, y, 36, color) // 20% larger than original (30 * 1.2)
    playerSprite.setStrokeStyle(
      VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
      VISUAL_CONSTANTS.BORDER_COLOR
    )
    playerSprite.isFilled = true
    playerSprite.setDepth(10)

    this.gameObjects.push(playerSprite)
    this.cameraManager.getUICamera().ignore([playerSprite])
    this.players.set(playerId, playerSprite)

    return playerSprite
  }

  /**
   * Initialize control arrow (created once, updated per frame)
   */
  protected initializeControlArrow() {
    if (!this.controlArrow) {
      this.controlArrow = this.add.graphics()
      this.controlArrow.setDepth(11)
      this.controlArrow.setVisible(false)
      this.cameraManager.getUICamera().ignore([this.controlArrow])
      this.gameObjects.push(this.controlArrow)
    }
  }

  protected createUI() {
    const width = this.scale.width
    const height = this.scale.height

    // Responsive text sizing
    const scoreFontSize = Math.max(24, Math.min(width * 0.035, 48)) // 3.5% of width (24-48px)
    const timerFontSize = Math.max(18, Math.min(width * 0.022, 32)) // 2.2% of width (18-32px)
    const hintFontSize = Math.max(12, Math.min(width * 0.016, 20)) // 1.6% of width (12-20px)

    // Safe zone margins (top margin for notch/status bar)
    const topMargin = 40

    this.scoreText = this.add.text(width / 2, topMargin, '0 - 0', {
      fontSize: `${scoreFontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.scoreText.setOrigin(0.5, 0)
    this.scoreText.setScrollFactor(0)

    this.timerText = this.add.text(width / 2, topMargin + scoreFontSize + 10, '2:00', {
      fontSize: `${timerFontSize}px`,
      color: '#ffffff',
    })
    this.timerText.setOrigin(0.5, 0)
    this.timerText.setScrollFactor(0)

    const controlsText = this.isMobile
      ? 'Touch Joystick to Move • Tap Button to Shoot/Switch'
      : 'WASD/Arrows to Move • Space to Shoot/Switch'

    // Bottom margin for home indicator/gesture bar (safe zone)
    const bottomMargin = 40

    this.controlsHint = this.add.text(width / 2, height - bottomMargin, controlsText, {
      fontSize: `${hintFontSize}px`,
      color: '#aaaaaa',
    })
    this.controlsHint.setOrigin(0.5, 1) // Bottom center anchor
    this.controlsHint.setScrollFactor(0)

    this.uiObjects.push(this.scoreText, this.timerText, this.controlsHint)
    this.cameraManager.getGameCamera().ignore(this.uiObjects)
  }

  protected setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add WASD keys for movement
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    this.input.keyboard!.on('keydown-SPACE', () => {
      const state = this.getGameState()
      if (!state) return

      const hasBall = state.ball.possessedBy === this.controlledPlayerId

      if (hasBall) {
        this.handleShootAction(0.8)
      } else {
        this.switchToNextTeammate()
      }
    })

    // Toggle AI debug labels with 'L' key
    this.input.keyboard!.on('keydown-L', () => {
      this.debugEnabled = !this.debugEnabled
      this.aiDebugRenderer.setEnabled(this.debugEnabled)
      console.log('🐛 AI Debug Labels:', this.debugEnabled ? 'ON' : 'OFF')
    })
  }

  protected createMobileControls() {
    const width = this.scale.width
    const height = this.scale.height

    // Safe zone margins (avoid iOS notch/home indicator, Android gesture bar)
    const SAFE_MARGIN_X = 20
    const SAFE_MARGIN_Y = 40

    this.joystick = new VirtualJoystick(this)
    this.actionButton = new ActionButton(
      this,
      width - 100 - SAFE_MARGIN_X,
      height - 100 - SAFE_MARGIN_Y
    )

    this.joystick.setTeamColor(this.playerTeamColor)
    this.actionButton.setTeamColor(this.playerTeamColor)

    this.actionButton.setOnReleaseCallback((power) => {
      const state = this.getGameState()
      if (!state) return

      const hasBall = state.ball.possessedBy === this.controlledPlayerId

      if (hasBall) {
        this.handleShootAction(power)
      } else {
        this.switchToNextTeammate()
      }
    })

    const joystickObjects = this.joystick.getGameObjects()
    const buttonObjects = this.actionButton.getGameObjects()
    this.cameraManager.getGameCamera().ignore([...joystickObjects, ...buttonObjects])
    this.uiObjects.push(...joystickObjects, ...buttonObjects)
  }

  protected createBackButton() {
    const buttonX = 10
    const buttonY = 10

    this.backButton = this.add.container(buttonX, buttonY)

    const background = this.add.rectangle(0, 0, 100, 40, 0x000000, 0.5)
    background.setOrigin(0, 0)

    const text = this.add.text(10, 10, '← Menu', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    text.setOrigin(0, 0)

    this.backButton.add([background, text])
    this.backButton.setDepth(3000)
    this.backButton.setScrollFactor(0)
    this.backButton.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 100, 40),
      Phaser.Geom.Rectangle.Contains
    )

    this.backButton.on('pointerdown', () => {
      console.log('🔙 Back button clicked - returning to menu')
      sceneRouter.navigateTo('MenuScene')
    })

    this.backButton.on('pointerover', () => {
      background.setAlpha(0.7)
      this.input.setDefaultCursor('pointer')
    })
    this.backButton.on('pointerout', () => {
      background.setAlpha(0.5)
      this.input.setDefaultCursor('default')
    })

    this.cameraManager.getGameCamera().ignore([this.backButton])
    this.uiObjects.push(this.backButton)
  }

  protected updateBackButtonPosition() {
    if (this.backButton) {
      this.backButton.setPosition(10, 10)
    }
  }


  /**
   * Update player borders - simplified with unified player map
   */
  protected updatePlayerBorders() {
    this.players.forEach((playerSprite, playerId) => {
      const isControlled = playerId === this.controlledPlayerId
      playerSprite.setStrokeStyle(
        isControlled ? VISUAL_CONSTANTS.CONTROLLED_PLAYER_BORDER : VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
        VISUAL_CONSTANTS.BORDER_COLOR
      )
      playerSprite.isFilled = true // Restore fill after setStrokeStyle
    })

    this.updateControlArrow()
  }

  protected updateControlArrow(): void {
    if (!this.controlArrow) {
      return
    }

    const unifiedState = this.getUnifiedState()
    if (!unifiedState || !this.controlledPlayerId) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    const playerState = unifiedState.players.get(this.controlledPlayerId)
    if (!playerState) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    const sprite = this.players.get(this.controlledPlayerId)
    if (!sprite) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    // Hide arrow if player is not moving
    // Use velocity check (more accurate than state due to inertia)
    const vx = playerState.velocityX ?? 0
    const vy = playerState.velocityY ?? 0

    // Check for invalid values
    if (isNaN(vx) || isNaN(vy) || !isFinite(vx) || !isFinite(vy)) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    const speed = Math.sqrt(vx ** 2 + vy ** 2)
    const MIN_SPEED_THRESHOLD = 15 // pixels per second - threshold to account for inertia decay

    if (speed < MIN_SPEED_THRESHOLD) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    const direction = playerState.direction
    if (direction === undefined || direction === null || Number.isNaN(direction)) {
      this.controlArrow.clear()
      this.controlArrow.setVisible(false)
      return
    }

    const radius = (sprite as Phaser.GameObjects.Arc).radius ?? 36
    const baseDistance = radius + 12
    const tipDistance = baseDistance + 24
    const baseHalfWidth = 18

    const dirX = Math.cos(direction)
    const dirY = Math.sin(direction)
    const perpX = Math.cos(direction + Math.PI / 2)
    const perpY = Math.sin(direction + Math.PI / 2)

    const baseCenterX = sprite.x + dirX * baseDistance
    const baseCenterY = sprite.y + dirY * baseDistance
    const tipX = sprite.x + dirX * tipDistance
    const tipY = sprite.y + dirY * tipDistance

    const baseLeftX = baseCenterX + perpX * baseHalfWidth
    const baseLeftY = baseCenterY + perpY * baseHalfWidth
    const baseRightX = baseCenterX - perpX * baseHalfWidth
    const baseRightY = baseCenterY - perpY * baseHalfWidth

    this.controlArrow.clear()
    this.controlArrow.setVisible(true)
    this.controlArrow.lineStyle(4, 0xffffff, 0.95)

    // Left edge
    this.controlArrow.beginPath()
    this.controlArrow.moveTo(tipX, tipY)
    this.controlArrow.lineTo(baseLeftX, baseLeftY)
    this.controlArrow.strokePath()

    // Right edge
    this.controlArrow.beginPath()
    this.controlArrow.moveTo(tipX, tipY)
    this.controlArrow.lineTo(baseRightX, baseRightY)
    this.controlArrow.strokePath()
  }

  protected updateBallColor(state: any) {
    const possessorId = state.ball.possessedBy
    const possessor = possessorId ? state.players.get(possessorId) : null
    const possessorTeam = possessor?.team || null

    BallRenderer.updateBallColor(
      this.ball,
      possessorTeam,
      state.ball.pressureLevel || 0,
      VISUAL_CONSTANTS.BALL_BLUE_COLOR,
      VISUAL_CONSTANTS.BALL_RED_COLOR
    )
  }

  /**
   * Auto-switch to ball carrier when possession changes
   * Enhanced logic: Only auto-switch when our team captures the ball or shoots,
   * NOT when opponent team loses possession.
   */
  protected checkAutoSwitchOnPossession() {
    if (!this.autoSwitchEnabled) return

    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return

    const myTeam = StateAdapter.getPlayerTeam(unifiedState, this.myPlayerId)
    if (!myTeam) return

    const ballPossessor = unifiedState.ball.possessedBy

    // Check if possession changed and belongs to our team (controlled player's team)
    if (ballPossessor && ballPossessor !== this.lastBallPossessor) {
      const playerTeam = StateAdapter.getPlayerTeam(unifiedState, ballPossessor)
      if (playerTeam === myTeam) {
        // Switch to the ball carrier on our team
        this.switchToPlayer(ballPossessor)
        console.log(`⚽ Auto-switched to ball carrier: ${ballPossessor}`)
      }
      this.lastBallPossessor = ballPossessor
    } else if (!ballPossessor && this.lastBallPossessor) {
      // Ball became loose - check who lost possession
      const lastPlayerTeam = StateAdapter.getPlayerTeam(unifiedState, this.lastBallPossessor)

      // If last possessor was opponent team, DON'T auto-switch
      // Wait for our team to capture the ball naturally
      if (lastPlayerTeam && lastPlayerTeam !== myTeam) {
        console.log(`⚽ Opponent lost possession, waiting for our team to capture`)
        // Don't switch - let the player keep control
      }
      // If last possessor was our team and ball is loose, switch to best interceptor
      else if (lastPlayerTeam === myTeam) {
        console.log(`⚽ Ball loose after our team possession, switching to best interceptor`)
        this.autoSwitchToBestInterceptor()
      }

      this.lastBallPossessor = ''
    }

    // Keep previousBallPossessor for backward compatibility with other code
    this.previousBallPossessor = ballPossessor
  }

  /**
   * Auto-switch to the teammate with best chance to intercept the ball
   */
  protected autoSwitchToBestInterceptor() {
    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return

    const teammateIds = StateAdapter.getTeammateIds(unifiedState, this.myPlayerId)
    const bestPlayerId = StateAdapter.findBestInterceptor(unifiedState, teammateIds)

    // Only switch if we found a best interceptor and it's not the current player
    if (!bestPlayerId || bestPlayerId === this.controlledPlayerId) {
      console.log(`⚽ Current player is best interceptor, staying in control: ${this.controlledPlayerId}`)
      return
    }

    // Switch to the best interceptor
    this.switchToPlayer(bestPlayerId)
    console.log(`⚽ Auto-switched to best interceptor: ${bestPlayerId}`)
  }

  /**
   * Switch control to a specific player (validates team membership)
   */
  protected switchToPlayer(playerId: string): void {
    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return

    const myTeam = StateAdapter.getPlayerTeam(unifiedState, this.myPlayerId)
    const playerTeam = StateAdapter.getPlayerTeam(unifiedState, playerId)

    // Only allow switching to teammates
    if (!myTeam || !playerTeam || playerTeam !== myTeam) {
      return
    }

    // Update controlled player
    this.controlledPlayerId = playerId

    // Update player borders to show who is controlled
    this.updatePlayerBorders()

    // Subclasses can override to add additional logic (e.g., GameEngine.setPlayerControl)
    this.onPlayerSwitched(playerId)
  }

  /**
   * Called after player switch completes
   * Subclasses can override to add scene-specific logic
   */
  protected onPlayerSwitched(_playerId: string): void {
    // Default: no-op. Subclasses override if needed.
  }

  /**
   * Collect movement input from keyboard (arrow keys + WASD) and joystick
   * Returns normalized movement vector { x, y }
   */
  protected collectMovementInput(): { x: number; y: number } {
    let moveX = 0
    let moveY = 0

    // Joystick input (if available)
    if (this.joystick && this.joystick.isPressed()) {
      const joystickInput = this.joystick.getInput()
      moveX = joystickInput.x
      moveY = joystickInput.y
    } else {
      // Keyboard input
      // Arrow keys
      if (this.cursors.left.isDown) moveX = -1
      else if (this.cursors.right.isDown) moveX = 1

      if (this.cursors.up.isDown) moveY = -1
      else if (this.cursors.down.isDown) moveY = 1

      // WASD keys (override arrow keys if pressed)
      if (this.wasd.a.isDown) moveX = -1
      else if (this.wasd.d.isDown) moveX = 1

      if (this.wasd.w.isDown) moveY = -1
      else if (this.wasd.s.isDown) moveY = 1

      // Normalize diagonal movement
      const length = Math.sqrt(moveX * moveX + moveY * moveY)
      if (length > 0) {
        moveX /= length
        moveY /= length
      }
    }

    return { x: moveX, y: moveY }
  }

  /**
   * Switch to next teammate (manual switching)
   */
  protected switchToNextTeammate() {
    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return

    const teammates = StateAdapter.getTeammateIds(unifiedState, this.myPlayerId)
    if (teammates.length === 0) return

    // Find current controlled player index
    const currentIndex = teammates.indexOf(this.controlledPlayerId)
    const nextIndex = (currentIndex + 1) % teammates.length
    const nextPlayerId = teammates[nextIndex]

    this.switchToPlayer(nextPlayerId)
    console.log(`🔄 Manual switch to: ${nextPlayerId}`)
  }

  protected onGoalScored(team: 'blue' | 'red') {
    this.goalScored = true

    const goalX = team === 'blue' ? GAME_CONFIG.FIELD_WIDTH - 40 : 40
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2

    this.createGoalCelebration(goalX, goalY, team)
    this.flashScreen(team === 'blue' ? 0x0066ff : 0xff4444)
    this.shakeScreen()

    this.time.delayedCall(1000, () => {
      this.goalScored = false
    })
  }

  protected createParticleTexture() {
    const graphics = this.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(4, 4, 4)
    graphics.generateTexture('spark', 8, 8)
    graphics.destroy()
  }

  protected createGoalCelebration(x: number, y: number, team: 'blue' | 'red') {
    if (!this.textures.exists('spark')) {
      this.createParticleTexture()
    }

    const particleColor = team === 'blue' ? 0x0066ff : 0xff4444

    const particles = this.add.particles(x, y, 'spark', {
      speed: { min: -400, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 600,
      gravityY: 300,
      quantity: 30,
      tint: particleColor,
    })

    this.cameraManager.getUICamera().ignore(particles)

    this.time.delayedCall(1000, () => {
      particles.destroy()
    })
  }

  protected flashScreen(color: number = 0xffffff) {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    const flash = this.add.rectangle(width / 2, height / 2, width, height, color, 0.5)
    flash.setDepth(1500)

    this.cameraManager.getUICamera().ignore(flash)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    })
  }

  protected shakeScreen() {
    this.cameraManager.getGameCamera().shake(200, 0.01)
  }

  // Public for test access - tests need to trigger game over scenarios
  public onMatchEnd() {
    this.matchEnded = true

    const state = this.getGameState()
    const winner =
      state.scoreBlue > state.scoreRed ? 'Blue' : state.scoreRed > state.scoreBlue ? 'Red' : 'Draw'

    this.showMatchEndScreen(winner, state.scoreBlue, state.scoreRed)
  }

  protected showMatchEndScreen(winner: string, scoreBlue: number, scoreRed: number) {
    const width = this.scale.width
    const height = this.scale.height

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setDepth(2000)
    overlay.setScrollFactor(0)

    const resultText = this.add.text(
      width / 2,
      height / 2 - 50,
      winner === 'Draw' ? 'Match Draw!' : `${winner} Team Wins!`,
      { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }
    )
    resultText.setOrigin(0.5)
    resultText.setDepth(2001)
    resultText.setScrollFactor(0)

    const scoreText = this.add.text(width / 2, height / 2 + 20, `${scoreBlue} - ${scoreRed}`, {
      fontSize: '36px',
      color: '#ffffff',
    })
    scoreText.setOrigin(0.5)
    scoreText.setDepth(2001)
    scoreText.setScrollFactor(0)

    const restartText = this.add.text(width / 2, height / 2 + 80, 'Tap to return to menu', {
      fontSize: '24px',
      color: '#aaaaaa',
    })
    restartText.setOrigin(0.5)
    restartText.setDepth(2001)
    restartText.setScrollFactor(0)

    this.cameraManager.getGameCamera().ignore([overlay, resultText, scoreText, restartText])

    this.input.once('pointerdown', () => {
      console.log('🔙 Match ended - returning to menu')
      sceneRouter.navigateTo('MenuScene')
    })
  }

  protected onResize(gameSize: Phaser.Structs.Size) {
    // Only handle resize if this scene is active
    if (!this.scene.isActive()) {
      return
    }

    console.log(`🔄 [BaseGameScene] Resize triggered: ${gameSize.width}x${gameSize.height}`)

    // Update camera manager to handle UI camera viewport changes
    if (this.cameraManager) {
      this.cameraManager.handleResize(gameSize)
    }

    // Update back button position
    this.updateBackButtonPosition()

    // Responsive text sizing
    const scoreFontSize = Math.max(24, Math.min(gameSize.width * 0.035, 48))
    const timerFontSize = Math.max(18, Math.min(gameSize.width * 0.022, 32))
    const hintFontSize = Math.max(12, Math.min(gameSize.width * 0.016, 20))

    // Safe zone margins
    const topMargin = 40
    const bottomMargin = 40
    const SAFE_MARGIN_X = 20
    const SAFE_MARGIN_Y = 40

    // Update UI text positions and sizes
    if (this.scoreText) {
      this.scoreText.setPosition(gameSize.width / 2, topMargin)
      this.scoreText.setFontSize(scoreFontSize)
    }
    if (this.timerText) {
      this.timerText.setPosition(gameSize.width / 2, topMargin + scoreFontSize + 10)
      this.timerText.setFontSize(timerFontSize)
    }
    if (this.controlsHint) {
      this.controlsHint.setPosition(gameSize.width / 2, gameSize.height - bottomMargin)
      this.controlsHint.setFontSize(hintFontSize)
    }

    // Update mobile controls positions with safe zones
    if (this.joystick) {
      this.joystick.resize(gameSize.width)
      console.log(`🕹️ [BaseGameScene] Joystick resized to width: ${gameSize.width}`)
    }
    if (this.actionButton) {
      this.actionButton.resize(
        gameSize.width - SAFE_MARGIN_X,
        gameSize.height - SAFE_MARGIN_Y
      )
      console.log(
        `🎯 [BaseGameScene] Action button resized to: ${gameSize.width - SAFE_MARGIN_X}x${gameSize.height - SAFE_MARGIN_Y
        }`
      )
    }
  }

  /**
   * Handle native orientation change events (for fullscreen rotation on mobile)
   * Similar to MenuScene, Phaser's resize event doesn't always fire during fullscreen
   */
  protected handleOrientationChange = (): void => {
    // Only handle if this scene is active
    if (!this.scene.isActive()) {
      return
    }

    console.log(`🔄 [${this.scene.key}] Orientation change detected`)

    // Wait for dimensions to stabilize after rotation
    setTimeout(() => {
      // Double-check scene is still active after timeout
      if (!this.scene.isActive()) {
        return
      }

      const width = window.innerWidth
      const height = window.innerHeight

      console.log(`📐 [${this.scene.key}] New dimensions: ${width}x${height}`)

      // Force Phaser to resize
      this.scale.resize(width, height)

      // Explicitly update camera manager (Phaser's resize event doesn't always fire properly)
      if (this.cameraManager) {
        console.log('🎥 Explicitly updating cameras after orientation change')
        this.cameraManager.handleResize(new Phaser.Structs.Size(width, height))
      }

      // Manually trigger our onResize handler to update UI elements
      this.onResize(new Phaser.Structs.Size(width, height))
    }, 100)
  }

  update(_time: number, delta: number) {
    // Update mobile controls
    if (this.actionButton) {
      this.actionButton.update()
    }

    // Update game state (implemented by subclasses)
    this.updateGameState(delta)

    // Update ball color based on possession
    const state = this.getGameState()
    if (!state) {
      this.updateControlArrow()
      return // Wait for state to be available
    }

    this.updateBallColor(state)
    this.updateControlArrow()

    // Auto-switch on possession change
    this.checkAutoSwitchOnPossession()

    // Update AI debug visualization if enabled
    if (this.debugEnabled) {
      this.updateAIDebugLabels()
    }
  }

  /**
   * Set up test API for development/testing
   * Subclasses can override to add scene-specific test methods
   * @param customTestMethods - Optional object with scene-specific test methods to add
   */
  protected setupTestAPI(customTestMethods?: Record<string, any>): void {
    if (typeof window === 'undefined') {
      return
    }

    // Get existing __gameControls or create new one
    // This preserves any properties set by create() like 'game'
    const existingControls = (window as any).__gameControls || {}

    // Common test API structure - merge with existing
    const testAPI: any = {
      ...existingControls,
      scene: this,
    }

    // Add joystick and button references if available (not in AI-only mode)
    if (this.joystick && this.actionButton) {
      testAPI.joystick = this.joystick
      testAPI.button = this.actionButton

      // Base getState that includes joystick/button
      const baseGetState = () => ({
        joystick: this.joystick.__test_getState(),
        button: this.actionButton.__test_getState(),
      })

      // Common test methods for joystick and button
      const baseTestMethods = {
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
        getState: baseGetState,
      }

      // Merge custom test methods, handling getState specially
      const customMethods = { ...(customTestMethods || {}) }
      if (customMethods.getState) {
        // Merge custom getState with base getState
        const customGetState = customMethods.getState
        customMethods.getState = () => ({
          ...baseGetState(),
          ...customGetState(),
        })
      }

      testAPI.test = {
        ...baseTestMethods,
        ...customMethods,
      }
    } else {
      // AI-only mode: no joystick/button, just basic test API
      testAPI.test = {
        getState: () => ({}),
        // Merge in custom test methods from subclass
        ...(customTestMethods || {}),
      }
    }

    // Expose GameClock for time control in tests
    ; (window as any).GameClock = GameClock

      // Expose test API
      ; (window as any).__gameControls = testAPI

    console.log('🧪 Testing API exposed: window.__gameControls')
    console.log('🕐 GameClock exposed for time control')
  }

  protected shouldAllowAIControl(playerId: string): boolean {
    return playerId !== this.controlledPlayerId
  }

  shutdown() {
    console.log(`🔄 [Shutdown] ${this.scene.key} shutting down...`)

    this.scale.off('resize', this.onResize, this)
    window.removeEventListener('orientationchange', this.handleOrientationChange)

    if (this.joystick) {
      this.joystick.destroy()
    }
    if (this.actionButton) {
      this.actionButton.destroy()
    }
    if (this.cameraManager) {
      this.cameraManager.destroy()
    }
    if (this.controlArrow) {
      this.controlArrow.destroy()
      this.controlArrow = undefined
    }

    this.cleanupGameState()

    this.matchEnded = false

    // Clear test API when scene shuts down
    if (typeof window !== 'undefined' && (window as any).__gameControls?.scene === this) {
      console.log('🧹 Clearing __gameControls test API')
      delete (window as any).__gameControls
    }
  }
}