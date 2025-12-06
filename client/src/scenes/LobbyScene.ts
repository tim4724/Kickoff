import { Application, Container, Graphics, Text } from 'pixi.js'
import { sceneRouter } from '../utils/SceneRouter'
import { PixiScene } from '../utils/PixiScene'
import { PixiSceneManager } from '../utils/PixiSceneManager'
import { NetworkManager } from '../network/NetworkManager'

export class LobbyScene extends PixiScene {
  private background!: Graphics
  private title!: Text
  private listContainer!: Container
  private createButton!: Container
  private backButton!: Container
  private statusText!: Text

  constructor(app: Application, key: string, manager: PixiSceneManager) {
    super(app, key, manager)
  }

  async create() {
    console.log('🏗️ LobbyScene created')
    this.background = new Graphics()
    this.container.addChild(this.background)

    this.title = new Text({
        text: 'LOBBY',
        style: {
            fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 48,
            fill: '#ffffff',
            fontWeight: 'bold',
        }
    })
    this.title.anchor.set(0.5, 0)
    this.container.addChild(this.title)

    this.listContainer = new Container()
    this.container.addChild(this.listContainer)

    this.createButton = this.createButtonElement('Create New Room', 0x16a34a, () => this.handleCreateRoom())
    this.container.addChild(this.createButton)

    this.backButton = this.createButtonElement('Back', 0x666666, () => sceneRouter.navigateTo('MenuScene'))
    this.container.addChild(this.backButton)

    this.statusText = new Text({
        text: 'Loading rooms...',
        style: {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 24,
            fill: '#aaaaaa'
        }
    })
    this.statusText.anchor.set(0.5)
    this.container.addChild(this.statusText)

    this.refreshRooms()
  }

  resize(width: number, height: number) {
      this.background.clear().rect(0, 0, width, height).fill(0x0f1013)
      this.title.position.set(width / 2, height * 0.1)

      this.listContainer.position.set(width / 2, height * 0.25)

      this.createButton.position.set(width / 2, height * 0.8)
      this.backButton.position.set(width / 2, height * 0.9)

      this.statusText.position.set(width / 2, height * 0.5)
  }

  private createButtonElement(label: string, color: number, callback: () => void): Container {
      const btn = new Container()
      const bg = new Graphics()

      // Draw initial state
      bg.roundRect(-150, -25, 300, 50, 10).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.3 })
      btn.addChild(bg)

      const txt = new Text({
          text: label,
          style: {
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 20,
              fill: '#fff',
              fontWeight: 'bold'
          }
      })
      txt.anchor.set(0.5)
      btn.addChild(txt)

      btn.eventMode = 'static'
      btn.cursor = 'pointer'

      btn.on('pointerover', () => {
          btn.scale.set(1.05)
          bg.clear().roundRect(-150, -25, 300, 50, 10).fill(color + 0x111111).stroke({ width: 2, color: 0xffffff })
      })
      btn.on('pointerout', () => {
          btn.scale.set(1)
          bg.clear().roundRect(-150, -25, 300, 50, 10).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.3 })
      })

      btn.on('pointerup', callback)
      return btn
  }

  private async refreshRooms() {
      try {
          const rooms = await NetworkManager.getInstance().getRooms()
          this.renderRoomList(rooms)
      } catch (e) {
          this.statusText.text = 'Failed to load rooms'
          this.statusText.visible = true
          console.error(e)
      }
  }

  private renderRoomList(rooms: any[]) {
      this.listContainer.removeChildren()

      // Filter out full rooms for display
      const visibleRooms = rooms.filter(r => r.clients < r.maxClients && !r.locked)

      if (visibleRooms.length === 0) {
          this.statusText.text = 'No open rooms available.'
          this.statusText.visible = true
      } else {
          this.statusText.visible = false

          visibleRooms.forEach((room, index) => {
               const roomName = room.metadata?.roomName || `Room ${room.roomId}`
               const btn = this.createButtonElement(`${roomName} (${room.clients}/${room.maxClients})`, 0x1d9bf0, () => {
                   this.handleJoinRoom(room.roomId)
               })
               btn.y = index * 60
               this.listContainer.addChild(btn)
          })
      }
  }

  private async handleCreateRoom() {
       this.statusText.text = 'Creating room...'
       this.statusText.visible = true
       this.listContainer.visible = false

       try {
           const rooms = await NetworkManager.getInstance().getRooms()

           // Parse existing numbers from ALL rooms (including full/locked ones)
           const numbers = new Set<number>()
           rooms.forEach(r => {
               const name = r.metadata?.roomName || ''
               const match = name.match(/Room (\d+)/)
               if (match) numbers.add(parseInt(match[1]))
           })

           // Find lowest available number
           let nextNum = 1
           while (numbers.has(nextNum)) nextNum++

           const roomName = `Room ${nextNum}`
           console.log(`Creating room: ${roomName}`)

           await NetworkManager.getInstance().joinRoom({ roomName })
           sceneRouter.navigateTo('MultiplayerScene')
       } catch (e) {
           console.error(e)
           this.statusText.text = 'Error creating room'
           this.listContainer.visible = true
       }
  }

  private async handleJoinRoom(roomId: string) {
      this.statusText.text = 'Joining room...'
      this.statusText.visible = true
      this.listContainer.visible = false

      try {
          await NetworkManager.getInstance().joinById(roomId)
          sceneRouter.navigateTo('MultiplayerScene')
      } catch (e) {
           console.error(e)
           this.statusText.text = 'Error joining room'
           this.listContainer.visible = true
      }
  }
}
