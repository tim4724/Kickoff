import { Container, Graphics, TilingSprite } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { getTexture } from './GameAssets'

/**
 * Field Renderer Utility for PixiJS
 *
 * Draws a full soccer pitch: mowed-grass stripes, regulation markings (boxes,
 * spots, arcs, center circle) and goals rendered with a tiled net texture plus
 * white posts. Markings are visual only and never affect physics.
 */
export class FieldRenderer {
  // Visual constants (UI only, do not affect physics)
  public static readonly FIELD_LINE_MARGIN = 40
  private static readonly GOAL_DEPTH = 40 // How far goal extends visually outside field

  // Pitch colors
  private static readonly GRASS_DARK = 0x2d6a1e
  private static readonly GRASS_LIGHT = 0x368024
  private static readonly LINE_COLOR = 0xffffff
  private static readonly STRIPE_COUNT = 10

  // Marking geometry (visual only)
  private static readonly CENTER_CIRCLE_RADIUS = 120
  private static readonly PENALTY_ARC_RADIUS = 120
  private static readonly CORNER_ARC_RADIUS = 28

  // Goal net appearance
  private static readonly NET_TILE_SCALE = 0.55
  private static readonly NET_BACKING_ALPHA = 0.45

  /**
   * Create the field background, markings and goals.
   * Appends elements to the game container.
   */
  static createField(container: Container): void {
    FieldRenderer.createGrass(container)
    FieldRenderer.createMarkings(container)
    FieldRenderer.createGoals(container)
  }

  /** Mowed-grass base with alternating vertical stripes. */
  private static createGrass(container: Container): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const margin = FieldRenderer.FIELD_LINE_MARGIN

    const grass = new Graphics()
    // Base fill across the whole visual area (field + margin).
    grass.rect(-margin, -margin, width + margin * 2, height + margin * 2)
    grass.fill(FieldRenderer.GRASS_DARK)

    // Lighter vertical mow stripes.
    const stripeWidth = width / FieldRenderer.STRIPE_COUNT
    for (let i = 0; i < FieldRenderer.STRIPE_COUNT; i += 2) {
      grass.rect(i * stripeWidth, -margin, stripeWidth, height + margin * 2)
      grass.fill(FieldRenderer.GRASS_LIGHT)
    }

