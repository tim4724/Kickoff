import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private ball!: Phaser.GameObjects.Ellipse
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private scoreText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text

  private playerVelocity = { x: 0, y: 0 }
  private ballVelocity = { x: 0, y: 0 }

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.createField()
    this.createBall()
    this.createPlayer()
    this.createUI()
    this.setupInput()

    console.log('⚽ Game scene ready!')
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

    // Controls hint
    this.add.text(this.scale.width / 2, this.scale.height - 30, 'Arrow Keys to Move • Space to Shoot/Pass', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0)
  }

  private setupInput() {
    // Keyboard controls (for testing)
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add space bar for action
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.shootBall()
    })
  }

  private shootBall() {
    // Calculate shoot direction (from player to ball direction)
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Only shoot if close to ball
    if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
      const power = 0.8 // Fixed power for now
      this.ballVelocity.x = (dx / dist) * GAME_CONFIG.SHOOT_SPEED * power
      this.ballVelocity.y = (dy / dist) * GAME_CONFIG.SHOOT_SPEED * power

      console.log('⚽ Shot!')
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000 // Convert to seconds

    this.updatePlayerMovement(dt)
    this.updateBallPhysics(dt)
    this.checkCollisions()
  }

  private updatePlayerMovement(dt: number) {
    // Reset velocity
    this.playerVelocity.x = 0
    this.playerVelocity.y = 0

    // Apply keyboard input
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

    // Normalize diagonal movement
    const length = Math.sqrt(
      this.playerVelocity.x * this.playerVelocity.x +
      this.playerVelocity.y * this.playerVelocity.y
    )

    if (length > 0) {
      this.playerVelocity.x /= length
      this.playerVelocity.y /= length
    }

    // Apply velocity
    this.player.x += this.playerVelocity.x * GAME_CONFIG.PLAYER_SPEED * dt
    this.player.y += this.playerVelocity.y * GAME_CONFIG.PLAYER_SPEED * dt

    // Clamp to field bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, 30, this.scale.width - 30)
    this.player.y = Phaser.Math.Clamp(this.player.y, 30, this.scale.height - 30)

    // Visual feedback: Tint when moving
    if (length > 0) {
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
