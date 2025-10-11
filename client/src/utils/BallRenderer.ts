import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'

/**
 * Ball Renderer Utility
 * Shared rendering logic for ball creation and color updates
 */
export class BallRenderer {
  /**
   * Create the ball sprite with shadow
   */
  static createBall(
    scene: Phaser.Scene,
    gameObjects: Phaser.GameObjects.GameObject[],
    uiCamera: Phaser.Cameras.Scene2D.Camera
  ): { ball: Phaser.GameObjects.Ellipse; shadow: Phaser.GameObjects.Ellipse } {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT

    // Ball shadow
    const ballShadow = scene.add.ellipse(width / 2 + 2, height / 2 + 3, 30, 24, 0x000000, 0.3)
    ballShadow.setDepth(15)

    // Ball
    const ball = scene.add.ellipse(width / 2, height / 2, 30, 30, 0xffffff)
    ball.setDepth(15)

    gameObjects.push(ballShadow, ball)
    uiCamera.ignore([ballShadow, ball])

    return { ball, shadow: ballShadow }
  }

  /**
   * Update ball color based on possession and pressure
   */
  static updateBallColor(
    ball: Phaser.GameObjects.Ellipse,
    possessorTeam: 'blue' | 'red' | null,
    pressureLevel: number,
    blueColor: number,
    redColor: number
  ): void {
    if (!possessorTeam) {
      ball.setFillStyle(0xffffff)
      return
    }

    if (pressureLevel === 0) {
      const teamColor = possessorTeam === 'blue' ? blueColor : redColor
      ball.setFillStyle(teamColor)
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

      const interpolatedColor = (r << 16) | (g << 8) | b
      ball.setFillStyle(interpolatedColor)
    }
  }
}
