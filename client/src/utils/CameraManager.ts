import { Container } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { PixiScene } from './PixiScene'
import { FieldRenderer } from './FieldRenderer'

/**
 * Camera Manager Utility for PixiJS
 * Simulates a dual-camera system using Containers.
 *
 * The visual field includes a margin around the logical field:
 * - Logical field (physics): 0 to FIELD_WIDTH, 0 to FIELD_HEIGHT
 * - Visual field (rendered): -FIELD_LINE_MARGIN to FIELD_WIDTH+FIELD_LINE_MARGIN, etc.
 *
 * The camera scales to fit the entire visual field while maintaining aspect ratio.
 */
export class CameraManager {
  private gameContainer: Container
  private uiContainer: Container
  private isMobile: boolean

  // Mobile zoom factor - makes field smaller to leave more room for touch controls
  private static readonly MOBILE_ZOOM_FACTOR = 0.85

  constructor(scene: PixiScene, isMobile: boolean = false) {
    this.gameContainer = new Container()
    this.uiContainer = new Container()
    this.isMobile = isMobile

    // Add containers to the scene
    scene.container.addChild(this.gameContainer)
    scene.container.addChild(this.uiContainer)

    // Initial resize to set up viewports
    // We assume scene.app.screen is valid
    this.handleResize(scene.app.screen.width, scene.app.screen.height)
  }

  getGameContainer(): Container {
    return this.gameContainer
  }

  getUIContainer(): Container {
    return this.uiContainer
  }

  public handleResize(screenWidth: number, screenHeight: number): void {
    // 1. Resize UI Container (Fullscreen)
    this.uiContainer.position.set(0, 0)
    this.uiContainer.scale.set(1)

    // 2. Resize Game Container to fit the VISUAL field (including margins)
    const margin = FieldRenderer.FIELD_LINE_MARGIN
    const visualWidth = GAME_CONFIG.FIELD_WIDTH + margin * 2   // 1680
    const visualHeight = GAME_CONFIG.FIELD_HEIGHT + margin * 2  // 1080
    const visualAspect = visualWidth / visualHeight

    // Calculate zoom to fit the entire visual field
    let zoom: number
    if (screenWidth / screenHeight > visualAspect) {
      // Screen is wider than visual field - fit to height
      zoom = screenHeight / visualHeight
    } else {
      // Screen is taller than visual field - fit to width
      zoom = screenWidth / visualWidth
    }

    // Apply mobile zoom factor only in landscape mode
    const isLandscape = screenWidth > screenHeight
    if (this.isMobile && isLandscape) {
      zoom *= CameraManager.MOBILE_ZOOM_FACTOR
    }

    // Calculate the screen position for the visual field to be centered
    // Visual field spans from -margin to FIELD_WIDTH+margin in logical coords
    const visualScreenWidth = visualWidth * zoom
    const visualScreenHeight = visualHeight * zoom
    const visualScreenX = (screenWidth - visualScreenWidth) / 2
    const visualScreenY = (screenHeight - visualScreenHeight) / 2

    // The game container origin (0,0) needs to be offset by margin from the visual corner
    // Because the visual field starts at -margin, the container position should be:
    // visualScreenX + margin * zoom (to account for the -margin offset)
    const containerX = visualScreenX + margin * zoom
    const containerY = visualScreenY + margin * zoom

    this.gameContainer.position.set(containerX, containerY)
    this.gameContainer.scale.set(zoom)
  }

  destroy(): void {
    this.gameContainer.destroy({ children: true })
    this.uiContainer.destroy({ children: true })
  }
}
