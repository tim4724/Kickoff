import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js'
import { sceneRouter } from '@/utils/SceneRouter'
import { PixiScene } from '@/utils/PixiScene'
import { PixiSceneManager } from '@/utils/PixiSceneManager'
import { NetworkManager } from '@/network/NetworkManager'

type LobbyRoom = {
  roomId: string
  clients: number
  maxClients: number
  locked?: boolean
  metadata?: {
    roomName?: string
  }
}

export class LobbyScene extends PixiScene {
  private background!: Graphics
  private listPanel!: Graphics
  private title!: Text
  private listTitle!: Text
  private listContainer!: Container
  private createButton!: Container
  private backButton!: Container
  private statusText!: Text
  private refreshInterval: any = null
  private cachedRooms: LobbyRoom[] = []

  private listContentX = 0
  private listContentY = 0
  private listContentWidth = 0
  private listContentHeight = 0
  private listItemHeight = 52
  private listItemGap = 10
  private listItemFontSize = 18

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

    this.listPanel = new Graphics()
    this.container.addChild(this.listPanel)

    this.listTitle = new Text({
      text: 'Open Rooms',
      style: {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 24,
        fill: '#d8e2ff',
        fontWeight: 'bold',
        letterSpacing: 0.5
      }
    })
    this.listTitle.anchor.set(0.5, 0)
    this.container.addChild(this.listTitle)

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
            fontSize: 22,
            fill: '#aaaaaa'
        }
    })
    this.statusText.anchor.set(0.5)
    this.container.addChild(this.statusText)

    this.refreshRooms()
    this.startPolling()
  }

  private startPolling() {
      if (this.refreshInterval) clearInterval(this.refreshInterval)
      this.refreshInterval = setInterval(() => this.refreshRooms(), 5000)
  }

  destroy() {
      if (this.refreshInterval) {
          clearInterval(this.refreshInterval)
          this.refreshInterval = null
      }
      super.destroy()
  }

  resize(width: number, height: number) {
      this.background.clear().rect(0, 0, width, height).fill(0x0f1013)
      const base = Math.min(width, height)
      const insets = this.getSafeAreaInsets()
      const mirroredHorizontalInset = Math.max(insets.left, insets.right)
      const baseSafeX = Math.max(16, width * 0.03)
      const baseSafeY = Math.max(12, height * 0.04)
      // Treat safe-area values as minimum offsets, not additive offsets.
      const safeLeft = Math.max(baseSafeX, mirroredHorizontalInset)
      const safeRight = Math.max(baseSafeX, mirroredHorizontalInset)
      const safeTop = Math.max(baseSafeY, insets.top)
      const safeBottom = Math.max(baseSafeY, insets.bottom)

      const contentLeft = safeLeft
      const contentRight = Math.max(contentLeft + 1, width - safeRight)
      const contentWidth = Math.max(1, contentRight - contentLeft)
      const centerX = contentLeft + contentWidth / 2
      const compactLandscape = width > height && height <= 500

      const titleFont = compactLandscape
        ? this.clamp(base * 0.1, 28, 40)
        : this.clamp(base * 0.12, 36, 54)
      this.title.style.fontSize = titleFont
      this.title.position.set(centerX, safeTop)

      const titleBottom = safeTop + titleFont + Math.max(10, base * 0.03)
      const panelRadius = this.clamp(base * 0.03, 8, 18)
      const panelHeaderHeight = compactLandscape ? 38 : 44
      const panelInnerPad = compactLandscape ? 10 : 14

      let panelX = contentLeft
      let panelY = titleBottom
      let panelWidth = contentWidth
      let panelHeight = height - panelY - safeBottom

      const buttonGap = compactLandscape ? Math.max(10, height * 0.03) : Math.max(8, height * 0.02)
      const actionBtnHeight = compactLandscape
        ? this.clamp(height * 0.14, 42, 56)
        : this.clamp(height * 0.09, 44, 58)
      const actionBtnFont = this.clamp(actionBtnHeight * 0.44, 18, 24)

      if (compactLandscape) {
          const columnGap = Math.max(12, contentWidth * 0.02)
          const splitWidth = Math.max(1, contentWidth - columnGap)
          let listColumnWidth = splitWidth * (2 / 3)
          let actionColumnWidth = splitWidth - listColumnWidth
          const minListWidth = 180
          const minActionWidth = 140

          if (actionColumnWidth < minActionWidth) {
            actionColumnWidth = minActionWidth
            listColumnWidth = splitWidth - actionColumnWidth
          }
          if (listColumnWidth < minListWidth) {
            listColumnWidth = minListWidth
            actionColumnWidth = Math.max(minActionWidth, splitWidth - listColumnWidth)
          }

          panelWidth = listColumnWidth
          panelHeight = height - panelY - safeBottom

          const actionCenterX = panelX + panelWidth + columnGap + actionColumnWidth / 2
          const actionCenterY = panelY + panelHeight / 2
          const actionButtonWidth = this.clamp(actionColumnWidth, 160, 260)

          this.updateButtonLayout(this.createButton, actionButtonWidth, actionBtnHeight, actionBtnFont)
          this.updateButtonLayout(this.backButton, actionButtonWidth, actionBtnHeight, actionBtnFont)
          this.createButton.position.set(actionCenterX, actionCenterY - (actionBtnHeight + buttonGap) / 2)
          this.backButton.position.set(actionCenterX, actionCenterY + (actionBtnHeight + buttonGap) / 2)
      } else {
          const createBackBlockHeight = actionBtnHeight * 2 + buttonGap + Math.max(14, height * 0.025)
          panelHeight = height - panelY - safeBottom - createBackBlockHeight
          panelWidth = Math.min(contentWidth, 760)
          panelX = centerX - panelWidth / 2

          const actionWidth = Math.min(panelWidth, this.clamp(contentWidth * 0.52, 280, 520))
          this.updateButtonLayout(this.createButton, actionWidth, actionBtnHeight, actionBtnFont)
          this.updateButtonLayout(this.backButton, actionWidth, actionBtnHeight, actionBtnFont)
          this.createButton.position.set(centerX, panelY + panelHeight + Math.max(16, base * 0.03) + actionBtnHeight / 2)
          this.backButton.position.set(centerX, this.createButton.y + actionBtnHeight + buttonGap)
      }

      panelHeight = Math.max(panelHeight, compactLandscape ? 130 : 170)

      this.listPanel
        .clear()
        .roundRect(panelX, panelY, panelWidth, panelHeight, panelRadius)
        .fill({ color: 0x171a22, alpha: 0.9 })
        .stroke({ width: 2, color: 0x2f3545, alpha: 0.95 })

      this.listTitle.style.fontSize = this.clamp(base * (compactLandscape ? 0.055 : 0.05), 18, 28)
      this.listTitle.position.set(panelX + panelWidth / 2, panelY + 8)

      this.listContentX = panelX + panelInnerPad
      this.listContentY = panelY + panelHeaderHeight
      this.listContentWidth = panelWidth - panelInnerPad * 2
      this.listContentHeight = panelHeight - panelHeaderHeight - panelInnerPad
      this.listItemHeight = compactLandscape
        ? this.clamp(height * 0.13, 40, 52)
        : this.clamp(height * 0.08, 46, 58)
      this.listItemGap = compactLandscape ? 8 : 10
      this.listItemFontSize = this.clamp(this.listItemHeight * 0.42, 16, 22)

      this.listContainer.position.set(this.listContentX, this.listContentY)
      this.statusText.style.fontSize = this.clamp(base * (compactLandscape ? 0.065 : 0.055), 18, 28)
      this.statusText.position.set(
        this.listContentX + this.listContentWidth / 2,
        this.listContentY + this.listContentHeight / 2
      )

      this.renderRoomList(this.cachedRooms)
  }

  private createButtonElement(label: string, color: number, callback: () => void): Container {
      const btn = new Container()
      const bg = new Graphics()
      btn.addChild(bg)

      const txt = new Text({
          text: label,
          style: {
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18,
              fill: '#fff',
              fontWeight: 'bold',
              align: 'center'
          }
      })
      txt.anchor.set(0.5)
      btn.addChild(txt)

      ;(btn as any)._bg = bg
      ;(btn as any)._text = txt
      ;(btn as any)._baseColor = color
      ;(btn as any)._hoverColor = this.shiftColor(color, 20)

      btn.eventMode = 'static'
      btn.cursor = 'pointer'

      btn.on('pointerover', () => {
          btn.scale.set(1.05)
          this.drawButtonBackground(btn, (btn as any)._hoverColor, 0.8)
      })
      btn.on('pointerout', () => {
          btn.scale.set(1)
          this.drawButtonBackground(btn, color, 0.35)
      })

      btn.on('pointerup', callback)
      this.updateButtonLayout(btn, 320, 52, 20)
      return btn
  }

  private updateButtonLayout(button: Container, width: number, height: number, fontSize: number) {
      ;(button as any)._width = width
      ;(button as any)._height = height
      const text = (button as any)._text as Text
      text.style.fontSize = fontSize
      text.style.wordWrap = true
      text.style.wordWrapWidth = width - 28
      this.drawButtonBackground(button, (button as any)._baseColor, 0.35)
      button.hitArea = new Rectangle(-width / 2, -height / 2, width, height)
  }

  private drawButtonBackground(button: Container, fillColor: number, borderAlpha: number) {
      const bg = (button as any)._bg as Graphics
      const width = (button as any)._width as number
      const height = (button as any)._height as number
      const radius = this.clamp(height * 0.22, 8, 14)
      bg.clear()
      bg.roundRect(-width / 2, -height / 2, width, height, radius)
      bg.fill(fillColor)
      bg.stroke({ width: 2, color: 0xffffff, alpha: borderAlpha })
  }

  private clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value))
  }

  private getSafeAreaInsets() {
      if (typeof document === 'undefined') {
        return { top: 0, right: 0, bottom: 0, left: 0 }
      }

      const style = getComputedStyle(document.documentElement)
      const toNumber = (name: string): number => {
        const value = parseFloat(style.getPropertyValue(name) || '0')
        return Number.isFinite(value) ? value : 0
      }

      return {
        top: toNumber('--sat'),
        right: toNumber('--sar'),
        bottom: toNumber('--sab'),
        left: toNumber('--sal'),
      }
  }

  private shiftColor(color: number, delta: number): number {
      const r = this.clamp(((color >> 16) & 0xff) + delta, 0, 255)
      const g = this.clamp(((color >> 8) & 0xff) + delta, 0, 255)
      const b = this.clamp((color & 0xff) + delta, 0, 255)
      return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
  }

  private async refreshRooms() {
      try {
          const rooms = await NetworkManager.getInstance().getRooms()
          this.cachedRooms = rooms
          this.renderRoomList(this.cachedRooms)
      } catch (e) {
          this.statusText.text = 'Failed to load rooms'
          this.statusText.visible = true
          console.error(e)
      }
  }

  private renderRoomList(rooms: LobbyRoom[]) {
      this.listContainer.removeChildren()

      // Filter out full rooms for display
      const visibleRooms = rooms.filter(r => r.clients < r.maxClients && !r.locked)

      if (visibleRooms.length === 0) {
          this.statusText.text = 'No open rooms available.'
          this.statusText.visible = true
      } else {
          this.statusText.visible = false

          const maxVisible = Math.max(
            1,
            Math.floor((this.listContentHeight + this.listItemGap) / (this.listItemHeight + this.listItemGap))
          )
          const roomsToRender = visibleRooms.slice(0, maxVisible)
          roomsToRender.forEach((room, index) => {
               const roomName = room.metadata?.roomName || `Room ${room.roomId}`
               const btn = this.createButtonElement(`${roomName} (${room.clients}/${room.maxClients})`, 0x1d9bf0, () => {
                   this.handleJoinRoom(room.roomId)
               })
               this.updateButtonLayout(btn, this.listContentWidth, this.listItemHeight, this.listItemFontSize)
               btn.x = this.listContentWidth / 2
               btn.y = this.listItemHeight / 2 + index * (this.listItemHeight + this.listItemGap)
               this.listContainer.addChild(btn)
          })

          if (visibleRooms.length > maxVisible) {
              const overflowText = new Text({
                text: `+${visibleRooms.length - maxVisible} more rooms`,
                style: {
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: this.clamp(this.listItemFontSize * 0.75, 12, 16),
                  fill: '#8ea1d7'
                }
              })
              overflowText.anchor.set(0.5, 0)
              overflowText.position.set(
                this.listContentWidth / 2,
                this.listItemHeight + roomsToRender.length * (this.listItemHeight + this.listItemGap)
              )
              this.listContainer.addChild(overflowText)
          }
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
