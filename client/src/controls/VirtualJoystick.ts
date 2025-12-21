/**
 * Virtual Joystick for mobile touch controls (PixiJS)
 * Spawns dynamically at touch position on left half of screen
 */

import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { GeometryUtils } from '@shared/utils/geometry'
import { HapticFeedback } from '@/utils/HapticFeedback'
import { PixiScene } from '@/utils/PixiScene'

export class VirtualJoystick {
  private scene: PixiScene
  private base!: Graphics
  private stick!: Graphics
  private pointerId: number = -1 // Track pointer ID for multi-touch

  private baseX: number = 0
  private baseY: number = 0
  private screenWidth: number
  private screenHeight: number
  private maxRadius: number = 60
  private deadZone: number = 0.1
  private teamColor: number = 0x0066ff

  private isActive: boolean = false

  public container: Container

  constructor(scene: PixiScene) {
    this.scene = scene
    this.screenWidth = scene.app.screen.width
    this.screenHeight = scene.app.screen.height
    this.container = new Container()
    scene.container.addChild(this.container)

    // Scale joystick based on screen size (5% of screen height)
    this.maxRadius = Math.max(50, Math.min(this.screenHeight * 0.05, 80))
    // Default starting position (left/bottom quadrant)
    this.baseX = Math.max(60, this.screenWidth * 0.18)
    this.baseY = Math.max(120, this.screenHeight * 0.7)

    this.createJoystick()
    this.repositionJoystick(this.baseX, this.baseY)
    this.setupInput()
  }

  private createJoystick() {
    this.base = new Graphics()
    this.stick = new Graphics()

    this.container.addChild(this.base)
    this.container.addChild(this.stick)

    // Initial draw
    this.drawJoystick()

    // Ensure they are visible
    this.setVisible(true)
  }

  private drawJoystick() {
    // Draw Base
    this.base.clear()
    this.base.circle(0, 0, this.maxRadius)
    this.base.fill({ color: this.teamColor, alpha: 0.6 })
    this.base.stroke({ width: 3, color: this.teamColor, alpha: 0.8 })

    // Draw Stick
    this.stick.clear()
    this.stick.circle(0, 0, this.maxRadius * 0.5)
    this.stick.fill({ color: this.teamColor, alpha: 0.6 })
    this.stick.stroke({ width: 2, color: this.teamColor, alpha: 0.8 })
  }

  /**
   * Update joystick colors to match team color
   * @param color - Team color (hex)
   */
  public setTeamColor(color: number) {
    this.teamColor = color
    this.drawJoystick()
  }

  private setupInput() {
    // PixiJS handles events differently. We should attach listeners to the stage or a full-screen interactive hit area.
    // The safest bet is the stage for global input, or a large background rectangle.
    // Assuming scene.app.stage is interactive or we make a hit area.

    // We'll attach to the scene's main container but we need to ensure it has a hit area covering the screen.
    // Ideally, the scene background does this.
    // But for safety, let's attach to `this.scene.app.stage` event if possible, or use a global interaction manager.
    // The issue is that `stage` events bubble.

    // Let's rely on the scene passing us the pointer events or attach to the global stage for 'pointerdown'.

    // Using `this.scene.app.stage` requires `eventMode = 'static'` on stage.
    this.scene.app.stage.eventMode = 'static';
    this.scene.app.stage.hitArea = this.scene.app.screen;

    const onPointerDown = (e: FederatedPointerEvent) => {
        // Skip if joystick already active with different pointer
        if (this.isActive && this.pointerId !== e.pointerId) {
            return
        }

        const x = e.global.x
        const y = e.global.y

        // ZONE CHECK: Only activate in left half of screen
        if (x >= this.screenWidth / 2) {
            return // Right half = button territory
        }

        // EXCLUSION ZONE: Don't activate in back button area (top-left corner)
        const BACK_BUTTON_EXCLUSION_WIDTH = 120
        const BACK_BUTTON_EXCLUSION_HEIGHT = 60
        if (x < BACK_BUTTON_EXCLUSION_WIDTH && y < BACK_BUTTON_EXCLUSION_HEIGHT) {
            return // Top-left corner = back button territory
        }

        // Spawn joystick at touch position
        this.baseX = x
        this.baseY = y

        // Clamp position to prevent off-screen rendering (70px margins)
        const margin = 70
        this.baseX = Math.max(margin, Math.min(this.baseX, this.screenWidth / 2 - margin))
        this.baseY = Math.max(margin, Math.min(this.baseY, this.screenHeight - margin))

        // Reposition visual elements to spawn point
        this.repositionJoystick(this.baseX, this.baseY)

        // Activate joystick and track pointer ID
        this.pointerId = e.pointerId
        this.isActive = true
        this.setVisible(true)

        // Haptic feedback on touch
        HapticFeedback.light()
    }

    const onPointerMove = (e: FederatedPointerEvent) => {
        // Only respond to our tracked pointer
        if (this.isActive && e.pointerId === this.pointerId) {
            this.updateStickPosition(e.global.x, e.global.y)
        }
    }

    const onPointerUp = (e: FederatedPointerEvent) => {
        // Only respond to our tracked pointer
        if (e.pointerId === this.pointerId) {
            this.reset()
        }
    }

    this.scene.app.stage.on('pointerdown', onPointerDown)
    this.scene.app.stage.on('pointermove', onPointerMove)
    this.scene.app.stage.on('pointerup', onPointerUp)
    this.scene.app.stage.on('pointerupoutside', onPointerUp)

    // Store cleanup function
    this.cleanupListeners = () => {
        this.scene.app.stage.off('pointerdown', onPointerDown)
        this.scene.app.stage.off('pointermove', onPointerMove)
        this.scene.app.stage.off('pointerup', onPointerUp)
        this.scene.app.stage.off('pointerupoutside', onPointerUp)
    }
  }

