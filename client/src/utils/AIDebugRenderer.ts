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

    // Color code by team
    const color = team === 'blue' ? 0x0066ff : 0xff4444

    // Draw dashed line to target
    line.lineStyle(8, color, 0.7)
    this.drawDashedLine(line, from.x, from.y, to.x, to.y, 10, 5)

    // Draw direction arrow
    this.drawArrow(line, from, to, color)
  }

  /**
   * Draw dashed line between two points
   */
  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance === 0) return

    const dashCount = Math.floor(distance / (dashLength + gapLength))

    const stepX = (dx / distance) * (dashLength + gapLength)
    const stepY = (dy / distance) * (dashLength + gapLength)

    for (let i = 0; i < dashCount; i++) {
      const startX = x1 + stepX * i
      const startY = y1 + stepY * i
      const endX = startX + (dx / distance) * dashLength
      const endY = startY + (dy / distance) * dashLength

      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }
  }

  /**
   * Draw arrow at end of line
   */
  private drawArrow(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number
  ): void {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance === 0) return

    // Normalize direction
    const dirX = dx / distance
    const dirY = dy / distance

    // Arrow position (near target)
    const arrowDist = Math.min(distance * 0.8, distance - 30)
    const arrowX = from.x + dirX * arrowDist
    const arrowY = from.y + dirY * arrowDist

    // Arrow size
    const arrowSize = 15

    // Calculate arrow points
    const angle = Math.atan2(dy, dx)
    const arrowAngle = Math.PI / 6 // 30 degrees

    const p1x = arrowX - arrowSize * Math.cos(angle - arrowAngle)
    const p1y = arrowY - arrowSize * Math.sin(angle - arrowAngle)

    const p2x = arrowX - arrowSize * Math.cos(angle + arrowAngle)
    const p2y = arrowY - arrowSize * Math.sin(angle + arrowAngle)

    // Draw arrow head
    graphics.fillStyle(color, 0.8)
    graphics.beginPath()
    graphics.moveTo(arrowX, arrowY)
    graphics.lineTo(p1x, p1y)
    graphics.lineTo(p2x, p2y)
    graphics.closePath()
    graphics.fillPath()
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
