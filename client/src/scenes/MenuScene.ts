import { Application, Container, Graphics, Text, Rectangle } from 'pixi.js'
import { sceneRouter } from '../utils/SceneRouter'
import { PixiScene } from '../utils/PixiScene'
import { PixiSceneManager } from '../utils/PixiSceneManager'

export class MenuScene extends PixiScene {
  // UI element references
  private background!: Graphics
  private title!: Text
  private singlePlayerButton!: Container
  private singlePlayerText!: Text
  private multiplayerButton!: Container
  private multiplayerText!: Text
  private aiOnlyButton!: Container
  private aiOnlyText!: Text
  private versionText!: Text
  private clickBlockUntil: number = 0
  private hadPointerDown: boolean = false

  constructor(app: Application, key: string, manager: PixiSceneManager) {
    super(app, key, manager)
  }

  /**
   * Expose test API for Playwright
   */
  private setupTestAPI(): void {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const testAPI = {
        scene: this,
        game: this.app,
        getMenuElements: () => ({
          singlePlayerButton: this.singlePlayerButton,
          multiplayerButton: this.multiplayerButton,
          aiOnlyButton: this.aiOnlyButton,
        }),
      };

      (window as any).__menuControls = {
        test: testAPI,
      }
      // Add alias for tests expecting __menuButtons
      ;(window as any).__menuButtons = {
          singlePlayer: this.singlePlayerButton,
          multiplayer: this.multiplayerButton,
          aiOnly: this.aiOnlyButton
      }

      console.log('🧪 Menu Test API exposed: window.__menuControls')
    }
  }

  /**
   * Layout all UI elements responsively based on current screen size
   */
  public resize(width: number, height: number): void {
    console.log(`🔄 [MenuScene] Resize detected: ${width}x${height}`)
    const centerX = width / 2

    // Determine if portrait or landscape
    const isPortrait = height > width

    // Button dimensions
    const baseDim = Math.min(width, height)
    const buttonWidth = Math.min(432, baseDim * 0.8)
    const buttonHeight = Math.min(70, buttonWidth * 0.22)

    // Font sizes
    const titleFontSize = Math.max(51, baseDim * 0.084)
    const buttonFontSize = Math.max(32, baseDim * 0.032)
    const versionFontSize = Math.max(10, Math.min(baseDim * 0.0175, 14))

    // Update background
    this.background.clear()
    this.background.rect(0, 0, width, height)
    this.background.fill(0x0f1013)

    // Update title
    this.title.style.fontSize = titleFontSize
    this.title.position.set(centerX, height * 0.15)

    const buttonSpacing = Math.max(height * (isPortrait ? 0.12 : 0.1), buttonHeight * 1.25)
    const panelCenterY = height * (isPortrait ? 0.56 : 0.55)

    // Calculate button positions
    const firstButtonY = panelCenterY - buttonSpacing
    const secondButtonY = firstButtonY + buttonSpacing
    const thirdButtonY = secondButtonY + buttonSpacing

    // Update Single Player Button
    this.updateButtonLayout(this.singlePlayerButton, this.singlePlayerText, centerX, firstButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update Multiplayer Button
    this.updateButtonLayout(this.multiplayerButton, this.multiplayerText, centerX, secondButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update AI-Only Button
    this.updateButtonLayout(this.aiOnlyButton, this.aiOnlyText, centerX, thirdButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update version text
    this.versionText.style.fontSize = versionFontSize
    this.versionText.position.set(centerX, height * 0.95)
  }

  private updateButtonLayout(buttonContainer: Container, text: Text, x: number, y: number, width: number, height: number, fontSize: number) {
    // Set position (button is centered via pivot)
    buttonContainer.position.set(x, y)

    // Update hit area (relative to pivot center)
    // Hit area should cover from -width/2 to width/2
    buttonContainer.hitArea = new Rectangle(-width / 2, -height / 2, width, height);

    // Redraw background with new size
    this.drawButtonBackground(buttonContainer, width, height)

    // Update text
    text.style.fontSize = fontSize
    text.position.set(0, 0) // Centered because pivot is center
  }

  private drawButtonBackground(buttonContainer: Container, width: number, height: number) {
    const bg = buttonContainer.getChildAt(0) as Graphics
    const color = (bg as any)._customColor || 0x000000

    bg.clear()
    // Draw centered rect
    bg.roundRect(-width / 2, -height / 2, width, height, 0)
    bg.fill(color)
    bg.stroke({ width: 2, color: 0xffffff, alpha: 0.1 })

    // Store current dimensions for redrawing on color change without full resize args
    ;(buttonContainer as any)._currentWidth = width;
    ;(buttonContainer as any)._currentHeight = height;
  }

  async create() {
    console.log('🚀 MenuScene.create() called')
    try {
      // Background
      this.background = new Graphics()
      this.container.addChild(this.background)

      // Title
      this.title = new Text({
        text: 'KICKOFF',
        style: {
            fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 72,
            fill: '#ffffff',
            fontWeight: 'bold',
            align: 'center',
        }
      })
      this.title.anchor.set(0.5)
      this.container.addChild(this.title)

      // Buttons
      this.singlePlayerButton = this.createButton('Single Player', 0x1d9bf0, 0x3b82f6, () => {
          console.log('🎮 Starting Single Player mode')
          sceneRouter.navigateTo('SinglePlayerScene')
      })
      this.singlePlayerText = this.singlePlayerButton.getChildAt(1) as Text
      this.container.addChild(this.singlePlayerButton)

      this.multiplayerButton = this.createButton('Multiplayer', 0x16a34a, 0x22c55e, () => {
        console.log('🌐 Starting Multiplayer mode')
        sceneRouter.navigateTo('LobbyScene')
      })
      this.multiplayerText = this.multiplayerButton.getChildAt(1) as Text
      this.container.addChild(this.multiplayerButton)

      this.aiOnlyButton = this.createButton('AI-Only (Dev)', 0xf97316, 0xfb923c, () => {
        console.log('🤖 Starting AI-Only mode')
        sceneRouter.navigateTo('AIOnlyScene')
      })
      this.aiOnlyText = this.aiOnlyButton.getChildAt(1) as Text
      this.container.addChild(this.aiOnlyButton)

      // Version info
      let versionLabel = `v${import.meta.env.APP_VERSION || '0.0.0'}`
      const commitHash = import.meta.env.COMMIT_HASH
      if (commitHash) {
        versionLabel += `-${commitHash.substring(0, 7)}`
      }
      this.versionText = new Text({
          text: versionLabel,
          style: {
            fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 16,
            fill: '#a7b2c7',
          }
      })
      this.versionText.anchor.set(0.5)
      this.container.addChild(this.versionText)

      this.clickBlockUntil = performance.now() + 250

      console.log('📋 Menu scene loaded with responsive layout')

      // Expose test API for Playwright
      this.setupTestAPI()
      if (typeof window !== 'undefined' && import.meta.env.DEV) {
        (window as any).__menuLoaded = true
      }

      // Auto-start multiplayer for tests
      if (typeof window !== 'undefined' && (window as any).__testRoomId && import.meta.env.DEV) {
        console.log('🧪 Test mode detected - auto-starting multiplayer')
        setTimeout(() => {
          sceneRouter.navigateTo('MultiplayerScene')
        }, 100)
      }
    } catch (err) {
      console.error('❌ Error in MenuScene.create:', err)
    }
  }

  private createButton(label: string, color: number, hoverColor: number, callback: () => void): Container {
    const container = new Container()

    // Background
    const bg = new Graphics()
    ;(bg as any)._customColor = color
    container.addChild(bg)

    // Text
    const text = new Text({
        text: label,
        style: {
            fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 32,
            fill: '#ffffff',
            fontWeight: 'bold',
            align: 'center',
            letterSpacing: 0.5,
            dropShadow: {
                color: 'rgba(0,0,0,0.4)',
                blur: 2,
                distance: 2,
                angle: Math.PI / 2
            }
        }
    })
    text.anchor.set(0.5)
    container.addChild(text)

    // Interaction
    container.eventMode = 'static'
    container.cursor = 'pointer'

    const onPointerOver = () => {
        container.scale.set(1.03)
        ;(bg as any)._customColor = hoverColor
        const w = (container as any)._currentWidth || 100
        const h = (container as any)._currentHeight || 100
        this.drawButtonBackground(container, w, h)
    }

    const onPointerOut = () => {
        container.scale.set(1)
        ;(bg as any)._customColor = color
        const w = (container as any)._currentWidth || 100
        const h = (container as any)._currentHeight || 100
        this.drawButtonBackground(container, w, h)
    }

    const onPointerDown = () => {
        this.hadPointerDown = true
    }

    const onPointerUp = () => {
        if (!this.canProcessClick()) {
            console.log('⛔ Ignoring menu click (debounce window)')
            return
        }
        this.hadPointerDown = false
        callback()
    }

    container.on('pointerover', onPointerOver)
    container.on('pointerout', onPointerOut)
    container.on('pointerdown', onPointerDown)
    container.on('pointerup', onPointerUp)

    return container
  }

  private canProcessClick(): boolean {
    return this.hadPointerDown || performance.now() >= this.clickBlockUntil
  }

  destroy(): void {
    super.destroy()
    if (typeof window !== 'undefined') {
      ; (window as any).__menuLoaded = false
      delete (window as any).__menuButtons
    }
  }
}
