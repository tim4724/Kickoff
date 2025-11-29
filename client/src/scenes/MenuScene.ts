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
    if (typeof window !== 'undefined') {
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
    this.updateButton(this.singlePlayerButton, this.singlePlayerText, centerX, firstButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update Multiplayer Button
    this.updateButton(this.multiplayerButton, this.multiplayerText, centerX, secondButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update AI-Only Button
    this.updateButton(this.aiOnlyButton, this.aiOnlyText, centerX, thirdButtonY, buttonWidth, buttonHeight, buttonFontSize)

    // Update version text
    this.versionText.style.fontSize = versionFontSize
    this.versionText.position.set(centerX, height * 0.95)
  }

  private updateButton(buttonContainer: Container, text: Text, x: number, y: number, width: number, height: number, fontSize: number) {
    buttonContainer.position.set(x - width / 2, y - height / 2)

    const bg = buttonContainer.getChildAt(0) as Graphics
    bg.clear()
    bg.roundRect(0, 0, width, height, 0) // Rounded corners handled via graphics context if needed, but Phaser used strict rects mostly? Wait, Phaser rects are usually sharp unless specified.
    // The previous implementation used add.rectangle which is sharp.
    // Let's stick to sharp or slight rounding.
    bg.fill({ color: (bg as any)._customColor, alpha: 1 }) // _customColor is a hack I'll add or I need to store color elsewhere
    bg.stroke({ width: 2, color: 0xffffff, alpha: 0.1 })

    // Center text in button
    text.style.fontSize = fontSize
    text.position.set(width / 2, height / 2)

    // Hit area for interaction
    buttonContainer.hitArea = new Rectangle(0, 0, width, height);
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
        sceneRouter.navigateTo('MultiplayerScene')
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

      // Initial layout
      // We can call resize manually or rely on SceneManager to call it
      // SceneManager calls resize() right after create()

      // Debounce clicks
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

    const bg = new Graphics()
    ;(bg as any)._customColor = color // Store color for resize updates
    bg.rect(0, 0, 100, 100) // Placeholder size
    bg.fill(color)
    container.addChild(bg)

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
        bg.tint = 0xdddddd // Pixi doesn't support easy color swap on graphics without redraw or tint
        // But since we are filling with a solid color, tinting white works if base is white, but here base is colored.
        // Actually tint multiplies.
        // Let's just redraw or scale.
        container.scale.set(1.03)
        // For color change, we might need to redraw or use a Sprite.
        // Let's just stick to scale for now to keep it simple, or redraw.
        bg.clear()
        bg.rect(0, 0, (bg as any).width, (bg as any).height) // This is tricky because width depends on content
        // Easier: Just use tinting if we used a white texture, but we are using graphics.
        // Re-implementing the hover color logic from Phaser:
        ;(bg as any)._customColor = hoverColor
        this.updateButton(container, text, container.x + container.width/2, container.y + container.height/2, (container.hitArea as any).width, (container.hitArea as any).height, (text.style as any).fontSize)
    }

    const onPointerOut = () => {
        container.scale.set(1)
        ;(bg as any)._customColor = color
        this.updateButton(container, text, container.x + container.width/2, container.y + container.height/2, (container.hitArea as any).width, (container.hitArea as any).height, (text.style as any).fontSize)
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
    // Touch specific? Pixi handles pointer events which cover touch.

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
