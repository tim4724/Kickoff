
import Phaser from 'phaser'
import { sceneRouter } from '../utils/SceneRouter'

export class MenuScene extends Phaser.Scene {
  // UI element references for responsive layout
  private background!: Phaser.GameObjects.Graphics
  private title!: Phaser.GameObjects.Text
  private singlePlayerButton!: Phaser.GameObjects.Rectangle
  private singlePlayerText!: Phaser.GameObjects.Text
  private multiplayerButton!: Phaser.GameObjects.Rectangle
  private multiplayerText!: Phaser.GameObjects.Text
  private aiOnlyButton!: Phaser.GameObjects.Rectangle
  private aiOnlyText!: Phaser.GameObjects.Text
  private versionText!: Phaser.GameObjects.Text
  private clickBlockUntil: number = 0
  private hadPointerDown: boolean = false

  constructor() {
    super({ key: 'MenuScene' })
  }

  /**
   * Expose test API for Playwright
   */
  private setupTestAPI(): void {
    if (typeof window !== 'undefined') {
      const testAPI = {
        scene: this,
        game: this.game,
        getMenuElements: () => ({
          singlePlayerButton: this.singlePlayerButton,
          multiplayerButton: this.multiplayerButton,
          aiOnlyButton: this.aiOnlyButton,
        }),
      };

      (window as any).__menuControls = {
        test: testAPI,
      }

      console.log('🧪 Menu Test API exposed: window.__menuControls')
    }
  }

