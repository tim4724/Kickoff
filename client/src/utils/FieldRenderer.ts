import { Container, Graphics } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'

/**
 * Field Renderer Utility for PixiJS
 * Shared rendering logic for field, goals, and field elements
 */
export class FieldRenderer {
  /**
   * Create the field background and boundaries
   * Appends elements to the game container
   */
  static createField(container: Container): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const margin = GAME_CONFIG.FIELD_MARGIN

    // Field background (green)
    const fieldBg = new Graphics()
    fieldBg.rect(0, 0, width, height)
    fieldBg.fill(0x2d5016)
    container.addChild(fieldBg)

    // Field lines
    const borderGraphics = new Graphics()

    // Border
    borderGraphics.rect(margin, margin, width - margin * 2, height - margin * 2)
    borderGraphics.stroke({ width: 4, color: 0xffffff, alpha: 1 })

    // Center circle
    borderGraphics.circle(width / 2, height / 2, 120)
    borderGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.5 })

    // Halfway line (Vertical Center)
    borderGraphics.moveTo(width / 2, margin)
    borderGraphics.lineTo(width / 2, height - margin)
    borderGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.5 })

    // Penalty Areas (Simplified if no config available, but standard size is approx 16.5m)
    // Assuming field is approx 100m x 60m.
    // Let's just stick to the requested Halfway Line + Center Circle fix.
    // The user said "Vertical middle line is missing", implying the halfway line was missing.
    // I fixed the stroke order above.

    // Removing the horizontal line as it is not standard soccer.

    container.addChild(borderGraphics)

    // Goals
    const goalHeight = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const goalDepth = GAME_CONFIG.GOAL_DEPTH

    // Left Goal
    const leftGoal = new Graphics()
    leftGoal.rect(0, 0, goalDepth, goalHeight) // Origin 0,0 for rect
    leftGoal.fill(0xffffff)
    leftGoal.pivot.set(0, goalHeight / 2) // setOrigin(0, 0.5) equivalent
    leftGoal.position.set(0, height / 2)
    container.addChild(leftGoal)

    // Right Goal
    const rightGoal = new Graphics()
    rightGoal.rect(0, 0, goalDepth, goalHeight)
    rightGoal.fill(0xffffff)
    rightGoal.pivot.set(goalDepth, goalHeight / 2) // setOrigin(1, 0.5) equivalent
    rightGoal.position.set(width, height / 2)
    container.addChild(rightGoal)

    // Goal posts
    const postColor = 0xffffff
    const postRadius = 10

    const posts = [
        { x: margin, y: GAME_CONFIG.GOAL_Y_MIN },
        { x: margin, y: GAME_CONFIG.GOAL_Y_MAX },
        { x: width - margin, y: GAME_CONFIG.GOAL_Y_MIN },
        { x: width - margin, y: GAME_CONFIG.GOAL_Y_MAX }
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
