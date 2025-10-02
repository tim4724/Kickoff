import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'
import { GeometryUtils } from '@shared/utils/geometry'
import { VirtualJoystick } from '../controls/VirtualJoystick'
import { ActionButton } from '../controls/ActionButton'
import { NetworkManager } from '../network/NetworkManager'

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc
  private ball!: Phaser.GameObjects.Ellipse
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private scoreText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text

  // Dual camera system
  private gameCamera!: Phaser.Cameras.Scene2D.Camera
  private uiCamera!: Phaser.Cameras.Scene2D.Camera
  private gameObjects: Phaser.GameObjects.GameObject[] = []
  private uiObjects: Phaser.GameObjects.GameObject[] = []

  // Mobile controls
  private joystick!: VirtualJoystick
  private actionButton!: ActionButton
  private isMobile: boolean = false

  private playerVelocity = { x: 0, y: 0 }
  private ballVelocity = { x: 0, y: 0 }

  // Multiplayer networking
  private networkManager?: NetworkManager
  private mySessionId?: string
  private isMultiplayer: boolean = false
  private remotePlayers: Map<string, Phaser.GameObjects.Arc> = new Map()

  // Goal zones and scoring (using shared GAME_CONFIG)
  private leftGoal = {
    x: GAME_CONFIG.FIELD_MARGIN,
    yMin: GAME_CONFIG.GOAL_Y_MIN,
    yMax: GAME_CONFIG.GOAL_Y_MAX,
    width: GAME_CONFIG.GOAL_WIDTH
  }
  private rightGoal = {
    x: GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.FIELD_MARGIN,
    yMin: GAME_CONFIG.GOAL_Y_MIN,
    yMax: GAME_CONFIG.GOAL_Y_MAX,
    width: GAME_CONFIG.GOAL_WIDTH
  }
  private scoreBlue: number = 0
  private scoreRed: number = 0
  private goalScored: boolean = false

  // Match timer
  private timeRemaining: number = 120
  private timerEvent?: Phaser.Time.TimerEvent
  private matchEnded: boolean = false

  // DEBUG: State update tracking
  private stateUpdateCount: number = 0

  // Player team color (set after connecting to multiplayer)
  private playerTeamColor: number = 0x0066ff // Default blue, updated from server
  private colorInitialized: boolean = false // Track if color has been set from server
  private positionInitialized: boolean = false // Track if position has been synced from server

  // Input tracking for multiplayer (removed throttling - now sends at 60Hz)

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    // Detect mobile device
    this.isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS ||
                    this.sys.game.device.os.iPad || this.sys.game.device.os.iPhone

    // Setup dual camera system FIRST
    this.setupCameras()

    // Goal zones already initialized with GAME_CONFIG constants

    // Create particle texture for goal celebrations
    this.createParticleTexture()

    this.createField()
    this.createBall()
    this.createPlayer()
    this.createUI()
    this.setupInput()
    this.createMobileControls()

    // Connect to multiplayer server AFTER all game objects are created
    // This prevents update() from running before initialization is complete
    this.connectToMultiplayer()

    // Expose controls for testing (development only)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as any).__gameControls = {
        joystick: this.joystick,
        button: this.actionButton,
        scene: this,
        // Helper functions for easy testing
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
        },
      }

      console.log('🧪 Testing API exposed: window.__gameControls')
    }

    console.log('⚽ Game scene ready! Mobile:', this.isMobile)
  }

  private setupCameras() {
    // Use main camera as game camera: Fixed 1920x1080 bounds, centered viewport
    this.gameCamera = this.cameras.main
    this.gameCamera.setBounds(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT)

    // Create UI camera: Full screen bounds and viewport
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)

    // Calculate and set initial viewport for game camera
    this.updateGameCameraViewport()

    // Listen for resize events
    this.scale.on('resize', this.onResize, this)

    console.log('📷 Dual camera system initialized')
  }

  private updateGameCameraViewport() {
    const screenWidth = this.scale.width
    const screenHeight = this.scale.height
    const targetAspect = GAME_CONFIG.FIELD_WIDTH / GAME_CONFIG.FIELD_HEIGHT // 16:9

    let viewportX = 0
    let viewportY = 0
    let viewportWidth = screenWidth
    let viewportHeight = screenHeight

    if (screenWidth / screenHeight > targetAspect) {
      // Screen wider than 16:9 - vertical letterboxing
      viewportHeight = screenHeight
      viewportWidth = screenHeight * targetAspect
      viewportX = (screenWidth - viewportWidth) / 2
      viewportY = 0
    } else {
      // Screen taller than 16:9 - horizontal letterboxing
      viewportWidth = screenWidth
      viewportHeight = screenWidth / targetAspect
      viewportX = 0
      viewportY = (screenHeight - viewportHeight) / 2
    }

    this.gameCamera.setViewport(viewportX, viewportY, viewportWidth, viewportHeight)

    // Calculate zoom to fit 1920x1080 game world into viewport
    const zoomX = viewportWidth / GAME_CONFIG.FIELD_WIDTH
    const zoomY = viewportHeight / GAME_CONFIG.FIELD_HEIGHT
    const zoom = Math.min(zoomX, zoomY)

    this.gameCamera.setZoom(zoom)

    console.log(`📐 Game camera viewport: ${viewportX}, ${viewportY}, ${viewportWidth}x${viewportHeight}, zoom: ${zoom}`)
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    // Update UI camera bounds to match new screen size
    this.uiCamera.setSize(gameSize.width, gameSize.height)

    // Recalculate game camera viewport
    this.updateGameCameraViewport()

    console.log(`🔄 Resize: ${gameSize.width}x${gameSize.height}`)
  }

  private createField() {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const margin = GAME_CONFIG.FIELD_MARGIN

    // Field background (green)
    const fieldBg = this.add.rectangle(width / 2, height / 2, width, height, 0x2d5016)
    this.gameObjects.push(fieldBg)

    // Field border
    const borderGraphics = this.add.graphics()
    borderGraphics.lineStyle(4, 0xffffff, 1)
    borderGraphics.strokeRect(margin, margin, width - margin * 2, height - margin * 2)

    // Center circle
    borderGraphics.lineStyle(2, 0xffffff, 0.5)
    borderGraphics.strokeCircle(width / 2, height / 2, 120)

    // Center line
    borderGraphics.lineBetween(width / 2, margin, width / 2, height - margin)
    this.gameObjects.push(borderGraphics)

    // Goals (white rectangles)
    const goalHeight = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN

    // Left goal (blue side)
    const leftGoal = this.add.rectangle(margin, height / 2, GAME_CONFIG.GOAL_WIDTH, goalHeight, 0xffffff).setOrigin(0, 0.5)
    this.gameObjects.push(leftGoal)

    // Right goal (red side)
    const rightGoal = this.add.rectangle(width - margin, height / 2, GAME_CONFIG.GOAL_WIDTH, goalHeight, 0xffffff).setOrigin(1, 0.5)
    this.gameObjects.push(rightGoal)

    // Goal posts
    const post1 = this.add.circle(margin, GAME_CONFIG.GOAL_Y_MIN, 10, 0xffffff)
    const post2 = this.add.circle(margin, GAME_CONFIG.GOAL_Y_MAX, 10, 0xffffff)
    const post3 = this.add.circle(width - margin, GAME_CONFIG.GOAL_Y_MIN, 10, 0xffffff)
    const post4 = this.add.circle(width - margin, GAME_CONFIG.GOAL_Y_MAX, 10, 0xffffff)
    this.gameObjects.push(post1, post2, post3, post4)

    // Make UI camera ignore all game objects
    this.gameObjects.forEach(obj => this.uiCamera.ignore(obj))
  }

  private createBall() {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    // Ball (white circle with shadow)
    const ballShadow = this.add.ellipse(width / 2 + 2, height / 2 + 3, 30, 24, 0x000000, 0.3)
    ballShadow.setDepth(15)

    this.ball = this.add.ellipse(width / 2, height / 2, 30, 30, 0xffffff)
    this.ball.setDepth(15) // Render above players

    this.gameObjects.push(ballShadow, this.ball)
    this.uiCamera.ignore([ballShadow, this.ball])
  }

  private createPlayer() {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    // Player (blue circle) - will be positioned by server in multiplayer
    // Use thicker white border to indicate user-controlled player
    this.player = this.add.circle(width / 2 - 240, height / 2, 30, 0x0066ff)
    this.player.setStrokeStyle(4, 0xffffff)

    this.gameObjects.push(this.player)
    this.uiCamera.ignore([this.player])
  }

  private createUI() {
    // UI uses viewport coordinates (actual screen size)
    const width = this.scale.width
    const height = this.scale.height

    // Score display
    this.scoreText = this.add.text(width / 2, 30, '0 - 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.scoreText.setOrigin(0.5, 0)
    this.scoreText.setScrollFactor(0)

    // Timer display
    this.timerText = this.add.text(width / 2, 70, '2:00', {
      fontSize: '24px',
      color: '#ffffff',
    })
    this.timerText.setOrigin(0.5, 0)
    this.timerText.setScrollFactor(0)

    // Controls hint (dynamic based on device)
    const controlsText = this.isMobile
      ? 'Touch Joystick to Move • Tap Button to Shoot'
      : 'Arrow Keys to Move • Space to Shoot/Pass'

    const hint = this.add.text(width / 2, height - 30, controlsText, {
      fontSize: '16px',
      color: '#aaaaaa',
    })
    hint.setOrigin(0.5, 0)
    hint.setScrollFactor(0)

    // Add UI objects and make game camera ignore them
    this.uiObjects.push(this.scoreText, this.timerText, hint)
    this.gameCamera.ignore(this.uiObjects)
  }

  private setupInput() {
    // Keyboard controls (for desktop testing)
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add space bar for action
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.shootBall(0.8)
    })
  }

  private createMobileControls() {
    // Mobile controls use viewport coordinates (actual screen size)
    const width = this.scale.width
    const height = this.scale.height

    // Virtual joystick (spawns dynamically on left half)
    this.joystick = new VirtualJoystick(this)

    // Action button (bottom-right, positioned further from edges)
    this.actionButton = new ActionButton(this, width - 120, height - 120)

    // Set up action button callback
    this.actionButton.setOnReleaseCallback((power) => {
      this.shootBall(power)
    })

    // Make game camera ignore mobile controls (they're UI elements)
    const joystickObjects = this.joystick.getGameObjects()
    const buttonObjects = this.actionButton.getGameObjects()
    this.gameCamera.ignore([...joystickObjects, ...buttonObjects])
    this.uiObjects.push(...joystickObjects, ...buttonObjects)
  }

  private shootBall(power: number = 0.8) {
    if (this.isMultiplayer && this.networkManager) {
      // Multiplayer: send action to server with power value
      this.networkManager.sendInput({ x: 0, y: 0 }, true, power) // Pass power to server
      console.log('📤 Shoot action sent to server, power:', power.toFixed(2))
    } else {
      // Single-player: apply local physics
      const dist = GeometryUtils.distance(this.player, this.ball)
      const dx = this.ball.x - this.player.x
      const dy = this.ball.y - this.player.y

      if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
        // Interpolate between min and max shoot speed based on power
        const speed = GAME_CONFIG.MIN_SHOOT_SPEED + (GAME_CONFIG.SHOOT_SPEED - GAME_CONFIG.MIN_SHOOT_SPEED) * power
        this.ballVelocity.x = (dx / dist) * speed
        this.ballVelocity.y = (dy / dist) * speed
        console.log('⚽ Shot! Power:', power.toFixed(2), 'Speed:', speed.toFixed(0))
      }
    }
  }

  shutdown() {
    // Disconnect NetworkManager to prevent stale connections
    if (this.networkManager) {
      console.log('🔌 Disconnecting NetworkManager in shutdown()')
      this.networkManager.disconnect()
      this.networkManager = null
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000 // Convert to seconds

    this.updatePlayerMovement(dt)

    // Update from server state first if multiplayer
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState()
      if (state) {
        // Update game state (score, timer, phase)
        this.updateFromServerState(state)

        // Update ball position from server
        this.updateBallFromServer()

        // Update all players from server state (including local player for reconciliation)
        state.players.forEach((player: any, sessionId: string) => {
          if (sessionId === this.mySessionId) {
            // Server reconciliation for local player
            this.reconcileLocalPlayer(player)
          } else {
            this.updateRemotePlayer(sessionId, player)
          }
        })
      }
    } else {
      // Single-player: run local physics
      this.updateBallPhysics(dt)
      this.checkCollisions()

      // Only check goals locally in single-player mode
      const goalResult = this.checkGoal()
      if (goalResult.scored && goalResult.team) {
        this.onGoalScored(goalResult.team)
      }
    }

    // Update ball color based on possession - use server possession state
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState()
      this.updateBallColor(state)
    }

    // Update mobile controls
    if (this.actionButton) {
      this.actionButton.update()
    }
  }

  /**
   * Update ball color based on possession and pressure level
   * - Ball shows team color of possessor
   * - During contesting (pressure > 0), color fades toward opponent's color
   */
  private updateBallColor(state: any) {
    if (!state || !state.ball) {
      // No state - keep ball white
      this.ball.setFillStyle(0xffffff)
      return
    }

    const possessorId = state.ball.possessedBy
    if (!possessorId) {
      // No possessor - ball is white
      this.ball.setFillStyle(0xffffff)
      return
    }

    // Get possessor's team
    const possessor = state.players.get(possessorId)
    if (!possessor) {
      this.ball.setFillStyle(0xffffff)
      return
    }

    const possessorTeam = possessor.team
    const pressureLevel = state.ball.pressureLevel || 0

    // Team colors - darkened by 30% for ball visibility
    const blueColor = 0x0047b3  // 0x0066ff darkened
    const redColor = 0xb33030   // 0xff4444 darkened

    if (pressureLevel === 0) {
      // No pressure - pure team color
      const teamColor = possessorTeam === 'blue' ? blueColor : redColor
      this.ball.setFillStyle(teamColor)
    } else {
      // Under pressure - interpolate toward opponent's color
      // pressureLevel goes from 0 to 1 (1 = about to lose possession)
      const startColor = possessorTeam === 'blue' ? blueColor : redColor
      const endColor = possessorTeam === 'blue' ? redColor : blueColor

      // Interpolate RGB channels
      const startR = (startColor >> 16) & 0xff
      const startG = (startColor >> 8) & 0xff
      const startB = startColor & 0xff

      const endR = (endColor >> 16) & 0xff
      const endG = (endColor >> 8) & 0xff
      const endB = endColor & 0xff

      const r = Math.round(startR + (endR - startR) * pressureLevel)
      const g = Math.round(startG + (endG - startG) * pressureLevel)
      const b = Math.round(startB + (endB - startB) * pressureLevel)

      const interpolatedColor = (r << 16) | (g << 8) | b
      this.ball.setFillStyle(interpolatedColor)
    }
  }

  private updatePlayerMovement(dt: number) {
    // Reset velocity
    this.playerVelocity.x = 0
    this.playerVelocity.y = 0

    // Get input from joystick (mobile) or keyboard (desktop)
    if (this.joystick && this.joystick.isPressed()) {
      // Use virtual joystick input
      const joystickInput = this.joystick.getInput()
      this.playerVelocity.x = joystickInput.x
      this.playerVelocity.y = joystickInput.y
    } else if (this.cursors) {
      // Fallback to keyboard input
      if (this.cursors.left.isDown) {
        this.playerVelocity.x = -1
      } else if (this.cursors.right.isDown) {
        this.playerVelocity.x = 1
      }

      if (this.cursors.up.isDown) {
        this.playerVelocity.y = -1
      } else if (this.cursors.down.isDown) {
        this.playerVelocity.y = 1
      }

      // Normalize diagonal movement for keyboard
      const length = Math.sqrt(
        this.playerVelocity.x * this.playerVelocity.x +
        this.playerVelocity.y * this.playerVelocity.y
      )

      if (length > 0) {
        this.playerVelocity.x /= length
        this.playerVelocity.y /= length
      }
    }

    // Calculate current velocity magnitude for visual feedback
    const velocityMagnitude = Math.sqrt(
      this.playerVelocity.x * this.playerVelocity.x +
      this.playerVelocity.y * this.playerVelocity.y
    )

    // Send input to server if multiplayer (send every frame with input)
    // Only send if there's actual movement to avoid zero-spam
    if (this.isMultiplayer && this.networkManager) {
      const hasMovement = Math.abs(this.playerVelocity.x) > 0.01 || Math.abs(this.playerVelocity.y) > 0.01

      if (hasMovement) {
        const movement = {
          x: this.playerVelocity.x,
          y: this.playerVelocity.y
        }
        this.networkManager.sendInput(movement, false) // false = not action button
      }
    }

    // Apply velocity (local prediction)
    this.player.x += this.playerVelocity.x * GAME_CONFIG.PLAYER_SPEED * dt
    this.player.y += this.playerVelocity.y * GAME_CONFIG.PLAYER_SPEED * dt

    // Clamp to field bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, GAME_CONFIG.PLAYER_MARGIN, GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_MARGIN)
    this.player.y = Phaser.Math.Clamp(this.player.y, GAME_CONFIG.PLAYER_MARGIN, GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_MARGIN)

    // Visual feedback: Tint when moving (use team color)
    if (velocityMagnitude > 0) {
      // Lighten color when moving
      const movingColor = this.playerTeamColor === 0x0066ff ? 0x0088ff : 0xff6666
      this.player.setFillStyle(movingColor)
    } else {
      this.player.setFillStyle(this.playerTeamColor)
    }
  }

  private updateBallPhysics(dt: number) {
    // Skip if multiplayer (server handles physics)
    if (this.isMultiplayer) return

    // Apply friction
    this.ballVelocity.x *= GAME_CONFIG.BALL_FRICTION
    this.ballVelocity.y *= GAME_CONFIG.BALL_FRICTION

    // Stop if velocity too low
    if (Math.abs(this.ballVelocity.x) < 1 && Math.abs(this.ballVelocity.y) < 1) {
      this.ballVelocity.x = 0
      this.ballVelocity.y = 0
    }

    // Update position
    this.ball.x += this.ballVelocity.x * dt
    this.ball.y += this.ballVelocity.y * dt

    // Bounce off field boundaries (but allow goal zones)
    const margin = GAME_CONFIG.FIELD_MARGIN

    // Left/right boundaries (exclude goal zones)
    if (this.ball.x <= margin && (this.ball.y < this.leftGoal.yMin || this.ball.y > this.leftGoal.yMax)) {
      this.ballVelocity.x *= -0.8
      this.ball.x = margin
    }
    if (this.ball.x >= GAME_CONFIG.FIELD_WIDTH - margin && (this.ball.y < this.rightGoal.yMin || this.ball.y > this.rightGoal.yMax)) {
      this.ballVelocity.x *= -0.8
      this.ball.x = GAME_CONFIG.FIELD_WIDTH - margin
    }

    // Top/bottom boundaries
    if (this.ball.y <= margin || this.ball.y >= GAME_CONFIG.FIELD_HEIGHT - margin) {
      this.ballVelocity.y *= -0.8
      this.ball.y = Phaser.Math.Clamp(this.ball.y, margin, GAME_CONFIG.FIELD_HEIGHT - margin)
    }
  }

  private checkCollisions() {
    // Simple collision: player kicks ball when close
    const dist = GeometryUtils.distance(this.player, this.ball)
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y

    if (dist < GAME_CONFIG.POSSESSION_RADIUS && dist > 0) {
      // Ball "magnetism" - stick to player slightly
      if (this.ballVelocity.x === 0 && this.ballVelocity.y === 0) {
        // Ball at rest, pull toward player
        this.ball.x = this.player.x + (dx / dist) * 25
        this.ball.y = this.player.y + (dy / dist) * 25
      }
    }
  }

  // Goal detection system
  private checkGoal(): { scored: boolean; team?: 'blue' | 'red' } {
    // Prevent multiple goal triggers
    if (this.goalScored) {
      return { scored: false }
    }

    // Check left goal (red scores when ball enters left goal)
    if (
      this.ball.x <= this.leftGoal.x + this.leftGoal.width &&
      this.ball.y >= this.leftGoal.yMin &&
      this.ball.y <= this.leftGoal.yMax
    ) {
      return { scored: true, team: 'red' }
    }

    // Check right goal (blue scores when ball enters right goal)
    if (
      this.ball.x >= this.rightGoal.x - this.rightGoal.width &&
      this.ball.y >= this.rightGoal.yMin &&
      this.ball.y <= this.rightGoal.yMax
    ) {
      return { scored: true, team: 'blue' }
    }

    return { scored: false }
  }

  private onGoalScored(team: 'blue' | 'red') {
    // Update score
    if (team === 'blue') {
      this.scoreBlue++
    } else {
      this.scoreRed++
    }

    // Update UI
    this.scoreText.setText(`${this.scoreBlue} - ${this.scoreRed}`)

    // Set goal scored flag
    this.goalScored = true

    // Log for debugging
    console.log(`⚽ Goal! ${team} scores. Score: ${this.scoreBlue}-${this.scoreRed}`)

    // Celebration effects
    const goalX = team === 'blue' ? this.rightGoal.x : this.leftGoal.x
    const goalY = this.scale.height / 2

    this.createGoalCelebration(goalX, goalY, team)
    this.flashScreen(team === 'blue' ? 0x0066ff : 0xff4444)
    this.shakeScreen()

    // Reset ball to center after celebration delay
    this.time.delayedCall(1000, () => {
      this.resetBall()
      this.goalScored = false
    })
  }

  private resetBall() {
    this.ball.x = GAME_CONFIG.FIELD_WIDTH / 2
    this.ball.y = GAME_CONFIG.FIELD_HEIGHT / 2
    this.ballVelocity.x = 0
    this.ballVelocity.y = 0
  }

  // Goal celebration effects
  private createParticleTexture() {
    // Create a simple white circle particle using Graphics
    const graphics = this.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(4, 4, 4)
    graphics.generateTexture('spark', 8, 8)
    graphics.destroy()
  }

  private createGoalCelebration(x: number, y: number, team: 'blue' | 'red') {
    // Particle color based on team
    const particleColor = team === 'blue' ? 0x0066ff : 0xff4444

    // Particle explosion at goal position
    const particles = this.add.particles(x, y, 'spark', {
      speed: { min: -400, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 600,
      gravityY: 300,
      quantity: 30,
      tint: particleColor
    })

    // Particles are game effects - ignore on UI camera
    this.uiCamera.ignore(particles)

    // Auto-destroy after animation
    this.time.delayedCall(1000, () => {
      particles.destroy()
    })
  }

  private flashScreen(color: number = 0xffffff) {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    const flash = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      color,
      0.5
    )
    flash.setDepth(1500)

    // Flash is a game effect, not UI - ignore on UI camera
    this.uiCamera.ignore(flash)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy()
    })
  }

  private shakeScreen() {
    this.gameCamera.shake(200, 0.01)
  }

  // Match timer system
  private startMatchTimer() {
    // Skip if multiplayer (server handles timer)
    if (this.isMultiplayer) return

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    })
  }

  private updateTimer() {
    // Skip if multiplayer
    if (this.isMultiplayer) return
    if (this.matchEnded) return

    this.timeRemaining--

    // Update UI (MM:SS format)
    const minutes = Math.floor(this.timeRemaining / 60)
    const seconds = this.timeRemaining % 60
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

    // Add warning color when under 30 seconds
    if (this.timeRemaining <= 30 && this.timeRemaining > 0) {
      this.timerText.setColor('#ff4444')
    }

    // Check for match end
    if (this.timeRemaining <= 0) {
      this.onMatchEnd()
    }
  }

  private onMatchEnd() {
    this.matchEnded = true

    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.remove()
    }

    // Determine winner
    const winner = this.scoreBlue > this.scoreRed ? 'Blue' :
                   this.scoreRed > this.scoreBlue ? 'Red' : 'Draw'

    console.log(`🏁 Match End! Winner: ${winner}. Final Score: ${this.scoreBlue}-${this.scoreRed}`)

    // Show end screen
    this.showMatchEndScreen(winner)
  }

  private showMatchEndScreen(winner: string) {
    // Match end screen is UI overlay - use viewport coordinates
    const width = this.scale.width
    const height = this.scale.height

    // Dark overlay
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.7
    )
    overlay.setDepth(2000)
    overlay.setScrollFactor(0)

    // Winner text
    const resultText = this.add.text(
      width / 2,
      height / 2 - 50,
      winner === 'Draw' ? 'Match Draw!' : `${winner} Team Wins!`,
      { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }
    )
    resultText.setOrigin(0.5)
    resultText.setDepth(2001)
    resultText.setScrollFactor(0)

    // Final score
    const scoreText = this.add.text(
      width / 2,
      height / 2 + 20,
      `${this.scoreBlue} - ${this.scoreRed}`,
      { fontSize: '36px', color: '#ffffff' }
    )
    scoreText.setOrigin(0.5)
    scoreText.setDepth(2001)
    scoreText.setScrollFactor(0)

    // Restart hint
    const restartText = this.add.text(
      width / 2,
      height / 2 + 80,
      'Tap to restart',
      { fontSize: '24px', color: '#aaaaaa' }
    )
    restartText.setOrigin(0.5)
    restartText.setDepth(2001)
    restartText.setScrollFactor(0)

    // Make game camera ignore UI overlay elements
    this.gameCamera.ignore([overlay, resultText, scoreText, restartText])

    // Handle restart
    this.input.once('pointerdown', () => {
      this.scene.restart()
    })
  }

  // ========== MULTIPLAYER NETWORKING METHODS ==========

  private async connectToMultiplayer() {
    try {
      // Use current hostname for server connection (works on localhost and network)
      const hostname = window.location.hostname
      const serverUrl = `ws://${hostname}:3000`

      this.networkManager = new NetworkManager({
        serverUrl,
        roomName: 'match'
      })
      await this.networkManager.connect()
      this.mySessionId = this.networkManager.getMySessionId()
      this.isMultiplayer = true

      console.log('🎮 Multiplayer mode enabled')
      console.log('📡 Session ID:', this.mySessionId)

      this.setupNetworkListeners()

      // Color will be set via stateChange event when player appears in server state

      // Stop local timer if it was started (shouldn't be, but safety check)
      if (this.timerEvent) {
        this.timerEvent.remove()
      }
    } catch (error) {
      console.warn('⚠️ Multiplayer unavailable, running single-player', error)
      this.isMultiplayer = false
      // Start local timer for single-player
      this.startMatchTimer()
    }
  }

  private setupNetworkListeners() {
    if (!this.networkManager) return

    try {
      // Player joined event
      this.networkManager.on('playerJoin', (player: any) => {
        try {
          console.log('👤 Remote player joined:', player.id, player.team)
          if (player.id !== this.mySessionId) {
            this.createRemotePlayer(player.id, player)
          }
        } catch (error) {
          console.error('[GameScene] Error handling playerJoin:', error)
        }
      })

      // Player left event
      this.networkManager.on('playerLeave', (playerId: string) => {
        try {
          console.log('👋 Remote player left:', playerId)
          this.removeRemotePlayer(playerId)
        } catch (error) {
          console.error('[GameScene] Error handling playerLeave:', error)
        }
      })

      // State change event
      this.networkManager.on('stateChange', (state: any) => {
        try {
          // Initialize player color and position on first state update when player exists
          if (!this.colorInitialized && state?.players?.has(this.mySessionId)) {
            this.updateLocalPlayerColor()

            // Sync initial position from server
            if (!this.positionInitialized) {
              this.syncLocalPlayerPosition()
              this.positionInitialized = true
            }

            this.colorInitialized = true
          }

          this.updateFromServerState(state)
        } catch (error) {
          console.error('[GameScene] Error handling stateChange:', error)
        }
      })

      // Goal scored event
      this.networkManager.on('goalScored', (data: any) => {
        try {
          console.log('⚽ Goal scored by', data.team)
          if (!this.goalScored) {
            this.onGoalScored(data.team)
          }
        } catch (error) {
          console.error('[GameScene] Error handling goalScored:', error)
        }
      })

      // Match end event
      this.networkManager.on('matchEnd', (data: any) => {
        try {
          console.log('🏁 Match ended, winner:', data.winner)
          if (!this.matchEnded) {
            this.onMatchEnd()
          }
        } catch (error) {
          console.error('[GameScene] Error handling matchEnd:', error)
        }
      })

      console.log('✅ Network listeners set up successfully')
    } catch (error) {
      console.error('[GameScene] Error setting up network listeners:', error)
    }
  }

  private createRemotePlayer(sessionId: string, playerState: any) {
    console.log('🎭 Creating remote player:', sessionId, playerState.team)

    // Determine color based on team
    const color = playerState.team === 'blue' ? 0x0066ff : 0xff4444

    // Create player sprite (circle) with standard border
    const remotePlayer = this.add.circle(
      playerState.x,
      playerState.y,
      30,
      color
    )
    remotePlayer.setStrokeStyle(2, 0xffffff)
    remotePlayer.setDepth(10)

    // Add to game objects and ignore on UI camera
    this.gameObjects.push(remotePlayer)
    this.uiCamera.ignore([remotePlayer])

    // Store references
    this.remotePlayers.set(sessionId, remotePlayer)

    console.log('✅ Remote player created:', sessionId)
  }

  private removeRemotePlayer(sessionId: string) {
    const sprite = this.remotePlayers.get(sessionId)

    if (sprite) {
      sprite.destroy()
      this.remotePlayers.delete(sessionId)
    }

    console.log('🗑️ Remote player removed:', sessionId)
  }

  private reconcileLocalPlayer(playerState: any) {
    // Adaptive server reconciliation for local player
    // Blends client prediction toward server authoritative position

    const serverX = playerState.x
    const serverY = playerState.y
    const deltaX = Math.abs(this.player.x - serverX)
    const deltaY = Math.abs(this.player.y - serverY)

    // Adaptive reconciliation factor based on error magnitude
    let reconcileFactor = 0.05 // Ultra-gentle baseline for maximum responsiveness

    if (deltaX > 50 || deltaY > 50) {
      // Large error: strong correction (likely lag spike or bounds collision mismatch)
      reconcileFactor = 0.6
    } else if (deltaX > 25 || deltaY > 25) {
      // Moderate error: moderate correction
      reconcileFactor = 0.3
    }

    // Store old position for logging
    const oldX = this.player.x
    const oldY = this.player.y

    // Blend toward server position
    this.player.x += (serverX - this.player.x) * reconcileFactor
    this.player.y += (serverY - this.player.y) * reconcileFactor

    // DEBUG: Log reconciliation (only if correction >2 pixels)
    const correctionX = Math.abs(this.player.x - oldX)
    const correctionY = Math.abs(this.player.y - oldY)
    if (correctionX > 2 || correctionY > 2) {
      console.log(
        `🔄 [Client] Local player reconciled: ` +
        `(${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}), ` +
        `server: (${serverX.toFixed(1)}, ${serverY.toFixed(1)}), ` +
        `delta: (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)}), ` +
        `factor: ${reconcileFactor}`
      )
    }
  }

  private updateRemotePlayer(sessionId: string, playerState: any) {
    const sprite = this.remotePlayers.get(sessionId)

    if (sprite) {
      // Store old position for delta logging
      const oldX = sprite.x
      const oldY = sprite.y

      // Interpolate toward server position for smooth rendering (same as ball)
      const serverX = playerState.x
      const serverY = playerState.y
      const lerpFactor = 0.3

      sprite.x += (serverX - sprite.x) * lerpFactor
      sprite.y += (serverY - sprite.y) * lerpFactor

      // DEBUG: Log player movement (only if moved >1 pixel)
      const moved = Math.abs(sprite.x - oldX) > 1 || Math.abs(sprite.y - oldY) > 1
      if (moved) {
        console.log(`🎭 [Client] Remote player ${sessionId} updated: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${sprite.x.toFixed(1)}, ${sprite.y.toFixed(1)})`)
      }
    }
  }

  private updateBallFromServer() {
    if (!this.isMultiplayer || !this.networkManager) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.ball) return

      // Store old position for delta logging
      const oldX = this.ball.x
      const oldY = this.ball.y

      const serverBallX = state.ball.x || 0
      const serverBallY = state.ball.y || 0

      // Use interpolation for smooth ball movement (hides network latency)
      // Higher lerp factor = more responsive but less smooth
      // Lower lerp factor = smoother but more latency
      const lerpFactor = 0.3

      // Interpolate ball position toward server position
      this.ball.x += (serverBallX - this.ball.x) * lerpFactor
      this.ball.y += (serverBallY - this.ball.y) * lerpFactor

      // Store velocity for visual reference (not physics)
      this.ballVelocity.x = state.ball.velocityX || 0
      this.ballVelocity.y = state.ball.velocityY || 0

      // DEBUG: Log ball position changes (only if moved >0.5 pixels)
      const moved = Math.abs(this.ball.x - oldX) > 0.5 || Math.abs(this.ball.y - oldY) > 0.5
      if (moved) {
        console.log(`⚽ [Client] Ball updated from server: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`)
        console.log(`   Server: (${serverBallX.toFixed(1)}, ${serverBallY.toFixed(1)}) | Velocity: (${this.ballVelocity.x.toFixed(1)}, ${this.ballVelocity.y.toFixed(1)})`)
      }
    } catch (error) {
      console.error('[GameScene] Error updating ball from server:', error)
    }
  }


  private updateFromServerState(state: any) {
    if (!state) return

    // DEBUG: Log state updates (only every 60th call ~2 seconds at 30fps)
    if (!this.stateUpdateCount) this.stateUpdateCount = 0
    this.stateUpdateCount++
    if (this.stateUpdateCount % 60 === 0) {
      console.log(`📥 [Client] State update #${this.stateUpdateCount}`)
      console.log(`   Score: ${state.scoreBlue || 0} - ${state.scoreRed || 0}`)
      console.log(`   Time: ${state.matchTime?.toFixed(1) || 0}s`)
      console.log(`   Phase: ${state.phase}`)
    }

    // Update score display
    this.scoreText.setText(`${state.scoreBlue || 0} - ${state.scoreRed || 0}`)

    // Update timer display
    const matchTime = state.matchTime || 0
    const minutes = Math.floor(matchTime / 60)
    const seconds = Math.floor(matchTime % 60)
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

    // Update timer color (warning when < 30 seconds)
    if (matchTime <= 30 && matchTime > 0) {
      this.timerText.setColor('#ff4444')
    } else {
      this.timerText.setColor('#ffffff')
    }

    // Check if match ended (phase === 'ended')
    if (state.phase === 'ended' && !this.matchEnded) {
      this.matchEnded = true
      // Determine winner from score
      const winner = state.scoreBlue > state.scoreRed ? 'blue' : 'red'
      this.showMatchEndScreen(winner)
    }
  }

  private updateLocalPlayerColor() {
    if (!this.isMultiplayer || !this.networkManager || !this.mySessionId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      // Get local player's team from server state
      const localPlayer = state.players.get(this.mySessionId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state')
        return
      }

      // Set color based on team and store it
      this.playerTeamColor = localPlayer.team === 'blue' ? 0x0066ff : 0xff4444
      this.player.setFillStyle(this.playerTeamColor)

      // Update mobile control colors to match team color
      if (this.joystick) {
        this.joystick.setTeamColor(this.playerTeamColor)
      }
      if (this.actionButton) {
        this.actionButton.setTeamColor(this.playerTeamColor)
      }

      console.log(`🎨 [Client] Local player color set to ${localPlayer.team} (${this.playerTeamColor.toString(16)})`)
    } catch (error) {
      console.error('[GameScene] Error updating local player color:', error)
    }
  }

  private syncLocalPlayerPosition() {
    if (!this.isMultiplayer || !this.networkManager || !this.mySessionId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      // Get local player's position from server state
      const localPlayer = state.players.get(this.mySessionId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state for position sync')
        return
      }

      // Sync local sprite with server position
      this.player.setPosition(localPlayer.x, localPlayer.y)

      console.log(
        `📍 [Client] Synced local player position: (${localPlayer.x}, ${localPlayer.y}) ` +
        `Team: ${localPlayer.team}`
      )
    } catch (error) {
      console.error('[GameScene] Error syncing local player position:', error)
    }
  }
}