  /**
   * Layout all UI elements responsively based on current screen size
   * Called on create() and whenever screen size changes (resize/rotation)
   */
  private layoutUI(): void {
    const width = this.scale.width
    const height = this.scale.height
    const centerX = width / 2

    // Determine if portrait or landscape
    const isPortrait = height > width

    // Scale factor based on screen size (relative to standard 1920x1080)
    // const scaleFactor = Math.min(width / 1920, height / 1080) // Reserved for future use

    // Button dimensions - more screen-relative with better proportions
    // Max 85% of width, but cap at 500px for larger screens
    // Use min(width,height) to stabilize sizing across orientations
    const baseDim = Math.min(width, height)
    const buttonWidth = Math.min(432, baseDim * 0.8)
    // Height proportional to base dimension with cap
    const buttonHeight = Math.min(70, buttonWidth * 0.22)

    // Font sizes scale with screen width for better readability on small screens
    // Title: 8% of width (larger minimum for small screens)
    const titleFontSize = Math.max(51, baseDim * 0.084)
    // Button text: 4% of width (increased minimum from 18 to 20)
    const buttonFontSize = Math.max(32, baseDim * 0.032)
    // Version text: 2.5% of width (increased minimum from 12 to 14)
    const versionFontSize = Math.max(10, Math.min(baseDim * 0.0175, 14)) // orientation-stable

    // Update background with flat tone and minimal geometric accents
    this.background.clear()
    this.background.fillStyle(0x0f1013, 1)
    this.background.fillRect(0, 0, width, height)

    // Update title
    this.title.setFontSize(titleFontSize)
    this.title.setPosition(centerX, height * 0.15)

    const buttonSpacing = Math.max(height * (isPortrait ? 0.12 : 0.1), buttonHeight * 1.25)
    const panelCenterY = height * (isPortrait ? 0.56 : 0.55)

    // Calculate button positions
    const firstButtonY = panelCenterY - buttonSpacing
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
    console.log('🚀 MenuScene.create() called')
    try {
      const width = this.scale.width
      const height = this.scale.height

      // Background
      this.background = this.add.graphics({ x: 0, y: 0 })
      this.background.setDepth(-2)

      // Title
      this.title = this.add.text(width / 2, height * 0.25, 'KICKOFF', {
        fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '72px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      this.title.setOrigin(0.5)
      this.title.setResolution(2)
      this.title.setDepth(2)

      // Single Player Button
      this.singlePlayerButton = this.add.rectangle(
        width / 2,
        height * 0.5,
        432,
        100,
        0x1d9bf0
      )
      this.singlePlayerButton.setInteractive({ useHandCursor: true })
      this.singlePlayerButton.setStrokeStyle(2, 0xffffff, 0.1)

      this.singlePlayerText = this.add.text(width / 2, height * 0.5, 'Single Player', {
        fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        letterSpacing: 0.5,
      })
      this.singlePlayerText.setOrigin(0.5)
      this.singlePlayerText.setResolution(2)
      this.singlePlayerText.setShadow(0, 2, 'rgba(0,0,0,0.4)', 2)

      // Multiplayer Button
      this.multiplayerButton = this.add.rectangle(
        width / 2,
        height * 0.65,
        432,
        100,
        0x16a34a
      )
      this.multiplayerButton.setInteractive({ useHandCursor: true })
      this.multiplayerButton.setStrokeStyle(2, 0xffffff, 0.1)

      this.multiplayerText = this.add.text(width / 2, height * 0.65, 'Multiplayer', {
        fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        letterSpacing: 0.5,
      })
      this.multiplayerText.setOrigin(0.5)
      this.multiplayerText.setResolution(2)
      this.multiplayerText.setShadow(0, 2, 'rgba(0,0,0,0.4)', 2)

      // AI-Only Button (Dev Mode)
      this.aiOnlyButton = this.add.rectangle(
        width / 2,
        height * 0.8,
        432,
        100,
        0xf97316
      )
      this.aiOnlyButton.setInteractive({ useHandCursor: true })
      this.aiOnlyButton.setStrokeStyle(2, 0xffffff, 0.1)

      this.aiOnlyText = this.add.text(width / 2, height * 0.8, 'AI-Only (Dev)', {
        fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        letterSpacing: 0.5,
      })
      this.aiOnlyText.setOrigin(0.5)
      this.aiOnlyText.setResolution(2)
      this.aiOnlyText.setShadow(0, 2, 'rgba(0,0,0,0.4)', 2)

      // Version info (injected at build time from package.json or APP_VERSION)
      let versionLabel = `v${import.meta.env.APP_VERSION || '0.0.0'}`
      const commitHash = import.meta.env.COMMIT_HASH
      if (commitHash) {
        versionLabel += `-${commitHash.substring(0, 7)}`
      }
      this.versionText = this.add.text(width / 2, height * 0.9, versionLabel, {
        fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '16px',
        color: '#a7b2c7',
      })
      this.versionText.setOrigin(0.5)
      this.versionText.setResolution(2)
      this.versionText.setBackgroundColor('rgba(0,0,0,0.35)')
      this.versionText.setPadding(8, 6, 8, 6)

      // Button hover effects
      this.singlePlayerButton.on('pointerover', () => {
        this.singlePlayerButton.setFillStyle(0x3b82f6)
        this.singlePlayerButton.setScale(1.03)
        this.singlePlayerText.setScale(1.03)
      })
      this.singlePlayerButton.on('pointerout', () => {
        this.singlePlayerButton.setFillStyle(0x1d9bf0)
        this.singlePlayerButton.setScale(1)
        this.singlePlayerText.setScale(1)
      })

      this.multiplayerButton.on('pointerover', () => {
        this.multiplayerButton.setFillStyle(0x22c55e)
        this.multiplayerButton.setScale(1.03)
        this.multiplayerText.setScale(1.03)
      })
      this.multiplayerButton.on('pointerout', () => {
        this.multiplayerButton.setFillStyle(0x16a34a)
        this.multiplayerButton.setScale(1)
        this.multiplayerText.setScale(1)
      })

      this.aiOnlyButton.on('pointerover', () => {
        this.aiOnlyButton.setFillStyle(0xfb923c)
        this.aiOnlyButton.setScale(1.03)
        this.aiOnlyText.setScale(1.03)
      })
      this.aiOnlyButton.on('pointerout', () => {
        this.aiOnlyButton.setFillStyle(0xf97316)
        this.aiOnlyButton.setScale(1)
        this.aiOnlyText.setScale(1)
      })

      // Track pointerdown to allow immediate clicks even during the initial debounce window
      const markPointerDown = () => {
        this.hadPointerDown = true
      }

      // Button click handlers - Using 'pointerup' for touch device compatibility
      // Navigate using SceneRouter (hash-based routing)
      this.singlePlayerButton.on('pointerdown', markPointerDown)
      this.singlePlayerButton.on('pointerup', () => {
        if (!this.canProcessClick()) {
          console.log('⛔ Ignoring menu click (debounce window)')
          return
        }
        this.hadPointerDown = false
        console.log('🎮 Starting Single Player mode')
        sceneRouter.navigateTo('SinglePlayerScene')
      })

      this.multiplayerButton.on('pointerdown', markPointerDown)
      this.multiplayerButton.on('pointerup', () => {
        if (!this.canProcessClick()) {
          console.log('⛔ Ignoring menu click (debounce window)')
          return
        }
        this.hadPointerDown = false
        console.log('🌐 Starting Multiplayer mode')
        sceneRouter.navigateTo('MultiplayerScene')
      })

      this.aiOnlyButton.on('pointerdown', markPointerDown)
      this.aiOnlyButton.on('pointerup', () => {
        if (!this.canProcessClick()) {
          console.log('⛔ Ignoring menu click (debounce window)')
          return
        }
        this.hadPointerDown = false
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

      // Ensure input is enabled (may be disabled by previous scene during navigation)
      console.log('🟢 MenuScene enabling input')
      this.input.enabled = true
      this.input.manager.enabled = true
      // Debounce clicks briefly when entering menu to absorb stray pointerup
      this.clickBlockUntil = performance.now() + 250

      console.log('📋 Menu scene loaded with responsive layout')

      // Expose test API for Playwright
      this.setupTestAPI()
      if (typeof window !== 'undefined') {
        (window as any).__menuLoaded = true
      }

      // Auto-start multiplayer for tests
      if (typeof window !== 'undefined' && (window as any).__testRoomId) {
        console.log('🧪 Test mode detected - auto-starting multiplayer')
        this.time.delayedCall(100, () => {
          sceneRouter.navigateTo('MultiplayerScene')
        })
      }
    } catch (err) {
      console.error('❌ Error in MenuScene.create:', err)
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

  private canProcessClick(): boolean {
    // Allow immediate processing if we saw a pointerdown on a menu button,
    // otherwise honor the short debounce window to swallow stray pointerup events.
    return this.hadPointerDown || performance.now() >= this.clickBlockUntil
  }

  /**
   * Cleanup: remove listeners when scene shuts down
   */
  shutdown(): void {
    console.log('[MenuScene] shutdown() called - cleaning up')
    this.scale.off('resize', this.handleResize, this)
    window.removeEventListener('orientationchange', this.handleOrientationChange)

    // Clear test API flags
    if (typeof window !== 'undefined') {
      ; (window as any).__menuLoaded = false
      delete (window as any).__menuButtons
    }
  }
}
