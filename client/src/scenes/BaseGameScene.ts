import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'
import type { EnginePlayerData } from '@shared'
import { VirtualJoystick } from '../controls/VirtualJoystick'
import { ActionButton } from '../controls/ActionButton'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { FieldRenderer } from '../utils/FieldRenderer'
import { BallRenderer } from '../utils/BallRenderer'
import { CameraManager } from '../utils/CameraManager'

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

  // Camera manager
  protected cameraManager!: CameraManager

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

    // Create visual elements
    FieldRenderer.createField(this, this.gameObjects, this.cameraManager.getUICamera())
    const ballObjects = BallRenderer.createBall(this, this.gameObjects, this.cameraManager.getUICamera())
    this.ball = ballObjects.ball
    this.ballShadow = ballObjects.shadow
    this.createPlayer()
    this.createUI()
    this.setupInput()
    this.createMobileControls()

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

    this.scoreText = this.add.text(width / 2, 30, '0 - 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.scoreText.setOrigin(0.5, 0)
    this.scoreText.setScrollFactor(0)

    this.timerText = this.add.text(width / 2, 70, '2:00', {
      fontSize: '24px',
      color: '#ffffff',
    })
    this.timerText.setOrigin(0.5, 0)
    this.timerText.setScrollFactor(0)

    const controlsText = this.isMobile
      ? 'Touch Joystick to Move • Tap Button to Shoot/Switch'
      : 'Arrow Keys to Move • Space to Shoot/Switch'

    this.controlsHint = this.add.text(width / 2, height - 30, controlsText, {
      fontSize: '16px',
      color: '#aaaaaa',
    })
    this.controlsHint.setOrigin(0.5, 0)
    this.controlsHint.setScrollFactor(0)

    this.uiObjects.push(this.scoreText, this.timerText, this.controlsHint)
    this.cameraManager.getGameCamera().ignore(this.uiObjects)
  }

  protected setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()

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
  }

  protected createMobileControls() {
    const width = this.scale.width
    const height = this.scale.height

    this.joystick = new VirtualJoystick(this)
    this.actionButton = new ActionButton(this, width - 120, height - 120)

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
      this.scene.start('MenuScene')
    })
  }

  protected onResize(gameSize: Phaser.Structs.Size) {
    if (this.scoreText) {
      this.scoreText.setPosition(gameSize.width / 2, 30)
    }
    if (this.timerText) {
      this.timerText.setPosition(gameSize.width / 2, 70)
    }
    if (this.controlsHint) {
      this.controlsHint.setPosition(gameSize.width / 2, gameSize.height - 30)
    }

    if (this.joystick) {
      this.joystick.resize(gameSize.width)
    }
    if (this.actionButton) {
      this.actionButton.resize(gameSize.width, gameSize.height)
    }
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
  }

  shutdown() {
    console.log(`🔄 [Shutdown] ${this.scene.key} shutting down...`)

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
