import { Container, Graphics } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'

/**
 * Field Renderer Utility for PixiJS
 * Shared rendering logic for field, goals, and field elements
 */
export class FieldRenderer {
  // Visual constants (UI only, do not affect physics)
  private static readonly FIELD_LINE_MARGIN = 40
  private static readonly GOAL_DEPTH = 40 // How far goal extends visually outside field

  /**
   * Create the field background and boundaries
   * Appends elements to the game container
   */
  static createField(container: Container): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const margin = FieldRenderer.FIELD_LINE_MARGIN

    // Field background (green) - extends beyond field bounds by margin
    const fieldBg = new Graphics()
    fieldBg.rect(-margin, -margin, width + margin * 2, height + margin * 2)
    fieldBg.fill(0x2d5016)
    container.addChild(fieldBg)

    // Field lines (white boundary at the edge of playable area)
    const borderGraphics = new Graphics()

    // Border at the actual field edge (0,0 to width,height)
    borderGraphics.rect(0, 0, width, height)
    borderGraphics.stroke({ width: 4, color: 0xffffff, alpha: 1 })

    // Center circle
    borderGraphics.circle(width / 2, height / 2, 120)
    borderGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.5 })

    // Halfway line (Vertical Center)
    borderGraphics.moveTo(width / 2, 0)
    borderGraphics.lineTo(width / 2, height)
    borderGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.5 })

    container.addChild(borderGraphics)

    // Goals - positioned at field edges (x=0 and x=width)
    const goalHeight = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const goalDepth = FieldRenderer.GOAL_DEPTH

    // Left Goal (extends outside left edge)
    const leftGoal = new Graphics()
    leftGoal.rect(-goalDepth, 0, goalDepth, goalHeight)
    leftGoal.fill(0xffffff)
    leftGoal.pivot.set(0, goalHeight / 2)
    leftGoal.position.set(0, height / 2)
    container.addChild(leftGoal)

    // Right Goal (extends outside right edge)
    const rightGoal = new Graphics()
    rightGoal.rect(0, 0, goalDepth, goalHeight)
    rightGoal.fill(0xffffff)
    rightGoal.pivot.set(0, goalHeight / 2)
    rightGoal.position.set(width, height / 2)
    container.addChild(rightGoal)

    // Goal posts at the field boundary (x=0 and x=width)
    const postColor = 0xffffff
    const postRadius = 10

    const posts = [
        { x: 0, y: GAME_CONFIG.GOAL_Y_MIN },
        { x: 0, y: GAME_CONFIG.GOAL_Y_MAX },
        { x: width, y: GAME_CONFIG.GOAL_Y_MIN },
        { x: width, y: GAME_CONFIG.GOAL_Y_MAX }
    ]

    posts.forEach(pos => {
        const post = new Graphics()
        post.circle(0, 0, postRadius)
        post.fill(postColor)
        post.position.set(pos.x, pos.y)
        container.addChild(post)
    })
  }
}
