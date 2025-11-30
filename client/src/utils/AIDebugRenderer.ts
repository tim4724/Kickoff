import { Container, Graphics, Text } from 'pixi.js'
import { PixiScene } from './PixiScene'
import { CameraManager } from './CameraManager'

/**
 * AI Debug Renderer for PixiJS
 * Visualizes AI player goals and target positions for development
 */
export class AIDebugRenderer {
  private container: Container
  private labels: Map<string, Text> = new Map()
  private targetLines: Map<string, Graphics> = new Map()
  private enabled: boolean = true

  constructor(_scene: PixiScene, cameraManager: CameraManager) {
    // Add to game container so it moves with the camera
    this.container = new Container()
    this.container.zIndex = 1000 // High z-index to be on top within game world
    cameraManager.getGameContainer().addChild(this.container)
    cameraManager.getGameContainer().sortableChildren = true
  }

  /**
   * Update label above AI player showing current goal
   */
  updatePlayerLabel(
    playerId: string,
    position: { x: number; y: number },
    goalText: string,
    _team: "blue" | "red"
  ): void {
    if (!this.enabled) return

    let label = this.labels.get(playerId)

    if (!label) {
      // Create new label
      label = new Text({
        text: '',
        style: {
            fontSize: 26,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fill: '#ffffff',
            padding: 10, // PixiJS text padding is for internal texture buffer usually, but background logic needs manual handling if we want a box.
            // PixiJS Text doesn't support background color natively like Phaser.
            // We'd need a Container with Graphics + Text.
        }
      })
      // We'll just use simple text for now or implement a wrapper if strictly needed.
      // Let's make it a simple text with stroke for visibility.
      label.style.stroke = { width: 4, color: 0x000000 }
      label.anchor.set(0.5, 1)
      label.zIndex = 1000

      this.container.addChild(label)
      this.labels.set(playerId, label)
    }

    // Position above player (60px up)
    label.position.set(position.x, position.y - 60)
    label.text = goalText
    label.visible = true

    // Tint based on team? Text style fill is string.
    // label.style.fill = team === 'blue' ? '#0066ff' : '#ff4444';
    // This re-generates texture. OK for debug.
  }

  /**
   * Update line from player to their target position
   */
  updateTargetLine(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    _team: "blue" | "red"
  ): void {
    if (!this.enabled) return

    let line = this.targetLines.get(playerId)

    if (!line) {
      line = new Graphics()
      line.zIndex = 999
      this.container.addChild(line)
      this.targetLines.set(playerId, line)
    }

    line.clear()

    // Color code by team
    const color = _team === 'blue' ? 0x0066ff : 0xff4444

    // Draw simple solid line to target
    line.moveTo(from.x, from.y)
    line.lineTo(to.x, to.y)
    line.stroke({ width: 8, color, alpha: 0.4 })
  }

  /**
   * Hide debug info for a player
   */
  hidePlayer(playerId: string): void {
    const label = this.labels.get(playerId)
    if (label) label.visible = false
    this.targetLines.get(playerId)?.clear()
  }

  /**
   * Set visibility of all debug elements
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled

    if (!enabled) {
      // Hide all labels and lines
      this.labels.forEach(label => label.visible = false)
      this.targetLines.forEach(line => line.clear())
    }
  }

  /**
   * Clean up all debug elements
   */
  destroy(): void {
    this.container.destroy({ children: true })
    this.labels.clear()
    this.targetLines.clear()
  }
}
