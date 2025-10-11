import Phaser from 'phaser'
import { GAME_CONFIG } from '@shared/types'

/**
 * Camera Manager Utility
 * Shared camera setup and viewport management for dual-camera system
 */
export class CameraManager {
  private gameCamera: Phaser.Cameras.Scene2D.Camera
  private uiCamera: Phaser.Cameras.Scene2D.Camera
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Use main camera as game camera
    this.gameCamera = scene.cameras.main
    this.gameCamera.setBounds(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT)

    // Create UI camera
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height)

    // Set initial viewport
    this.updateGameCameraViewport()

    // Listen for resize events
    scene.scale.on('resize', this.onResize, this)
  }

  getGameCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.gameCamera
  }

  getUICamera(): Phaser.Cameras.Scene2D.Camera {
    return this.uiCamera
  }

  updateGameCameraViewport(): void {
    const screenWidth = this.scene.scale.width
    const screenHeight = this.scene.scale.height
    const targetAspect = GAME_CONFIG.FIELD_WIDTH / GAME_CONFIG.FIELD_HEIGHT

    let viewportX = 0
    let viewportY = 0
    let viewportWidth = screenWidth
    let viewportHeight = screenHeight

    // Letterbox or pillarbox to maintain aspect ratio
    if (screenWidth / screenHeight > targetAspect) {
      // Screen is wider - add pillarbox
      viewportHeight = screenHeight
      viewportWidth = screenHeight * targetAspect
      viewportX = (screenWidth - viewportWidth) / 2
      viewportY = 0
    } else {
      // Screen is taller - add letterbox
      viewportWidth = screenWidth
      viewportHeight = screenWidth / targetAspect
      viewportX = 0
      viewportY = (screenHeight - viewportHeight) / 2
    }

    this.gameCamera.setViewport(viewportX, viewportY, viewportWidth, viewportHeight)

    // Calculate zoom to fit field in viewport
    const zoomX = viewportWidth / GAME_CONFIG.FIELD_WIDTH
    const zoomY = viewportHeight / GAME_CONFIG.FIELD_HEIGHT
    const zoom = Math.min(zoomX, zoomY)

    this.gameCamera.setZoom(zoom)
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.uiCamera.setSize(gameSize.width, gameSize.height)
    this.updateGameCameraViewport()
  }

  destroy(): void {
    this.scene.scale.off('resize', this.onResize, this)
  }
}