  private cleanupListeners: () => void = () => {}

  private repositionJoystick(x: number, y: number) {
    this.baseX = x
    this.baseY = y

    this.base.position.set(x, y)
    this.stick.position.set(x, y)
  }

  private updateStickPosition(x: number, y: number) {
    const dx = x - this.baseX
    const dy = y - this.baseY
    const distance = GeometryUtils.distanceScalar(this.baseX, this.baseY, x, y)

    if (distance > this.maxRadius) {
      // Clamp to max radius
      const angle = Math.atan2(dy, dx)
      this.stick.position.set(
          this.baseX + Math.cos(angle) * this.maxRadius,
          this.baseY + Math.sin(angle) * this.maxRadius
      )
    } else {
        this.stick.position.set(x, y)
    }
  }

  private reset() {
    this.pointerId = -1
    this.isActive = false
    this.stick.position.set(this.baseX, this.baseY)
    this.setVisible(true)
  }

  private setVisible(visible: boolean) {
    this.container.visible = visible
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
    const distance = GeometryUtils.distanceScalar(this.baseX, this.baseY, this.stick.x, this.stick.y)

    // Apply dead zone
    if (distance < this.maxRadius * this.deadZone) {
      return { x: 0, y: 0 }
    }

    // Normalize to -1 to 1 range
    const normalizedX = dx / this.maxRadius
    const normalizedY = dy / this.maxRadius

    // Clamp manually
    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

    return {
      x: clamp(normalizedX, -1, 1),
      y: clamp(normalizedY, -1, 1),
    }
  }

  /**
   * Check if joystick is currently being used
   */
  public isPressed(): boolean {
    return this.isActive
  }

  public getContainer(): Container {
    return this.container
  }

  /**
   * Update screen width when window resizes
   */
  public resize(newWidth: number, newHeight: number) {
    this.screenWidth = newWidth
    this.screenHeight = newHeight

    // Update stage hitArea
    this.scene.app.stage.hitArea = this.scene.app.screen;

    const margin = 70

    if (this.isActive) {
      // Ensure base position stays within new screen bounds
      this.baseX = Math.max(margin, Math.min(this.baseX, newWidth / 2 - margin))
      this.baseY = Math.max(margin, Math.min(this.baseY, this.screenHeight - margin))

      // Reposition visual elements
      this.base.position.set(this.baseX, this.baseY)

      // Keep stick at current relative position
      const currentDx = this.stick.x - this.base.x
      const currentDy = this.stick.y - this.base.y
      this.stick.position.set(this.baseX + currentDx, this.baseY + currentDy)
    } else {
      // Inactive: re-anchor to a safe default within bounds
      this.baseX = Math.max(margin, Math.min(newWidth * 0.18, newWidth / 2 - margin))
      this.baseY = Math.max(margin, Math.min(this.screenHeight * 0.7, this.screenHeight - margin))
      this.base.position.set(this.baseX, this.baseY)
      this.stick.position.set(this.baseX, this.baseY)
    }

    this.drawJoystick()
  }

  /**
   * Clean up resources
   */
  public destroy() {
    this.cleanupListeners()
    this.container.destroy({ children: true })
  }

  // ============================================
  // TESTING API - For automated testing only
  // ============================================

  public __test_simulateTouch(x: number, y: number) {
    if (!this.scene) return

    if (x >= this.screenWidth / 2) {
      return
    }

    const BACK_BUTTON_EXCLUSION_WIDTH = 120
    const BACK_BUTTON_EXCLUSION_HEIGHT = 60
    if (x < BACK_BUTTON_EXCLUSION_WIDTH && y < BACK_BUTTON_EXCLUSION_HEIGHT) {
      return
    }

    const margin = 70
    this.baseX = Math.max(margin, Math.min(x, this.screenWidth / 2 - margin))
    this.baseY = Math.max(margin, Math.min(y, this.screenHeight - margin))

    this.repositionJoystick(this.baseX, this.baseY)
    this.isActive = true
    this.setVisible(true)
  }

  public __test_simulateDrag(x: number, y: number) {
    if (!this.isActive) return
    this.updateStickPosition(x, y)
  }

  public __test_simulateRelease() {
    this.reset()
  }

  public __test_getState() {
    return {
      active: this.isActive,
      baseX: this.baseX,
      baseY: this.baseY,
      stickX: this.stick.x,
      stickY: this.stick.y,
      baseColor: (this.base.fill as any)?.color || this.teamColor, // Fill might be complex object in v8
      input: this.getInput(),
    }
  }
}
