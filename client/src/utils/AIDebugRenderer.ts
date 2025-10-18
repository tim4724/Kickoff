import Phaser from 'phaser'

/**
 * AI Debug Renderer
 * Visualizes AI player goals and target positions for development
 */
export class AIDebugRenderer {
  private scene: Phaser.Scene
  private uiCamera: Phaser.Cameras.Scene2D.Camera
  private labels: Map<string, Phaser.GameObjects.Text> = new Map()
  private targetLines: Map<string, Phaser.GameObjects.Graphics> = new Map()
  private enabled: boolean = true

  constructor(scene: Phaser.Scene, uiCamera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene
    this.uiCamera = uiCamera
  }

  /**
   * Update label above AI player showing current goal
   */
  updatePlayerLabel(
    playerId: string,
    position: { x: number; y: number },
    goalText: string,
    team: 'blue' | 'red'
  ): void {
    if (!this.enabled) return

    let label = this.labels.get(playerId)

    if (!label) {
      // Create new label
      label = this.scene.add.text(0, 0, '', {
        fontSize: '26px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 8 },
      })
      label.setOrigin(0.5, 1)
      label.setDepth(1000) // Always on top

      // Only render on game camera, not UI camera
      this.uiCamera.ignore([label])

      this.labels.set(playerId, label)
    }

    // Color code by team
    const bgColor = team === 'blue' ? '#0066ffcc' : '#ff4444cc'
    label.setBackgroundColor(bgColor)

    // Position above player (60px up)
    label.setPosition(position.x, position.y - 60)
    label.setText(goalText)
    label.setVisible(true)
  }

  /**
   * Update line from player to their target position
   */
  updateTargetLine(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    team: 'blue' | 'red'
  ): void {
    if (!this.enabled) return

    let line = this.targetLines.get(playerId)

    if (!line) {
      line = this.scene.add.graphics()
      line.setDepth(999) // Below labels

      // Only render on game camera, not UI camera
      this.uiCamera.ignore([line])

      this.targetLines.set(playerId, line)
    }

    line.clear()

    // Color code by team (simplified: more transparent)
    const color = team === 'blue' ? 0x0066ff : 0xff4444

    // Draw simple solid line to target
    line.lineStyle(8, color, 0.4)
    line.beginPath()
    line.moveTo(from.x, from.y)
    line.lineTo(to.x, to.y)
    line.strokePath()
  }

  /**
   * Hide debug info for a player
   */
  hidePlayer(playerId: string): void {
    this.labels.get(playerId)?.setVisible(false)
    this.targetLines.get(playerId)?.clear()
  }

  /**
   * Set visibility of all debug elements
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled

    if (!enabled) {
      // Hide all labels and lines
      this.labels.forEach(label => label.setVisible(false))
      this.targetLines.forEach(line => line.clear())
    }
  }

  /**
   * Clean up all debug elements
   */
  destroy(): void {
    this.labels.forEach(label => label.destroy())
    this.targetLines.forEach(line => line.destroy())
    this.labels.clear()
    this.targetLines.clear()
  }
}
