import Phaser from 'phaser'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  /**
   * Request fullscreen using Phaser's Scale Manager (mobile only)
   * Note: iOS Safari does NOT support fullscreen API - user must install as PWA
   * Android browsers support this when triggered by user interaction
   */
  private requestFullscreen(): void {
    // Only request fullscreen on mobile devices
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isMobile) {
      console.log('💻 Desktop detected - skipping fullscreen request')
      return
    }

    // Check if fullscreen is supported
    if (!this.scale.fullscreen.available) {
      console.log('📱 Fullscreen API not available (iOS requires PWA installation)')
      return
    }

    // Check if already in fullscreen
    if (this.scale.isFullscreen) {
      console.log('📱 Already in fullscreen mode')
      return
    }

    // Use Phaser's scale manager to request fullscreen
    this.scale.startFullscreen()
    console.log('📱 Fullscreen mode requested')
  }

  create() {
    const width = this.scale.width
    const height = this.scale.height

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a)

    // Title
    const title = this.add.text(width / 2, height * 0.25, 'KICKOFF', {
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)

    // Single Player Button
    const singlePlayerButton = this.add.rectangle(
      width / 2,
      height * 0.5,
      400,
      80,
      0x0066ff
    )
    singlePlayerButton.setInteractive({ useHandCursor: true })

    const singlePlayerText = this.add.text(width / 2, height * 0.5, 'Single Player', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    singlePlayerText.setOrigin(0.5)

    // Multiplayer Button
    const multiplayerButton = this.add.rectangle(
      width / 2,
      height * 0.65,
      400,
      80,
      0xff4444
    )
    multiplayerButton.setInteractive({ useHandCursor: true })

    const multiplayerText = this.add.text(width / 2, height * 0.65, 'Multiplayer', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    multiplayerText.setOrigin(0.5)

    // AI-Only Button (Dev Mode)
    const aiOnlyButton = this.add.rectangle(
      width / 2,
      height * 0.8,
      400,
      80,
      0xffaa00
    )
    aiOnlyButton.setInteractive({ useHandCursor: true })

    const aiOnlyText = this.add.text(width / 2, height * 0.8, 'AI-Only (Dev)', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    aiOnlyText.setOrigin(0.5)

    // Button hover effects
    singlePlayerButton.on('pointerover', () => {
      singlePlayerButton.setFillStyle(0x0088ff)
    })
    singlePlayerButton.on('pointerout', () => {
      singlePlayerButton.setFillStyle(0x0066ff)
    })

    multiplayerButton.on('pointerover', () => {
      multiplayerButton.setFillStyle(0xff6666)
    })
    multiplayerButton.on('pointerout', () => {
      multiplayerButton.setFillStyle(0xff4444)
    })

    aiOnlyButton.on('pointerover', () => {
      aiOnlyButton.setFillStyle(0xffcc00)
    })
    aiOnlyButton.on('pointerout', () => {
      aiOnlyButton.setFillStyle(0xffaa00)
    })

    // Button click handlers - Using 'pointerup' for touch device compatibility
    // Note: Touch devices require 'pointerup' for fullscreen requests to work
    singlePlayerButton.on('pointerup', () => {
      console.log('🎮 Starting Single Player mode')
      this.requestFullscreen()
      this.scene.start('SinglePlayerScene')
    })

    multiplayerButton.on('pointerup', () => {
      console.log('🌐 Starting Multiplayer mode')
      this.requestFullscreen()
      this.scene.start('GameScene')
    })

    aiOnlyButton.on('pointerup', () => {
      console.log('🤖 Starting AI-Only mode')
      this.requestFullscreen()
      this.scene.start('AIOnlyScene')
    })

    // Version info
    const versionText = this.add.text(width / 2, height * 0.9, 'v0.2.0 - Single Player Update', {
      fontSize: '16px',
      color: '#888888',
    })
    versionText.setOrigin(0.5)

    console.log('📋 Menu scene loaded')

    // Auto-start multiplayer for tests
    if (typeof window !== 'undefined' && (window as any).__testRoomId) {
      console.log('🧪 Test mode detected - auto-starting multiplayer')
      this.time.delayedCall(100, () => {
        this.scene.start('GameScene')
      })
    }
  }
}
