import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'
import type { EnginePlayerData } from '@shared'
import { VirtualJoystick } from '../controls/VirtualJoystick'
import { ActionButton } from '../controls/ActionButton'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { FieldRenderer } from '../utils/FieldRenderer'
import { BallRenderer } from '../utils/BallRenderer'
import { CameraManager } from '../utils/CameraManager'
import { AIDebugRenderer } from '../utils/AIDebugRenderer'
import { sceneRouter } from '../utils/SceneRouter'

/**
 * Base Game Scene
 * Abstract base class containing all shared rendering, UI, and visual logic
 * for both single-player and multiplayer game modes.
 */
export abstract class BaseGameScene extends Phaser.Scene {
  // Visual objects
  protected player!: Phaser.GameObjects.Arc
  protected ball!: Phaser.GameObjects.Ellipse
  protected ballShadow!: Phaser.GameObjects.Ellipse
  protected remotePlayers: Map<string, Phaser.GameObjects.Arc> = new Map()
  protected gameObjects: Phaser.GameObjects.GameObject[] = []
  protected uiObjects: Phaser.GameObjects.GameObject[] = []

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
  protected myPlayerId: string = 'player1'
  protected controlledPlayerId: string = 'player1'
  protected previousBallPossessor?: string
  protected playerTeamColor: number = VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
  protected goalScored: boolean = false
  protected matchEnded: boolean = false

  // Abstract methods that subclasses must implement
  protected abstract initializeGameState(): void
  protected abstract getGameState(): any
  protected abstract updateGameState(delta: number): void
  protected abstract handleShootAction(power: number): void
  protected abstract cleanupGameState(): void

  // Optional method for AI debug - subclasses can override if they have AI
  protected updateAIDebugLabels(): void {
    // Default: no-op. Subclasses with AI should override this.
  }

  create() {
    console.log(`🎮 ${this.scene.key} - Creating...`)

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
    this.createPlayer()
    this.createUI()
    this.setupInput()
    this.createMobileControls()
    this.createBackButton()
    this.scale.on('resize', this.onResize, this)

    // Also listen for native orientation change events (important for fullscreen on mobile)
    window.addEventListener('orientationchange', this.handleOrientationChange)

    // Create particle texture for celebrations
    this.createParticleTexture()

    // Initialize game state (GameEngine or NetworkManager)
    this.initializeGameState()

    console.log(`✅ ${this.scene.key} ready`)
  }

  protected createPlayer() {
    this.player = this.add.circle(
      GAME_CONFIG.FIELD_WIDTH / 2,
      GAME_CONFIG.FIELD_HEIGHT / 2,
      36, // 20% larger than original (30 * 1.2)
      this.playerTeamColor
    )
    this.player.setStrokeStyle(
      VISUAL_CONSTANTS.CONTROLLED_PLAYER_BORDER,
      VISUAL_CONSTANTS.BORDER_COLOR
    )
    // Ensure circle is filled (setStrokeStyle can clear isFilled flag)
    this.player.isFilled = true

    this.gameObjects.push(this.player)
    this.cameraManager.getUICamera().ignore([this.player])
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
      console.log('🔙 Back to menu')
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

  protected switchToNextTeammate() {
    const state = this.getGameState()
    const myTeam = state.players.get(this.myPlayerId)?.team
    if (!myTeam) return

    const teammates: string[] = []
    state.players.forEach((player: EnginePlayerData, playerId: string) => {
      if (player.team === myTeam) {
        teammates.push(playerId)
      }
    })

    if (teammates.length === 0) return

    const currentIndex = teammates.indexOf(this.controlledPlayerId || '')
    const nextIndex = (currentIndex + 1) % teammates.length
    this.controlledPlayerId = teammates[nextIndex]

    console.log(`🔄 Switched control to: ${this.controlledPlayerId}`)
    this.updatePlayerBorders()
  }

  protected createRemotePlayer(sessionId: string, playerState: EnginePlayerData) {
    const color =
      playerState.team === 'blue'
        ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
        : VISUAL_CONSTANTS.PLAYER_RED_COLOR

    const remotePlayer = this.add.circle(playerState.x, playerState.y, 36, color) // 20% larger (30 * 1.2)
    remotePlayer.setStrokeStyle(
      VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
      VISUAL_CONSTANTS.BORDER_COLOR
    )
    remotePlayer.setAlpha(0.8) // Start with 80% opacity (non-controlled by default)
    // Ensure circle is filled (setStrokeStyle can clear isFilled flag)
    remotePlayer.isFilled = true
    remotePlayer.setDepth(10)

    this.gameObjects.push(remotePlayer)
    this.cameraManager.getUICamera().ignore([remotePlayer])
    this.remotePlayers.set(sessionId, remotePlayer)
  }

  protected updatePlayerBorders() {
    if (this.myPlayerId === this.controlledPlayerId) {
      this.player.setStrokeStyle(
        VISUAL_CONSTANTS.CONTROLLED_PLAYER_BORDER,
        VISUAL_CONSTANTS.BORDER_COLOR
      )
      this.player.setAlpha(1.0) // Full opacity for controlled player
      this.player.isFilled = true // Restore fill after setStrokeStyle
    } else {
      this.player.setStrokeStyle(
        VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
        VISUAL_CONSTANTS.BORDER_COLOR
      )
      this.player.setAlpha(0.8) // 80% opacity for non-controlled players
      this.player.isFilled = true // Restore fill after setStrokeStyle
    }

    this.remotePlayers.forEach((playerSprite, sessionId) => {
      if (sessionId === this.controlledPlayerId) {
        playerSprite.setStrokeStyle(
          VISUAL_CONSTANTS.CONTROLLED_PLAYER_BORDER,
          VISUAL_CONSTANTS.BORDER_COLOR
        )
        playerSprite.setAlpha(1.0) // Full opacity for controlled player
        playerSprite.isFilled = true // Restore fill after setStrokeStyle
      } else {
        playerSprite.setStrokeStyle(
          VISUAL_CONSTANTS.UNCONTROLLED_PLAYER_BORDER,
          VISUAL_CONSTANTS.BORDER_COLOR
        )
        playerSprite.setAlpha(0.8) // 80% opacity for non-controlled players
        playerSprite.isFilled = true // Restore fill after setStrokeStyle
      }
    })
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

  protected checkAutoSwitchOnPossession(state: any) {
    const myTeam = state.players.get(this.myPlayerId)?.team
    if (!myTeam) return

    const currentPossessor = state.ball.possessedBy

    if (currentPossessor) {
      const possessorPlayer = state.players.get(currentPossessor)
      if (possessorPlayer?.team === myTeam) {
        if (currentPossessor !== this.previousBallPossessor) {
          this.controlledPlayerId = currentPossessor
          this.updatePlayerBorders()
        }
      }
    }

    this.previousBallPossessor = currentPossessor
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
      console.log('🔙 Match ended - returning to menu via router')
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
        `🎯 [BaseGameScene] Action button resized to: ${gameSize.width - SAFE_MARGIN_X}x${
          gameSize.height - SAFE_MARGIN_Y
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
    if (!state) return // Wait for state to be available

    this.updateBallColor(state)

    // Auto-switch on possession change
    this.checkAutoSwitchOnPossession(state)

    // Update AI debug visualization if enabled
    if (this.debugEnabled) {
      this.updateAIDebugLabels()
    }
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

    this.cleanupGameState()

    this.matchEnded = false
  }
}
