import Phaser from 'phaser'
import { sceneRouter } from '../utils/SceneRouter'

export class MenuScene extends Phaser.Scene {
  // UI element references for responsive layout
  private background!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private singlePlayerButton!: Phaser.GameObjects.Rectangle
  private singlePlayerText!: Phaser.GameObjects.Text
  private multiplayerButton!: Phaser.GameObjects.Rectangle
  private multiplayerText!: Phaser.GameObjects.Text
  private aiOnlyButton!: Phaser.GameObjects.Rectangle
  private aiOnlyText!: Phaser.GameObjects.Text
  private versionText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'MenuScene' })
  }

  /**
   * Layout all UI elements responsively based on current screen size
   * Called on create() and whenever screen size changes (resize/rotation)
   */
  private layoutUI(): void {
    const width = this.scale.width
    const height = this.scale.height
    const centerX = width / 2
    const centerY = height / 2

    // Determine if portrait or landscape
    const isPortrait = height > width

    // Scale factor based on screen size (relative to standard 1920x1080)
    // const scaleFactor = Math.min(width / 1920, height / 1080) // Reserved for future use

    // Button dimensions - more screen-relative with better proportions
    // Max 85% of width, but cap at 500px for larger screens
    const buttonWidth = Math.min(400, width * 0.85, 500)
    // Height proportional to width (20% of width), with sensible min/max
    const buttonHeight = Math.max(60, Math.min(buttonWidth * 0.2, 100))

    // Font sizes scale with screen width for better readability on small screens
    // Title: 8% of width (larger minimum for small screens)
    const titleFontSize = Math.max(48, Math.min(width * 0.08, 120))
    // Button text: 4% of width (increased minimum from 18 to 20)
    const buttonFontSize = Math.max(20, Math.min(width * 0.04, 48))
    // Version text: 2.5% of width (increased minimum from 12 to 14)
    const versionFontSize = Math.max(14, Math.min(width * 0.025, 20))

    // Update background
    this.background.setSize(width, height)
    this.background.setPosition(centerX, centerY)

    // Update title
    this.title.setFontSize(titleFontSize)
    this.title.setPosition(centerX, height * 0.2)

    // Adjust vertical spacing based on orientation
    let buttonSpacing: number
    if (isPortrait) {
      // Portrait: tighter spacing
      buttonSpacing = height * 0.15
    } else {
      // Landscape: more generous spacing
      buttonSpacing = height * 0.18
    }

    // Calculate button positions
    const firstButtonY = isPortrait ? height * 0.4 : height * 0.45
    const secondButtonY = firstButtonY + buttonSpacing
    const thirdButtonY = secondButtonY + buttonSpacing

    // Update Single Player Button
    this.singlePlayerButton.setSize(buttonWidth, buttonHeight)
    this.singlePlayerButton.setPosition(centerX, firstButtonY)

    this.singlePlayerText.setFontSize(buttonFontSize)
    this.singlePlayerText.setPosition(centerX, firstButtonY)

    // Update Multiplayer Button
    this.multiplayerButton.setSize(buttonWidth, buttonHeight)
    this.multiplayerButton.setPosition(centerX, secondButtonY)

    this.multiplayerText.setFontSize(buttonFontSize)
    this.multiplayerText.setPosition(centerX, secondButtonY)

    // Update AI-Only Button
    this.aiOnlyButton.setSize(buttonWidth, buttonHeight)
    this.aiOnlyButton.setPosition(centerX, thirdButtonY)

    this.aiOnlyText.setFontSize(buttonFontSize)
    this.aiOnlyText.setPosition(centerX, thirdButtonY)

    // Update version text
    this.versionText.setFontSize(versionFontSize)
    this.versionText.setPosition(centerX, height * 0.95)

    console.log(`📐 Layout updated: ${width}x${height} (${isPortrait ? 'portrait' : 'landscape'})`)
  }

  create() {
    const width = this.scale.width
    const height = this.scale.height

    // Background
    this.background = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a)

    // Title
    this.title = this.add.text(width / 2, height * 0.25, 'KICKOFF', {
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.title.setOrigin(0.5)

    // Single Player Button
    this.singlePlayerButton = this.add.rectangle(
      width / 2,
      height * 0.5,
      400,
      80,
      0x0066ff
    )
    this.singlePlayerButton.setInteractive({ useHandCursor: true })

    this.singlePlayerText = this.add.text(width / 2, height * 0.5, 'Single Player', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.singlePlayerText.setOrigin(0.5)

    // Multiplayer Button
    this.multiplayerButton = this.add.rectangle(
      width / 2,
      height * 0.65,
      400,
      80,
      0xff4444
    )
    this.multiplayerButton.setInteractive({ useHandCursor: true })

    this.multiplayerText = this.add.text(width / 2, height * 0.65, 'Multiplayer', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.multiplayerText.setOrigin(0.5)

    // AI-Only Button (Dev Mode)
    this.aiOnlyButton = this.add.rectangle(
      width / 2,
      height * 0.8,
      400,
      80,
      0xffaa00
    )
    this.aiOnlyButton.setInteractive({ useHandCursor: true })

    this.aiOnlyText = this.add.text(width / 2, height * 0.8, 'AI-Only (Dev)', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.aiOnlyText.setOrigin(0.5)

    // Version info
    this.versionText = this.add.text(width / 2, height * 0.9, 'v0.2.0 - Single Player Update', {
      fontSize: '16px',
      color: '#888888',
    })
    this.versionText.setOrigin(0.5)

    // Button hover effects
    this.singlePlayerButton.on('pointerover', () => {
      this.singlePlayerButton.setFillStyle(0x0088ff)
    })
    this.singlePlayerButton.on('pointerout', () => {
      this.singlePlayerButton.setFillStyle(0x0066ff)
    })

    this.multiplayerButton.on('pointerover', () => {
      this.multiplayerButton.setFillStyle(0xff6666)
    })
    this.multiplayerButton.on('pointerout', () => {
      this.multiplayerButton.setFillStyle(0xff4444)
    })

    this.aiOnlyButton.on('pointerover', () => {
      this.aiOnlyButton.setFillStyle(0xffcc00)
    })
    this.aiOnlyButton.on('pointerout', () => {
      this.aiOnlyButton.setFillStyle(0xffaa00)
    })

    // Button click handlers - Using 'pointerup' for touch device compatibility
    // Note: Fullscreen is handled globally in main.ts on first touch
    this.singlePlayerButton.on('pointerup', () => {
      console.log('🎮 Starting Single Player mode')
      sceneRouter.navigateTo('SinglePlayerScene')
    })

    this.multiplayerButton.on('pointerup', () => {
      console.log('🌐 Starting Multiplayer mode')
      sceneRouter.navigateTo('GameScene')
    })

    this.aiOnlyButton.on('pointerup', () => {
      console.log('🤖 Starting AI-Only mode')
      sceneRouter.navigateTo('AIOnlyScene')
    })

    // Initial layout
    this.layoutUI()

    // Listen for resize events (screen rotation, window resize)
    this.scale.on('resize', this.handleResize, this)

    // Also listen for native orientation change events (important for fullscreen on mobile)
    // Phaser's resize event doesn't always fire during fullscreen orientation changes
    window.addEventListener('orientationchange', this.handleOrientationChange)

    console.log('📋 Menu scene loaded with responsive layout')

    // Auto-start multiplayer for tests
    if (typeof window !== 'undefined' && (window as any).__testRoomId) {
      console.log('🧪 Test mode detected - auto-starting multiplayer via router')
      this.time.delayedCall(100, () => {
        sceneRouter.navigateTo('GameScene')
      })
    }
  }

  /**
   * Handle resize events (called by Phaser when screen size changes)
   */
  private handleResize(gameSize: Phaser.Structs.Size): void {
    // Only handle resize if this scene is active
    if (!this.scene.isActive()) {
      return
    }

    console.log(`🔄 [MenuScene] Resize detected: ${gameSize.width}x${gameSize.height}`)

    // Update camera viewport to match new size
    const camera = this.cameras.main
    if (camera) {
      camera.setViewport(0, 0, gameSize.width, gameSize.height)
      camera.setScroll(0, 0)
    }

    // Re-layout all UI elements
    this.layoutUI()
  }

  /**
   * Handle native orientation change events (for fullscreen rotation on mobile)
   * Phaser's resize event doesn't always fire during fullscreen, so we listen to this too
   */
  private handleOrientationChange = (): void => {
    // Only handle if this scene is active
    if (!this.scene.isActive()) {
      return
    }

    console.log('🔄 [MenuScene] Orientation change detected')

    // Wait a bit for the actual resize to happen
    setTimeout(() => {
      // Double-check scene is still active after timeout
      if (!this.scene.isActive()) {
        return
      }

      const width = window.innerWidth
      const height = window.innerHeight

      console.log(`📐 [MenuScene] New dimensions after orientation: ${width}x${height}`)

      // Manually trigger resize handling
      const camera = this.cameras.main
      if (camera) {
        camera.setViewport(0, 0, width, height)
        camera.setScroll(0, 0)
      }

      // Force Phaser to update scale
      this.scale.resize(width, height)

      // Re-layout UI
      this.layoutUI()
    }, 100)
  }

  /**
   * Cleanup: remove listeners when scene shuts down
   */
  shutdown(): void {
    this.scale.off('resize', this.handleResize, this)
    window.removeEventListener('orientationchange', this.handleOrientationChange)
  }
}
