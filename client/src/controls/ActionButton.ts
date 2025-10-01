/**
 * Action Button for mobile touch controls
 * Bottom-right corner button for pass/shoot actions
 * Activates only in right half of screen to avoid conflicts with joystick
 */

export class ActionButton {
  private scene: Phaser.Scene
  private button!: Phaser.GameObjects.Circle
  private label!: Phaser.GameObjects.Text
  private pointer: Phaser.Input.Pointer | null = null

  private x: number
  private y: number
  private screenWidth: number
  private radius: number = 50

  private isPressed: boolean = false
  private pressStartTime: number = 0
  private holdDuration: number = 0

  // Callbacks
  private onPressCallback?: () => void
  private onReleaseCallback?: (power: number) => void

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.screenWidth = scene.scale.width

    this.createButton()
    this.setupInput()
  }

  private createButton() {
    // Button circle
    this.button = this.scene.add.circle(this.x, this.y, this.radius, 0xff4444, 0.4)
    this.button.setStrokeStyle(3, 0xff6666, 0.7)
    this.button.setDepth(1000)
    this.button.setScrollFactor(0)

    // Label
    this.label = this.scene.add.text(this.x, this.y, '⚽', {
      fontSize: '32px',
      color: '#ffffff',
    })
    this.label.setOrigin(0.5, 0.5)
    this.label.setDepth(1001)
    this.label.setScrollFactor(0)
  }

  private setupInput() {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // ZONE CHECK: Only activate in right half of screen
      if (pointer.x < this.screenWidth / 2) {
        return // Left half = joystick territory
      }

      // Check distance from button center
      const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.x, this.y)

      if (distance < this.radius + 20) {
        this.pointer = pointer
        this.onPress()
      }
    })

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.pointer === pointer && this.isPressed) {
        this.onRelease()
      }
    })
  }

  private onPress() {
    this.isPressed = true
    this.pressStartTime = Date.now()

    // Visual feedback
    this.button.setFillStyle(0xff6666, 0.7)
    this.button.setScale(0.9)

    // Callback
    if (this.onPressCallback) {
      this.onPressCallback()
    }
  }

  private onRelease() {
    this.isPressed = false
    this.holdDuration = (Date.now() - this.pressStartTime) / 1000 // Convert to seconds

    // Calculate power (0 to 1) based on hold duration (max 1.5 seconds)
    const power = Math.min(this.holdDuration / 1.5, 1)

    // Reset visual
    this.button.setFillStyle(0xff4444, 0.4)
    this.button.setScale(1)

    // Callback
    if (this.onReleaseCallback) {
      this.onReleaseCallback(power)
    }

    this.pointer = null
    this.holdDuration = 0
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

    const duration = (Date.now() - this.pressStartTime) / 1000
    return Math.min(duration / 1.5, 1)
  }

  /**
   * Check if button is currently pressed
   */
  public isPressing(): boolean {
    return this.isPressed
  }

  /**
   * Update power indicator visual (called every frame)
   */
  public update() {
    if (this.isPressed) {
      const power = this.getPower()
      // Pulse effect based on power
      const scale = 0.9 + power * 0.2
      this.button.setScale(scale)

      // Change color intensity based on power
      const alpha = 0.4 + power * 0.4
      this.button.setAlpha(alpha)
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

    // Manually set hold duration for testing
    this.holdDuration = holdDurationMs / 1000
    const power = Math.min(this.holdDuration / 1.5, 1)

    // Reset visual
    this.button.setFillStyle(0xff4444, 0.4)
    this.button.setScale(1)

    // Trigger callback
    if (this.onReleaseCallback) {
      this.onReleaseCallback(power)
    }

    this.isPressed = false
    this.pointer = null
    this.holdDuration = 0
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
      holdDuration: this.holdDuration,
    }
  }
}
