import { Container, Graphics, Sprite } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { getTexture } from './GameAssets'

/**
 * Ball Renderer Utility for PixiJS
 *
 * Renders the ball as a Kenney soccer-ball sprite inside a Container, with a
 * soft possession glow behind it. The glow (not the ball itself) carries the
 * team/pressure color so the ball always reads as a real soccer ball while
 * still showing who's in possession.
 */
export interface BallVisual {
  /** Container holding the glow + ball sprite. Move this to move the ball. */
  ball: Container
  /** Separate ground shadow (positioned independently by the scene). */
  shadow: Graphics
  /** Possession glow ring; tinted/faded via updateBallColor. */
  glow: Graphics
}

export class BallRenderer {
  /**
   * Create the ball visual (sprite + glow) plus a shadow.
   */
  static createBall(container: Container): BallVisual {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const ballRadius = GAME_CONFIG.BALL_RADIUS

    // Ball shadow (separate object — the scene offsets it under the ball)
    const ballShadow = new Graphics()
    ballShadow.ellipse(0, 0, ballRadius, ballRadius * 0.8)
    ballShadow.fill({ color: 0x000000, alpha: 0.3 })
    ballShadow.position.set(width / 2 + 2, height / 2 + 3)
    ballShadow.zIndex = 15
    container.addChild(ballShadow)

    // Ball container (glow + sprite move together)
    const ball = new Container()
    ball.position.set(width / 2, height / 2)
    ball.zIndex = 16

    // Possession glow: stacked translucent circles form a soft halo without a
    // shader. Drawn white; updateBallColor sets tint + alpha.
    const glow = new Graphics()
    for (let i = 4; i >= 1; i--) {
      glow.circle(0, 0, ballRadius * (0.9 + i * 0.32))
      glow.fill({ color: 0xffffff, alpha: 0.14 })
    }
    glow.alpha = 0
    glow.zIndex = 0
    ball.addChild(glow)

    // Ball sprite (fallback to a white circle if the texture is missing)
    const texture = getTexture('ball')
    if (texture) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.scale.set((ballRadius * 2) / texture.width)
      sprite.zIndex = 1
      ball.addChild(sprite)
    } else {
      const circle = new Graphics()
      circle.circle(0, 0, ballRadius)
      circle.fill(0xffffff)
      circle.stroke({ width: 2, color: 0x333333, alpha: 0.6 })
      circle.zIndex = 1
      ball.addChild(circle)
    }

    // Keep the glow explicitly behind the ball sprite regardless of child order.
    ball.sortableChildren = true

    container.addChild(ball)

    // Enable zIndex sorting
    container.sortableChildren = true

    return { ball, shadow: ballShadow, glow }
  }

  /**
   * Update the possession glow based on possessing team and pressure.
   * The ball sprite stays untinted; only the glow changes.
   */
  static updateBallColor(
    glow: Graphics,
    possessorTeam: 'blue' | 'red' | null,
    pressureLevel: number,
    blueColor: number,
    redColor: number
  ): void {
    if (!possessorTeam) {
      glow.alpha = 0
      return
    }

    let targetColor: number
    if (pressureLevel === 0) {
      targetColor = possessorTeam === 'blue' ? blueColor : redColor
    } else {
      // Interpolate toward the opponent color as the ball is contested.
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

    glow.tint = targetColor
    glow.alpha = 0.9
  }
}
