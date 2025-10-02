/**
 * Virtual Joystick for mobile touch controls
 * Spawns dynamically at touch position on left half of screen
 */

export class VirtualJoystick {
  private scene: Phaser.Scene
  private base!: Phaser.GameObjects.Arc
  private stick!: Phaser.GameObjects.Arc
  private pointer: Phaser.Input.Pointer | null = null

  private baseX: number = 0
  private baseY: number = 0
  private screenWidth: number
  private maxRadius: number = 60
  private deadZone: number = 0.2

  private isActive: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.screenWidth = scene.scale.width

    this.createJoystick()
    this.setupInput()
  }

  private createJoystick() {
    // Base circle (outer ring) - initially at (0, 0), will be repositioned on touch
    this.base = this.scene.add.circle(0, 0, this.maxRadius, 0x333333, 0.3)
    this.base.setStrokeStyle(3, 0x666666, 0.5)
    this.base.setDepth(1000)
    this.base.setScrollFactor(0) // Fixed to camera

    // Stick circle (inner control)
    this.stick = this.scene.add.circle(0, 0, 30, 0x0066ff, 0.6)
    this.stick.setStrokeStyle(2, 0xffffff, 0.8)
    this.stick.setDepth(1001)
    this.stick.setScrollFactor(0)

    // Hide by default
    this.setVisible(false)
  }

  private setupInput() {
    // Listen for touch/click - spawn joystick at touch position in left half
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // ZONE CHECK: Only activate in left half of screen
      if (pointer.x >= this.screenWidth / 2) {
        return // Right half = button territory
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

      // Activate joystick
      this.pointer = pointer
      this.isActive = true
      this.setVisible(true)
    })

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointer === pointer && this.isActive) {
        this.updateStickPosition(pointer.x, pointer.y)
      }
    })

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.pointer === pointer) {
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
    this.pointer = null
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

    // Simulate left-half touch
    if (x < this.screenWidth / 2) {
      const margin = 70
      this.baseX = Phaser.Math.Clamp(x, margin, this.screenWidth / 2 - margin)
      this.baseY = Phaser.Math.Clamp(y, margin, this.scene.scale.height - margin)
      this.repositionJoystick(this.baseX, this.baseY)
      this.isActive = true
      this.setVisible(true)
    }
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
