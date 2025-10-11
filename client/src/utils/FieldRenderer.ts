import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'

/**
 * Field Renderer Utility
 * Shared rendering logic for field, goals, and field elements
 */
export class FieldRenderer {
  /**
   * Create the field background and boundaries
   */
  static createField(
    scene: Phaser.Scene,
    gameObjects: Phaser.GameObjects.GameObject[],
    uiCamera: Phaser.Cameras.Scene2D.Camera
  ): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const margin = GAME_CONFIG.FIELD_MARGIN

    // Field background (green)
    const fieldBg = scene.add.rectangle(width / 2, height / 2, width, height, 0x2d5016)
    gameObjects.push(fieldBg)

    // Field border
    const borderGraphics = scene.add.graphics()
    borderGraphics.lineStyle(4, 0xffffff, 1)
    borderGraphics.strokeRect(margin, margin, width - margin * 2, height - margin * 2)

    // Center circle
    borderGraphics.lineStyle(2, 0xffffff, 0.5)
    borderGraphics.strokeCircle(width / 2, height / 2, 120)

    // Center line
    borderGraphics.lineBetween(width / 2, margin, width / 2, height - margin)
    gameObjects.push(borderGraphics)

    // Goals
    const goalHeight = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const goalDepth = GAME_CONFIG.GOAL_DEPTH

    const leftGoal = scene.add
      .rectangle(0, height / 2, goalDepth, goalHeight, 0xffffff)
      .setOrigin(0, 0.5)
    const rightGoal = scene.add
      .rectangle(width, height / 2, goalDepth, goalHeight, 0xffffff)
      .setOrigin(1, 0.5)
    gameObjects.push(leftGoal, rightGoal)

    // Goal posts
    const post1 = scene.add.circle(margin, GAME_CONFIG.GOAL_Y_MIN, 10, 0xffffff)
    const post2 = scene.add.circle(margin, GAME_CONFIG.GOAL_Y_MAX, 10, 0xffffff)
    const post3 = scene.add.circle(width - margin, GAME_CONFIG.GOAL_Y_MIN, 10, 0xffffff)
    const post4 = scene.add.circle(width - margin, GAME_CONFIG.GOAL_Y_MAX, 10, 0xffffff)
    gameObjects.push(post1, post2, post3, post4)

    // Make all field objects invisible to UI camera
    gameObjects.forEach((obj) => uiCamera.ignore(obj))
  }
}
