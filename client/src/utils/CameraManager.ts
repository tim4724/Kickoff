import { Container } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { PixiScene } from './PixiScene'

/**
 * Camera Manager Utility for PixiJS
 * Simulates a dual-camera system using Containers.
 */
export class CameraManager {
  private gameContainer: Container
  private uiContainer: Container

  // We need to mask the game container to create letterboxing effect visually if needed,
  // or simply rely on the fact that outside area is background color.
  // Phaser's setViewport creates a clipping region effectively.
  // In Pixi, we can use a mask or just position/scale the container.

  constructor(scene: PixiScene) {
    this.gameContainer = new Container()
    this.uiContainer = new Container()

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
    // UI elements are usually positioned relative to screen corners in the scene code.
    // So the container itself is just at 0,0 and 1:1 scale.
    this.uiContainer.position.set(0, 0)
    this.uiContainer.scale.set(1)

    // 2. Resize Game Container (Letterbox/Pillarbox)
    const targetAspect = GAME_CONFIG.FIELD_WIDTH / GAME_CONFIG.FIELD_HEIGHT

    let viewportX = 0
    let viewportY = 0
    let viewportWidth = screenWidth
    let viewportHeight = screenHeight

    if (screenWidth / screenHeight > targetAspect) {
      // Screen is wider - pillarbox
      viewportHeight = screenHeight
      viewportWidth = screenHeight * targetAspect
      viewportX = (screenWidth - viewportWidth) / 2
      viewportY = 0
    } else {
      // Screen is taller - letterbox
      viewportWidth = screenWidth
      viewportHeight = screenWidth / targetAspect
      viewportX = 0
      viewportY = (screenHeight - viewportHeight) / 2
    }

    // Position the game container
    this.gameContainer.position.set(viewportX, viewportY)

    // Calculate zoom to fit field in viewport
    const zoomX = viewportWidth / GAME_CONFIG.FIELD_WIDTH
    const zoomY = viewportHeight / GAME_CONFIG.FIELD_HEIGHT
    const zoom = Math.min(zoomX, zoomY)

    this.gameContainer.scale.set(zoom)

    // Optional: Masking
    // If we want to strictly clip content outside the viewport:
    // const mask = new Graphics().rect(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT).fill(0xffffff);
    // this.gameContainer.mask = mask;
    // this.gameContainer.addChild(mask); // Mask needs to be in display list usually or just assigned
  }

  destroy(): void {
    this.gameContainer.destroy({ children: true })
    this.uiContainer.destroy({ children: true })
  }
}
