import { Container, Graphics, Sprite } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { getPlayerTexture } from './GameAssets'
import { VISUAL_CONSTANTS } from '@/scenes/GameSceneConstants'

/**
 * A single player's visual: a top-down Kenney character sprite with a ground
 * shadow and a "you control this one" highlight ring.
 *
 * The character rotates to face its movement direction. The Kenney top-down
 * character's art faces +X (right) by default, so the sprite rotation equals the
 * movement direction directly (direction 0 = +X). The shadow and ring stay
 * upright so they read correctly regardless of facing.
 */
export class PlayerVisual extends Container {
  private readonly shadow: Graphics
  private readonly ring: Graphics
  private readonly body: Container

  // Visual sizing relative to the physics radius.
  private static readonly R = GAME_CONFIG.PLAYER_RADIUS
  private static readonly BODY_HEIGHT = PlayerVisual.R * 2.1
  private static readonly RING_RADIUS = PlayerVisual.R + 4
  // The Kenney top-down art points along +X (right) by default — verified in-game
  // (an un-rotated sprite faces right, and direction 0 = +X), so direction maps
  // straight to rotation with no offset. Do NOT add 90°: that points players
  // perpendicular to their movement (the "crab walk").
  private static readonly FACING_OFFSET = 0
  // Smoothing fraction applied per 60fps-equivalent frame; scaled by frame time
  // in face() so rotation feels the same regardless of refresh rate.
  private static readonly ROTATION_SMOOTHING = 0.4
  private static readonly REFERENCE_FRAME_MS = 1000 / 60

  constructor(team: 'blue' | 'red', variantIndex: number) {
    super()
    this.zIndex = 10

    const radius = PlayerVisual.R

    // --- Ground shadow (drawn first, sits underneath everything) ---
    this.shadow = new Graphics()
    this.shadow.ellipse(0, radius * 0.5, radius * 0.72, radius * 0.42)
    this.shadow.fill({ color: 0x000000, alpha: 0.22 })
    this.addChild(this.shadow)

    // --- Highlight ring (hidden until this player is controlled) ---
    this.ring = new Graphics()
    this.ring.circle(0, 0, PlayerVisual.RING_RADIUS)
    this.ring.stroke({ width: 5, color: 0xffd23f, alpha: 0.95 })
    this.ring.circle(0, 0, PlayerVisual.RING_RADIUS + 5)
    this.ring.stroke({ width: 3, color: 0xffd23f, alpha: 0.35 })
    this.ring.visible = false

    // --- Character body (the only part that rotates) ---
    this.body = PlayerVisual.createBody(team, variantIndex)

    // Add body before ring so the highlight ring is never occluded by the body.
    this.addChild(this.body)
    this.addChild(this.ring)
  }

  /** Builds the rotating character sprite, or a fallback circle if no texture. */
  private static createBody(team: 'blue' | 'red', variantIndex: number): Container {
    const texture = getPlayerTexture(team, variantIndex)

    if (texture) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      const scale = PlayerVisual.BODY_HEIGHT / texture.height
      sprite.scale.set(scale)
      return sprite
    }

    // Fallback: a colored circle so the game stays playable without art.
    const color =
      team === 'blue' ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR : VISUAL_CONSTANTS.PLAYER_RED_COLOR
    const circle = new Graphics()
    circle.circle(0, 0, PlayerVisual.R)
    circle.fill(color)
    circle.stroke({ width: 3, color: 0xffffff })
    return circle
  }

  /** Toggle the controlled-player highlight ring. */
  setControlled(isControlled: boolean): void {
    this.ring.visible = isControlled
  }

  /**
   * Rotate the character to face `direction` (radians, 0 = +X). Smoothed along
   * the shortest arc, frame-rate independent (so it feels the same at 30 or 60
   * fps), and kept normalized so it never drifts to huge values.
   * @param deltaMs frame time in milliseconds (defaults to one 60fps frame)
   */
  face(direction: number, deltaMs: number = PlayerVisual.REFERENCE_FRAME_MS): void {
    if (direction === undefined || direction === null || Number.isNaN(direction)) return

    const target = direction + PlayerVisual.FACING_OFFSET
    const diff = Math.atan2(
      Math.sin(target - this.body.rotation),
      Math.cos(target - this.body.rotation)
    )
    const frames = deltaMs / PlayerVisual.REFERENCE_FRAME_MS
    const alpha = 1 - Math.pow(1 - PlayerVisual.ROTATION_SMOOTHING, frames)
    const next = this.body.rotation + diff * alpha
    this.body.rotation = Math.atan2(Math.sin(next), Math.cos(next))
  }
}
