import Phaser from 'phaser'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
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

    // Button click handlers
    singlePlayerButton.on('pointerdown', () => {
      console.log('🎮 Starting Single Player mode')
      this.scene.start('SinglePlayerScene')
    })

    multiplayerButton.on('pointerdown', () => {
      console.log('🌐 Starting Multiplayer mode')
      this.scene.start('GameScene')
    })

    // Version info
    const versionText = this.add.text(width / 2, height * 0.9, 'v0.2.0 - Single Player Update', {
      fontSize: '16px',
      color: '#888888',
    })
    versionText.setOrigin(0.5)

    console.log('📋 Menu scene loaded')
  }
}
