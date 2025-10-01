import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'
import { VirtualJoystick } from '../controls/VirtualJoystick'
import { ActionButton } from '../controls/ActionButton'

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private ball!: Phaser.GameObjects.Ellipse
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private scoreText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text

  // Mobile controls
  private joystick!: VirtualJoystick
  private actionButton!: ActionButton
  private isMobile: boolean = false

  private playerVelocity = { x: 0, y: 0 }
  private ballVelocity = { x: 0, y: 0 }

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    // Detect mobile device
    this.isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS ||
                    this.sys.game.device.os.iPad || this.sys.game.device.os.iPhone

    this.createField()
    this.createBall()
    this.createPlayer()
    this.createUI()
    this.setupInput()
    this.createMobileControls()

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

  private createField() {
    const { width, height } = this.scale

    // Field background (green)
    this.add.rectangle(width / 2, height / 2, width, height, 0x2d5016)

    // Field border
    const borderGraphics = this.add.graphics()
    borderGraphics.lineStyle(4, 0xffffff, 1)
    borderGraphics.strokeRect(10, 10, width - 20, height - 20)

    // Center circle
    borderGraphics.lineStyle(2, 0xffffff, 0.5)
    borderGraphics.strokeCircle(width / 2, height / 2, 60)

    // Center line
    borderGraphics.lineBetween(width / 2, 10, width / 2, height - 10)

    // Goals (white rectangles)
    // Left goal (blue side)
    this.add.rectangle(10, height / 2, 20, 120, 0xffffff).setOrigin(0, 0.5)

    // Right goal (red side)
    this.add.rectangle(width - 10, height / 2, 20, 120, 0xffffff).setOrigin(1, 0.5)

    // Goal posts
    this.add.circle(10, height / 2 - 60, 5, 0xffffff)
    this.add.circle(10, height / 2 + 60, 5, 0xffffff)
    this.add.circle(width - 10, height / 2 - 60, 5, 0xffffff)
    this.add.circle(width - 10, height / 2 + 60, 5, 0xffffff)
  }

  private createBall() {
    const { width, height } = this.scale

    // Ball (white circle with shadow)
    this.add.ellipse(width / 2 + 2, height / 2 + 3, 20, 16, 0x000000, 0.3) // Shadow
    this.ball = this.add.ellipse(width / 2, height / 2, 20, 20, 0xffffff)
  }

  private createPlayer() {
    const { width, height } = this.scale

    // Player (blue rectangle with rounded corners)
    this.player = this.add.rectangle(width / 2 - 100, height / 2, 30, 40, 0x0066ff)
    this.player.setStrokeStyle(2, 0xffffff)

    // Player indicator (small circle on top)
    const indicator = this.add.circle(0, -25, 8, 0xffff00)
    this.add.container(this.player.x, this.player.y, [indicator])
  }

  private createUI() {
    // Score display
    this.scoreText = this.add.text(this.scale.width / 2, 30, '0 - 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.scoreText.setOrigin(0.5, 0)

    // Timer display
    this.timerText = this.add.text(this.scale.width / 2, 70, '2:00', {
      fontSize: '24px',
      color: '#ffffff',
    })
    this.timerText.setOrigin(0.5, 0)

    // Controls hint (dynamic based on device)
    const controlsText = this.isMobile
      ? 'Touch Joystick to Move • Tap Button to Shoot'
      : 'Arrow Keys to Move • Space to Shoot/Pass'

    this.add.text(this.scale.width / 2, this.scale.height - 30, controlsText, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0)
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
    const { width, height } = this.scale

    // Virtual joystick (spawns dynamically on left half)
    this.joystick = new VirtualJoystick(this)

    // Action button (bottom-right, activates only in right half)
    this.actionButton = new ActionButton(this, width - 80, height - 100)

    // Set up action button callback
    this.actionButton.setOnReleaseCallback((power) => {
      this.shootBall(power)
    })
  }

  private shootBall(power: number = 0.8) {
    // Calculate shoot direction (from player to ball direction)
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Only shoot if close to ball
    if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
      this.ballVelocity.x = (dx / dist) * GAME_CONFIG.SHOOT_SPEED * power
      this.ballVelocity.y = (dy / dist) * GAME_CONFIG.SHOOT_SPEED * power

      console.log('⚽ Shot! Power:', power.toFixed(2))
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000 // Convert to seconds

    this.updatePlayerMovement(dt)
    this.updateBallPhysics(dt)
    this.checkCollisions()

    // Update mobile controls
    if (this.actionButton) {
      this.actionButton.update()
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
    } else {
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

    // Apply velocity
    this.player.x += this.playerVelocity.x * GAME_CONFIG.PLAYER_SPEED * dt
    this.player.y += this.playerVelocity.y * GAME_CONFIG.PLAYER_SPEED * dt

    // Clamp to field bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, 30, this.scale.width - 30)
    this.player.y = Phaser.Math.Clamp(this.player.y, 30, this.scale.height - 30)

    // Visual feedback: Tint when moving
    if (velocityMagnitude > 0) {
      this.player.setFillStyle(0x0088ff)
    } else {
      this.player.setFillStyle(0x0066ff)
    }
  }

  private updateBallPhysics(dt: number) {
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

    // Bounce off field boundaries
    const margin = 20
    if (this.ball.x <= margin || this.ball.x >= this.scale.width - margin) {
      this.ballVelocity.x *= -0.8
      this.ball.x = Phaser.Math.Clamp(this.ball.x, margin, this.scale.width - margin)
    }

    if (this.ball.y <= margin || this.ball.y >= this.scale.height - margin) {
      this.ballVelocity.y *= -0.8
      this.ball.y = Phaser.Math.Clamp(this.ball.y, margin, this.scale.height - margin)
    }
  }

  private checkCollisions() {
    // Simple collision: player kicks ball when close
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < GAME_CONFIG.POSSESSION_RADIUS && dist > 0) {
      // Ball "magnetism" - stick to player slightly
      if (this.ballVelocity.x === 0 && this.ballVelocity.y === 0) {
        // Ball at rest, pull toward player
        this.ball.x = this.player.x + (dx / dist) * 25
        this.ball.y = this.player.y + (dy / dist) * 25
      }
    }
  }
}
