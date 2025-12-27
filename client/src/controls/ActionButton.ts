/**
 * Action Button for mobile touch controls (PixiJS)
 * Bottom-right corner button for pass/shoot actions
 * Activates only in right half of screen to avoid conflicts with joystick
 */

import { Container, Graphics, Text, FederatedPointerEvent } from 'pixi.js'
import { HapticFeedback } from '@/utils/HapticFeedback'
import { PixiScene } from '@/utils/PixiScene'

export class ActionButton {
  private scene: PixiScene
  private button!: Graphics
  private label!: Text
  private pointerId: number = -1 // Track pointer ID for multi-touch

  private x: number
  private y: number
  private screenWidth: number
  private radius: number = 50

  private isPressed: boolean = false

  // Team color for button styling
  private teamColor: number = 0xff4444 // Default red, updated via setTeamColor()
  private teamColorLight: number = 0xff6666 // Lighter variant

  // Callback - fires immediately on press
  private onActionCallback?: () => void

  public container: Container

  constructor(scene: PixiScene, x: number, y: number) {
    this.scene = scene
    this.screenWidth = scene.app.screen.width
    this.container = new Container()
    scene.container.addChild(this.container)

    // Scale button based on screen size (6% of screen height)
    this.radius = Math.max(50, Math.min(scene.app.screen.height * 0.06, 80))

    this.x = x
    this.y = y

    this.createButton()
    this.setupInput()
  }

  private createButton() {
    this.button = new Graphics()
    this.label = new Text({
        text: '',
        style: { fontSize: 32, fill: '#ffffff' }
    })
    this.label.anchor.set(0.5, 0.5)

    this.container.addChild(this.button)
    this.container.addChild(this.label)

    // Initial draw
    this.drawButton(this.teamColor, 0.6)

    this.container.position.set(this.x, this.y)
  }

  private drawButton(color: number, alpha: number, strokeColor?: number, strokeWidth: number = 3, strokeAlpha: number = 0.7) {
    this.button.clear()
    this.button.circle(0, 0, this.radius)
    this.button.fill({ color, alpha })
    this.button.stroke({ width: strokeWidth, color: strokeColor || this.teamColorLight, alpha: strokeAlpha })
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

    this.drawButton(this.teamColor, 0.6)
  }

  private setupInput() {
    this.scene.app.stage.eventMode = 'static';
    this.scene.app.stage.hitArea = this.scene.app.screen;

    const onPointerDown = (e: FederatedPointerEvent) => {
        // Skip if button already pressed by different pointer
        if (this.isPressed && this.pointerId !== e.pointerId) {
            return
        }

        const x = e.global.x
        const y = e.global.y

        // ZONE CHECK: Only activate in right half of screen
        if (x < this.screenWidth / 2) {
            return // Left half = joystick territory
        }

        // Re-anchor to touch point
        this.setPosition(x, y)
        this.pointerId = e.pointerId
        this.onPress()
    }

    const onPointerUp = (e: FederatedPointerEvent) => {
        // Only respond to our tracked pointer
        if (e.pointerId === this.pointerId && this.isPressed) {
            this.onRelease()
        }
    }

    this.scene.app.stage.on('pointerdown', onPointerDown)
    this.scene.app.stage.on('pointerup', onPointerUp)
    this.scene.app.stage.on('pointerupoutside', onPointerUp)

    this.cleanupListeners = () => {
        this.scene.app.stage.off('pointerdown', onPointerDown)
        this.scene.app.stage.off('pointerup', onPointerUp)
        this.scene.app.stage.off('pointerupoutside', onPointerUp)
    }
  }

  private cleanupListeners: () => void = () => {}

  private onPress() {
    this.isPressed = true

    // Visual feedback - use lighter team color when pressed
    this.drawButton(this.teamColorLight, 0.7)
    this.container.scale.set(0.9)

    // Haptic feedback
    HapticFeedback.medium()

    // Fire action immediately on press
    if (this.onActionCallback) {
      this.onActionCallback()
    }
  }

  private onRelease() {
    this.isPressed = false

    // Reset visual
    this.drawButton(this.teamColor, 0.6)
    this.container.scale.set(1)

    this.pointerId = -1
  }

  /**
   * Set callback for when button is pressed (fires immediately)
   */
  public setOnActionCallback(callback: () => void) {
    this.onActionCallback = callback
  }

  /**
   * Check if button is currently pressed
   */
  public isPressing(): boolean {
    return this.isPressed
  }

  public getContainer(): Container {
    return this.container
  }

  /**
   * Update button position and screen width when window resizes
   */
  public resize(newWidth: number, newHeight: number) {
    // Update screen width for hit detection
    this.screenWidth = newWidth
    this.scene.app.stage.hitArea = this.scene.app.screen;

    // Re-anchor to a symmetric default on the right side if not pressed - closer to right edge
    if (!this.isPressed) {
      this.x = Math.min(newWidth - 70, Math.max(newWidth * 0.90, newWidth / 2 + 70))
      this.y = Math.max(100, newHeight * 0.7)
    }

    // Update button position
    this.container.position.set(this.x, this.y)
  }

  /**
   * Manually set button position (used when user taps to move it)
   */
  public setPosition(newX: number, newY: number) {
    this.x = newX
    this.y = newY
    this.container.position.set(this.x, this.y)
  }

  /**
   * Update (no-op, kept for interface compatibility)
   */
  public update() {
    // No power charging animation needed
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

  public __test_simulatePress() {
    if (!this.scene) return
    this.onPress()
  }

  public __test_simulateRelease() {
    if (!this.isPressed) return
    this.onRelease()
  }

  public __test_getState() {
    return {
      pressed: this.isPressed,
      x: this.x,
      y: this.y,
      radius: this.radius,
    }
  }
}