    grass.zIndex = -20
    container.addChild(grass)
  }

  /** Regulation white pitch markings. */
  private static createMarkings(container: Container): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const height = GAME_CONFIG.FIELD_HEIGHT
    const cx = width / 2
    const cy = height / 2
    const line = FieldRenderer.LINE_COLOR

    const g = new Graphics()
    g.zIndex = -10

    // Outer boundary
    g.rect(0, 0, width, height)
    g.stroke({ width: 5, color: line, alpha: 0.9 })

    // Halfway line
    g.moveTo(cx, 0)
    g.lineTo(cx, height)
    g.stroke({ width: 4, color: line, alpha: 0.8 })

    // Center circle + spot
    g.circle(cx, cy, FieldRenderer.CENTER_CIRCLE_RADIUS)
    g.stroke({ width: 4, color: line, alpha: 0.8 })
    g.circle(cx, cy, 8)
    g.fill(line)

    // Penalty boxes, goal areas, penalty spots/arcs (mirrored on both ends)
    const penaltyDepth = Math.round(width * 0.15)
    const penaltyHeight = Math.round(height * 0.64)
    const goalAreaDepth = Math.round(width * 0.055)
    const goalAreaHeight = Math.round(height * 0.46)
    const penaltySpotDist = Math.round(width * 0.10)
    const arcRadius = FieldRenderer.PENALTY_ARC_RADIUS

    for (const side of [0, 1] as const) {
      const dir = side === 0 ? 1 : -1 // left goal opens right, right goal opens left
      const goalLineX = side === 0 ? 0 : width

      // Penalty box. rect() must take a POSITIVE width — a negative width
      // (right goal, dir = -1) renders nothing — so anchor x on the left edge.
      const penY = cy - penaltyHeight / 2
      const penX = side === 0 ? goalLineX : goalLineX - penaltyDepth
      g.rect(penX, penY, penaltyDepth, penaltyHeight)
      g.stroke({ width: 4, color: line, alpha: 0.8 })

      // Goal area (6-yard box)
      const gaY = cy - goalAreaHeight / 2
      const gaX = side === 0 ? goalLineX : goalLineX - goalAreaDepth
      g.rect(gaX, gaY, goalAreaDepth, goalAreaHeight)
      g.stroke({ width: 4, color: line, alpha: 0.8 })

      // Penalty spot
      const spotX = goalLineX + penaltySpotDist * dir
      g.circle(spotX, cy, 6)
      g.fill(line)

      // Penalty arc — the "D" outside the penalty box.
      // moveTo to the arc start first; otherwise the path connects from the
      // previous point and draws a stray line across the pitch.
      const boxEdgeX = goalLineX + penaltyDepth * dir
      const dx = Math.abs(boxEdgeX - spotX)
      const theta = Math.acos(Math.min(1, dx / arcRadius))
      const startAngle = side === 0 ? -theta : Math.PI - theta
      const endAngle = side === 0 ? theta : Math.PI + theta
      g.moveTo(spotX + arcRadius * Math.cos(startAngle), cy + arcRadius * Math.sin(startAngle))
      g.arc(spotX, cy, arcRadius, startAngle, endAngle)
      g.stroke({ width: 4, color: line, alpha: 0.8 })
    }

    // Corner arcs (moveTo before each so they stay disconnected)
    const cr = FieldRenderer.CORNER_ARC_RADIUS
    g.moveTo(cr, 0)
    g.arc(0, 0, cr, 0, Math.PI / 2)
    g.moveTo(width, cr)
    g.arc(width, 0, cr, Math.PI / 2, Math.PI)
    g.moveTo(width - cr, height)
    g.arc(width, height, cr, Math.PI, Math.PI * 1.5)
    g.moveTo(0, height - cr)
    g.arc(0, height, cr, Math.PI * 1.5, Math.PI * 2)
    g.stroke({ width: 4, color: line, alpha: 0.8 })

    container.addChild(g)
  }

  /** Goals: tiled net texture inside a white frame, with posts. */
  private static createGoals(container: Container): void {
    const width = GAME_CONFIG.FIELD_WIDTH
    const goalDepth = FieldRenderer.GOAL_DEPTH
    const goalY = GAME_CONFIG.GOAL_Y_MIN
    const goalHeight = GAME_CONFIG.GOAL_Y_MAX - GAME_CONFIG.GOAL_Y_MIN
    const netTexture = getTexture('goalNet')

    const makeGoal = (goalLineX: number, side: 'left' | 'right') => {
      const boxX = side === 'left' ? goalLineX - goalDepth : goalLineX

      // Dark backing so the net reads against the grass
      const backing = new Graphics()
      backing.rect(boxX, goalY, goalDepth, goalHeight)
      backing.fill({ color: 0x12361a, alpha: FieldRenderer.NET_BACKING_ALPHA })
      backing.zIndex = -6
      container.addChild(backing)

      // Net
      if (netTexture) {
        const net = new TilingSprite({
          texture: netTexture,
          width: goalDepth,
          height: goalHeight,
        })
        net.position.set(boxX, goalY)
        net.tileScale.set(FieldRenderer.NET_TILE_SCALE)
        net.alpha = 0.9
        net.zIndex = -5
        container.addChild(net)
      } else {
        const net = new Graphics()
        net.rect(boxX, goalY, goalDepth, goalHeight)
        net.fill({ color: 0xffffff, alpha: 0.5 })
        net.zIndex = -5
        container.addChild(net)
      }

      // White goal frame outline
      const frame = new Graphics()
      frame.rect(boxX, goalY, goalDepth, goalHeight)
      frame.stroke({ width: 6, color: 0xffffff, alpha: 1 })
      frame.zIndex = -4
      container.addChild(frame)

      // Posts at the goal mouth (on the goal line)
      const postRadius = 10
      for (const py of [GAME_CONFIG.GOAL_Y_MIN, GAME_CONFIG.GOAL_Y_MAX]) {
        const post = new Graphics()
        post.circle(0, 0, postRadius)
        post.fill(0xffffff)
        post.position.set(goalLineX, py)
        post.zIndex = -3
        container.addChild(post)
      }
    }

    makeGoal(0, 'left')
    makeGoal(width, 'right')
  }
}
