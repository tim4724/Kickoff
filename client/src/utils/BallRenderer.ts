import { Container, Graphics } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'

/**
 * Ball Renderer Utility for PixiJS
 * Shared rendering logic for ball creation and color updates
 */
export class BallRenderer {
  /**
   * Create the ball sprite with shadow
   */
  static createBall(container: Container): { ball: Graphics; shadow: Graphics } {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    // Ball shadow
    const ballShadow = new Graphics()
    ballShadow.ellipse(0, 0, 15, 12) // Radius is half of width/height
    ballShadow.fill({ color: 0x000000, alpha: 0.3 })
    ballShadow.position.set(width / 2 + 2, height / 2 + 3)
    ballShadow.zIndex = 15 // PixiJS uses zIndex if sortableChildren is true
    container.addChild(ballShadow)

    // Ball
    const ball = new Graphics()
    ball.circle(0, 0, 15) // Radius 15 (width 30)
    ball.fill(0xffffff)
    ball.position.set(width / 2, height / 2)
    ball.zIndex = 15
    container.addChild(ball)

    // Enable zIndex sorting
    container.sortableChildren = true

    return { ball, shadow: ballShadow }
  }

  /**
   * Update ball color based on possession and pressure
   */
  static updateBallColor(
    ball: Graphics,
    possessorTeam: 'blue' | 'red' | null,
    pressureLevel: number,
    blueColor: number,
    redColor: number
  ): void {
    let targetColor: number

    if (!possessorTeam) {
      targetColor = 0xffffff
    } else if (pressureLevel === 0) {
      targetColor = possessorTeam === 'blue' ? blueColor : redColor
    } else {
      // Interpolate between team colors based on pressure
      const startColor = possessorTeam === 'blue' ? blueColor : redColor
      const endColor = possessorTeam === 'blue' ? redColor : blueColor

      const startR = (startColor >> 16) & 0xff
      const startG = (startColor >> 8) & 0xff
      const startB = startColor & 0xff

      const endR = (endColor >> 16) & 0xff
      const endG = (endColor >> 8) & 0xff
      const endB = endColor & 0xff

      const r = Math.round(startR + (endR - startR) * pressureLevel)
      const g = Math.round(startG + (endG - startG) * pressureLevel)
      const b = Math.round(startB + (endB - startB) * pressureLevel)

      targetColor = (r << 16) | (g << 8) | b
    }

    // PixiJS Graphics update requires clearing and redrawing for simple shapes
    // Or we can use tint if we used a white texture.
    // Since we are using Graphics primitives, we must redraw or tint.
    // Graphics tint affects the whole graphics object.

    // Simplest is to tint the graphics object since it's just a white circle.
    ball.tint = targetColor
  }
}
