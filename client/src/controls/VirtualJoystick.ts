/**
 * Virtual Joystick for mobile touch controls
 * Spawns dynamically at touch position on left half of screen
 */

import { HapticFeedback } from '../utils/HapticFeedback'

export class VirtualJoystick {
  private scene: Phaser.Scene
  private base!: Phaser.GameObjects.Arc
  private stick!: Phaser.GameObjects.Arc
  private pointerId: number = -1 // Track pointer ID for multi-touch

  private baseX: number = 0
  private baseY: number = 0
  private screenWidth: number
  private maxRadius: number = 60
  private deadZone: number = 0.1

  private isActive: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.screenWidth = scene.scale.width

    // Scale joystick based on screen size (5% of screen height)
    this.maxRadius = Math.max(50, Math.min(scene.scale.height * 0.05, 80))

    this.createJoystick()
    this.setupInput()
  }

  private createJoystick() {
    // Base circle (outer ring) - initially at (0, 0), will be repositioned on touch
    // Color will be set to team color via setTeamColor()
    this.base = this.scene.add.circle(0, 0, this.maxRadius, 0x333333, 0.5)
    this.base.setStrokeStyle(3, 0x666666, 0.7)
    this.base.setDepth(1000)
    this.base.setScrollFactor(0) // Fixed to camera

    // Stick circle (inner control)
    // Color will be set to team color via setTeamColor()
    this.stick = this.scene.add.circle(0, 0, this.maxRadius * 0.5, 0x0066ff, 0.8)
    this.stick.setStrokeStyle(2, 0xffffff, 1.0)
    this.stick.setDepth(1001)
    this.stick.setScrollFactor(0)

    // Hide by default
    this.setVisible(false)
  }

  /**
   * Update joystick colors to match team color
   * @param color - Team color (hex)
   */
  public setTeamColor(color: number) {
    // Update base to use team color with lower opacity
    this.base.setFillStyle(color, 0.5)

    // Calculate lighter stroke color (add 0x222222 to make it brighter)
    const lighterColor = Math.min(color + 0x222222, 0xffffff)
    this.base.setStrokeStyle(3, lighterColor, 0.7)

    // Update stick to use team color
    this.stick.setFillStyle(color, 0.8)
  }

  private setupInput() {
    // Listen for touch/click - spawn joystick at touch position in left half
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Skip if joystick already active with different pointer
      if (this.isActive && this.pointerId !== pointer.id) {
        return
      }

      // ZONE CHECK: Only activate in left half of screen
      if (pointer.x >= this.screenWidth / 2) {
        return // Right half = button territory
      }

      // EXCLUSION ZONE: Don't activate in back button area (top-left corner)
      // Back button is at (10, 10) with size 100x40, add margin for safety
      const BACK_BUTTON_EXCLUSION_WIDTH = 120
      const BACK_BUTTON_EXCLUSION_HEIGHT = 60
      if (pointer.x < BACK_BUTTON_EXCLUSION_WIDTH && pointer.y < BACK_BUTTON_EXCLUSION_HEIGHT) {
        return // Top-left corner = back button territory
      }

      // Spawn joystick at touch position
      this.baseX = pointer.x
      this.baseY = pointer.y

      // Clamp position to prevent off-screen rendering (70px margins)
      const margin = 70
      this.baseX = Phaser.Math.Clamp(this.baseX, margin, this.screenWidth / 2 - margin)
      this.baseY = Phaser.Math.Clamp(this.baseY, margin, this.scene.scale.height - margin)

      // Reposition visual elements to spawn point
      this.repositionJoystick(this.baseX, this.baseY)

      // Activate joystick and track pointer ID
      this.pointerId = pointer.id
      this.isActive = true
      this.setVisible(true)

      // Haptic feedback on touch
      HapticFeedback.light()
    })

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Only respond to our tracked pointer
      if (this.isActive && pointer.id === this.pointerId) {
        this.updateStickPosition(pointer.x, pointer.y)
      }
    })

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Only respond to our tracked pointer
      if (pointer.id === this.pointerId) {
        this.reset()
      }
    })
  }

  /**
   * Reposition joystick base and stick to new location
   * @param x - New base X position
   * @param y - New base Y position
   */
  private repositionJoystick(x: number, y: number) {
    this.baseX = x
    this.baseY = y

    // Move base circle
    this.base.x = x
    this.base.y = y

    // Reset stick to center of base
    this.stick.x = x
    this.stick.y = y
  }

  private updateStickPosition(x: number, y: number) {
    const dx = x - this.baseX
    const dy = y - this.baseY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > this.maxRadius) {
      // Clamp to max radius
      const angle = Math.atan2(dy, dx)
      this.stick.x = this.baseX + Math.cos(angle) * this.maxRadius
      this.stick.y = this.baseY + Math.sin(angle) * this.maxRadius
    } else {
      this.stick.x = x
      this.stick.y = y
    }
  }

  private reset() {
    this.pointerId = -1
    this.isActive = false
    this.stick.x = this.baseX
    this.stick.y = this.baseY
    this.setVisible(false)
  }

  private setVisible(visible: boolean) {
    this.base.setVisible(visible)
    this.stick.setVisible(visible)
  }

  /**
   * Get normalized joystick input (-1 to 1 for both x and y)
   */
  public getInput(): { x: number; y: number } {
    if (!this.isActive) {
      return { x: 0, y: 0 }
    }

    const dx = this.stick.x - this.baseX
    const dy = this.stick.y - this.baseY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Apply dead zone
    if (distance < this.maxRadius * this.deadZone) {
      return { x: 0, y: 0 }
    }

    // Normalize to -1 to 1 range
    const normalizedX = dx / this.maxRadius
    const normalizedY = dy / this.maxRadius

    return {
      x: Phaser.Math.Clamp(normalizedX, -1, 1),
      y: Phaser.Math.Clamp(normalizedY, -1, 1),
    }
  }

  /**
   * Check if joystick is currently being used
   */
  public isPressed(): boolean {
    return this.isActive
  }

  /**
   * Get all game objects for camera ignore lists
   */
  public getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [this.base, this.stick]
  }

  /**
   * Update screen width when window resizes
   * @param newWidth - New screen width
   */
  public resize(newWidth: number) {
    // Update screen width for left-half zone detection
    this.screenWidth = newWidth

    // If joystick is currently active, reposition it to ensure it stays within bounds
    if (this.isActive) {
      const margin = 70
      // Ensure base position stays within new screen bounds
      this.baseX = Phaser.Math.Clamp(this.baseX, margin, newWidth / 2 - margin)
      // Don't update Y here as screen height isn't passed, base will remain valid

      // Reposition visual elements
      this.base.x = this.baseX
      this.base.y = this.baseY

      // Keep stick at current relative position
      const currentDx = this.stick.x - this.base.x
      const currentDy = this.stick.y - this.base.y
      this.stick.x = this.baseX + currentDx
      this.stick.y = this.baseY + currentDy
    }
  }

  /**
   * Clean up resources
   */
  public destroy() {
    this.base.destroy()
    this.stick.destroy()
    this.scene.input.off('pointerdown')
    this.scene.input.off('pointermove')
    this.scene.input.off('pointerup')
  }

  // ============================================
  // TESTING API - For automated testing only
  // ============================================

  /**
   * Simulate touch at position (testing only)
   * @param x - Touch X coordinate
   * @param y - Touch Y coordinate
   */
  public __test_simulateTouch(x: number, y: number) {
    if (!this.scene) return

    // Apply same exclusion rules as setupInput()
    if (x >= this.screenWidth / 2) {
      return // Right half = button territory
    }

    const BACK_BUTTON_EXCLUSION_WIDTH = 120
    const BACK_BUTTON_EXCLUSION_HEIGHT = 60
    if (x < BACK_BUTTON_EXCLUSION_WIDTH && y < BACK_BUTTON_EXCLUSION_HEIGHT) {
      return // Top-left corner = back button territory
    }

    // Simulate left-half touch
    const margin = 70
    this.baseX = Phaser.Math.Clamp(x, margin, this.screenWidth / 2 - margin)
    this.baseY = Phaser.Math.Clamp(y, margin, this.scene.scale.height - margin)
    this.repositionJoystick(this.baseX, this.baseY)
    this.isActive = true
    this.setVisible(true)
  }

  /**
   * Simulate drag to position (testing only)
   * @param x - Drag X coordinate
   * @param y - Drag Y coordinate
   */
  public __test_simulateDrag(x: number, y: number) {
    if (!this.isActive) return
    this.updateStickPosition(x, y)
  }

  /**
   * Simulate touch release (testing only)
   */
  public __test_simulateRelease() {
    this.reset()
  }

  /**
   * Get current joystick state (testing only)
   */
  public __test_getState() {
    return {
      active: this.isActive,
      baseX: this.baseX,
      baseY: this.baseY,
      stickX: this.stick.x,
      stickY: this.stick.y,
      input: this.getInput(),
    }
  }
}
