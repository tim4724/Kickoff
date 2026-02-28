import { Container, Graphics, Text } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import QRCode from 'qrcode'

/**
 * Overlay displayed on the field while waiting for a second player to join.
 * Shows a QR code (rendered via PixiJS Graphics) encoding the join URL,
 * plus "Waiting for opponent..." text with a subtle pulse animation.
 */
export class WaitingOverlay {
  readonly container: Container
  private titleText: Text
  private animationFrame: number = 0
  private destroyed: boolean = false

  constructor(joinUrl: string, parent: Container) {
    this.container = new Container()
    this.container.zIndex = 500

    const centerX = GAME_CONFIG.FIELD_WIDTH / 2
    const centerY = GAME_CONFIG.FIELD_HEIGHT / 2

    // Semi-transparent backdrop
    const backdrop = new Graphics()
    backdrop.roundRect(centerX - 200, centerY - 210, 400, 420, 16)
    backdrop.fill({ color: 0x000000, alpha: 0.75 })
    this.container.addChild(backdrop)

    // Title text: "Waiting for opponent..."
    this.titleText = new Text({
      text: 'Waiting for opponent...',
      style: {
        fontSize: 26,
        fill: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
      },
    })
    this.titleText.anchor.set(0.5)
    this.titleText.position.set(centerX, centerY - 175)
    this.container.addChild(this.titleText)

    // Generate and render QR code
    this.renderQRCode(joinUrl, centerX, centerY)

    // Instruction text: "Scan to join"
    const instructionText = new Text({
      text: 'Scan to join',
      style: {
        fontSize: 20,
        fill: '#aaaaaa',
        fontFamily: 'Arial, sans-serif',
      },
    })
    instructionText.anchor.set(0.5)
    instructionText.position.set(centerX, centerY + 175)
    this.container.addChild(instructionText)

    parent.addChild(this.container)

    // Start pulse animation
    this.animate()
  }

  private renderQRCode(url: string, centerX: number, centerY: number): void {
    try {
      const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
      const modules = qr.modules
      const moduleCount = modules.size

      // Target ~250 game units wide for the QR code
      const qrSize = 250
      const cellSize = qrSize / moduleCount
      const startX = centerX - qrSize / 2
      const startY = centerY - qrSize / 2

      const graphics = new Graphics()

      // White background for QR code (with quiet zone)
      const padding = cellSize * 2
      graphics.roundRect(
        startX - padding,
        startY - padding,
        qrSize + padding * 2,
        qrSize + padding * 2,
        8,
      )
      graphics.fill(0xffffff)

      // Draw dark modules
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (modules.get(row, col)) {
            graphics.rect(
              startX + col * cellSize,
              startY + row * cellSize,
              cellSize,
              cellSize,
            )
            graphics.fill(0x000000)
          }
        }
      }

      this.container.addChild(graphics)
    } catch (error) {
      console.error('[WaitingOverlay] Failed to generate QR code:', error)
    }
  }

  private animate = (): void => {
    if (this.destroyed) return

    this.animationFrame++
    // Subtle alpha pulse: oscillate between 0.6 and 1.0
    const alpha = 0.8 + Math.sin(this.animationFrame * 0.05) * 0.2
    this.titleText.alpha = alpha

    requestAnimationFrame(this.animate)
  }

  destroy(): void {
    this.destroyed = true
    if (this.container.parent) {
      this.container.parent.removeChild(this.container)
    }
    this.container.destroy({ children: true })
  }
}
