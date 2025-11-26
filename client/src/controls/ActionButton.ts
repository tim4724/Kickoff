/**
 * Action Button for mobile touch controls
 * Bottom-right corner button for pass/shoot actions
 * Activates only in right half of screen to avoid conflicts with joystick
 */

import { HapticFeedback } from '../utils/HapticFeedback'
import { gameClock } from '@shared/engine/GameClock'

export class ActionButton {
  private scene: Phaser.Scene
  private button!: Phaser.GameObjects.Arc
  private label!: Phaser.GameObjects.Text
  private pointerId: number = -1 // Track pointer ID for multi-touch

  private x: number
  private y: number
  private screenWidth: number
  private radius: number = 50

  private isPressed: boolean = false
  private pressStartTime: number = 0

  // Team color for button styling
  private teamColor: number = 0xff4444 // Default red, updated via setTeamColor()
  private teamColorLight: number = 0xff6666 // Lighter variant

  // Callbacks
  private onPressCallback?: () => void
  private onReleaseCallback?: (power: number) => void

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.screenWidth = scene.scale.width

    // Scale button based on screen size (6% of screen height)
    this.radius = Math.max(50, Math.min(scene.scale.height * 0.06, 80))

    this.x = x
    this.y = y

    this.createButton()
    this.setupInput()
  }

  private createButton() {
    // Button circle - color will be set to team color via setTeamColor()
    this.button = this.scene.add.circle(this.x, this.y, this.radius, 0xff4444, 0.6)
    this.button.setStrokeStyle(3, 0xff6666, 0.7)
    this.button.setDepth(1000)
    this.button.setScrollFactor(0)

    // Label - removed football icon per user request
    this.label = this.scene.add.text(this.x, this.y, '', {
      fontSize: '32px',
      color: '#ffffff',
    })
    this.label.setOrigin(0.5, 0.5)
    this.label.setDepth(1001)
    this.label.setScrollFactor(0)
  }

  /**
   * Update button colors to match team color
   * @param color - Team color (hex)
   */
  public setTeamColor(color: number) {
    console.log(`🎨 [ActionButton] setTeamColor called with ${color.toString(16)}`)
    this.teamColor = color

    // Calculate lighter stroke color (add 0x222222 to make it brighter)
    this.teamColorLight = Math.min(color + 0x222222, 0xffffff)

    // Update button to use team color - force update with explicit fill
    if (this.button) {
      this.button.fillColor = this.teamColor
      this.button.fillAlpha = 0.6
      this.button.setFillStyle(this.teamColor, 0.6)
      this.button.setStrokeStyle(3, this.teamColorLight, 0.7)
      console.log(`🎨 [ActionButton] Button color updated to ${this.button.fillColor.toString(16)}`)
    }
  }

  private setupInput() {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Skip if button already pressed by different pointer
      if (this.isPressed && this.pointerId !== pointer.id) {
        return
      }

      // ZONE CHECK: Only activate in right half of screen
      if (pointer.x < this.screenWidth / 2) {
        return // Left half = joystick territory
      }

      // Re-anchor to touch point (symmetric free placement on right side)
      this.setPosition(pointer.x, pointer.y)
      this.pointerId = pointer.id
      this.onPress()
    })

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Only respond to our tracked pointer
      if (pointer.id === this.pointerId && this.isPressed) {
        this.onRelease()
      }
    })
  }

  private onPress() {
    this.isPressed = true
    this.pressStartTime = gameClock.now()

    // Visual feedback - use lighter team color when pressed
    this.button.setFillStyle(this.teamColorLight, 0.7)
    this.button.setScale(0.9)

    // Haptic feedback on press
    HapticFeedback.light()

    // Callback
    if (this.onPressCallback) {
      this.onPressCallback()
    }
  }

  private onRelease() {
    this.isPressed = false
    const holdDurationMs = gameClock.now() - this.pressStartTime
    const holdDuration = holdDurationMs / 1000 // Convert to seconds

    // Reset visual - use team color
    this.button.setFillStyle(this.teamColor, 0.6)
    this.button.setScale(1)
    this.button.setStrokeStyle(3, this.teamColorLight, 0.7) // Reset to normal stroke

    // Calculate power based on hold duration
    const power = Math.min(holdDuration / 1.0, 1)

    // Haptic feedback on release (medium for shooting action)
    HapticFeedback.medium()

    // Trigger release callback with power
    if (this.onReleaseCallback) {
      this.onReleaseCallback(power)
    }

    this.pointerId = -1
  }

  /**
   * Set callback for when button is pressed
   */
  public setOnPressCallback(callback: () => void) {
    this.onPressCallback = callback
  }

  /**
   * Set callback for when button is released
   * @param callback - Receives power value (0-1) based on hold duration
   */
  public setOnReleaseCallback(callback: (power: number) => void) {
    this.onReleaseCallback = callback
  }

  /**
   * Get current power level if button is being held
   */
  public getPower(): number {
    if (!this.isPressed) return 0

    const duration = (gameClock.now() - this.pressStartTime) / 1000
    return Math.min(duration / 1.0, 1)
  }

  /**
   * Check if button is currently pressed
   */
  public isPressing(): boolean {
    return this.isPressed
  }

  /**
   * Get all game objects for camera ignore lists
   */
  public getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [this.button, this.label]
  }

  /**
   * Update button position and screen width when window resizes
   * @param newWidth - New screen width
   * @param newHeight - New screen height
   */
  public resize(newWidth: number, newHeight: number) {
    // Update screen width for hit detection
    this.screenWidth = newWidth

    // Re-anchor to a symmetric default on the right side if not pressed
    if (!this.isPressed) {
      this.x = Math.min(newWidth - 70, Math.max(newWidth * 0.82, newWidth / 2 + 70))
      this.y = Math.max(100, newHeight * 0.8)
    }

    // Update button and label positions
    this.button.setPosition(this.x, this.y)
    this.label.setPosition(this.x, this.y)
  }

  /**
   * Manually set button position (used when user taps to move it)
   */
  public setPosition(newX: number, newY: number) {
    this.x = newX
    this.y = newY
    this.button.setPosition(this.x, this.y)
    this.label.setPosition(this.x, this.y)
  }

  /**
   * Update power indicator visual (called every frame)
   */
  public update() {
    if (this.isPressed) {
      const power = this.getPower()
      // Enhanced pulse effect based on power (more pronounced scaling)
      const scale = 0.85 + power * 0.3
      this.button.setScale(scale)

      // Change color intensity based on power (starts from new base 0.6)
      const alpha = 0.6 + power * 0.4
      this.button.setAlpha(alpha)

      // Add outer glow ring for charging effect
      const glowSize = 3 + power * 5 // Stroke width grows from 3 to 8
      const glowAlpha = 0.4 + power * 0.6 // Glow becomes more visible
      this.button.setStrokeStyle(glowSize, this.teamColorLight, glowAlpha)
    } else {
      // Reset to base state
      this.button.setScale(1.0)
      this.button.setAlpha(0.6)
      this.button.setStrokeStyle(3, this.teamColorLight, 0.7)
    }
  }

  /**
   * Clean up resources
   */
  public destroy() {
    this.button.destroy()
    this.label.destroy()
    this.scene.input.off('pointerdown')
    this.scene.input.off('pointerup')
  }

  // ============================================
  // TESTING API - For automated testing only
  // ============================================

  /**
   * Simulate button press (testing only)
   */
  public __test_simulatePress() {
    if (!this.scene) return
    this.onPress()
  }

  /**
   * Simulate button release after delay (testing only)
   * @param holdDurationMs - How long button was held (milliseconds)
   */
  public __test_simulateRelease(holdDurationMs: number = 0) {
    if (!this.isPressed) return

    const holdDuration = holdDurationMs / 1000
    const power = Math.min(holdDuration / 1.0, 1)

    // Reset visual - use team color
    this.button.setFillStyle(this.teamColor, 0.6)
    this.button.setScale(1)
    this.button.setStrokeStyle(3, this.teamColorLight, 0.7)

    // Trigger callback
    if (this.onReleaseCallback) {
      this.onReleaseCallback(power)
    }

    this.isPressed = false
    this.pointerId = -1
  }

  /**
   * Get current button state (testing only)
   */
  public __test_getState() {
    return {
      pressed: this.isPressed,
      x: this.x,
      y: this.y,
      radius: this.radius,
      currentPower: this.getPower(),
    }
  }
}
