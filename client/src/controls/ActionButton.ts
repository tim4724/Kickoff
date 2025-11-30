/**
 * Action Button for mobile touch controls (PixiJS)
 * Bottom-right corner button for pass/shoot actions
 * Activates only in right half of screen to avoid conflicts with joystick
 */

import { Container, Graphics, Text, FederatedPointerEvent } from 'pixi.js'
import { HapticFeedback } from '../utils/HapticFeedback'
import { gameClock } from '@shared/engine/GameClock'
import { PixiScene } from '../utils/PixiScene'

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
  private pressStartTime: number = 0

  // Team color for button styling
  private teamColor: number = 0xff4444 // Default red, updated via setTeamColor()
  private teamColorLight: number = 0xff6666 // Lighter variant

  // Callbacks
  private onPressCallback?: () => void
  private onReleaseCallback?: (power: number) => void

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
    this.pressStartTime = gameClock.now()

    // Visual feedback - use lighter team color when pressed
    this.drawButton(this.teamColorLight, 0.7)
    this.container.scale.set(0.9)

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

    // Reset visual
    this.drawButton(this.teamColor, 0.6)
    this.container.scale.set(1)

    // Calculate power based on hold duration
    const power = Math.min(holdDuration / 1.0, 1)

    // Haptic feedback on release
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

    // Re-anchor to a symmetric default on the right side if not pressed
    if (!this.isPressed) {
      this.x = Math.min(newWidth - 70, Math.max(newWidth * 0.82, newWidth / 2 + 70))
      this.y = Math.max(100, newHeight * 0.8)
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
   * Update power indicator visual (called every frame)
   */
  public update() {
    if (this.isPressed) {
      const power = this.getPower()
      // Enhanced pulse effect based on power (more pronounced scaling)
      const scale = 0.85 + power * 0.3
      this.container.scale.set(scale)

      // Change color intensity based on power
      const alpha = 0.6 + power * 0.4
      this.button.alpha = alpha; // directly set alpha on graphics

      // Add outer glow ring for charging effect
      const glowSize = 3 + power * 5 // Stroke width grows from 3 to 8
      const glowAlpha = 0.4 + power * 0.6 // Glow becomes more visible

      this.button.stroke({ width: glowSize, color: this.teamColorLight, alpha: glowAlpha })
    } else {
      // Reset to base state should be handled by onRelease/drawButton mostly,
      // but if we are manually tweening properties here:
      if (this.container.scale.x !== 1) this.container.scale.set(1)
      if (this.button.alpha !== 1) this.button.alpha = 1 // alpha relative to container? wait, createButton sets fill alpha
      // Actually drawButton sets fill alpha. button.alpha is container level? No, button is Graphics.
      // Let's re-draw to be safe or just reset properties if we modified them.
      // Re-calling drawButton every frame is expensive.
      // Modifying stroke via property is better if possible in v8? GraphicsContext?
      // For now, let's just leave it unless we need complex animation.
      // The original code re-set stroke style every frame if pressed.
    }
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

  public __test_simulateRelease(holdDurationMs: number = 0) {
    if (!this.isPressed) return

    const holdDuration = holdDurationMs / 1000
    const power = Math.min(holdDuration / 1.0, 1)

    this.drawButton(this.teamColor, 0.6)
    this.container.scale.set(1)

    if (this.onReleaseCallback) {
      this.onReleaseCallback(power)
    }

    this.isPressed = false
    this.pointerId = -1
  }

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
