import { GAME_CONFIG } from '@shared/types'
import { NetworkManager } from '../network/NetworkManager'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'

/**
 * Multiplayer Game Scene
 * Extends BaseGameScene to provide networked gameplay with server authority
 */
export class GameScene extends BaseGameScene {
  // Multiplayer networking
  private networkManager?: NetworkManager
  private mySessionId?: string
  private isMultiplayer: boolean = false

  // Room debug text (multiplayer-specific UI)
  private roomDebugText!: Phaser.GameObjects.Text

  // DEBUG: State update tracking
  private stateUpdateCount: number = 0

  // Initialization flags
  private colorInitialized: boolean = false
  private positionInitialized: boolean = false

  constructor() {
    super({ key: 'GameScene' })
  }

  protected initializeGameState(): void {
    // Connect to multiplayer server
    this.connectToMultiplayer()
  }

  protected getGameState(): any {
    return this.networkManager?.getState() || null
  }

  protected updateGameState(delta: number): void {
    const dt = delta / 1000 // Convert to seconds

    // Get input from joystick or keyboard
    const movement = { x: 0, y: 0 }

    if (this.joystick && this.joystick.isPressed()) {
      const joystickInput = this.joystick.getInput()
      movement.x = joystickInput.x
      movement.y = joystickInput.y
    } else if (this.cursors) {
      if (this.cursors.left.isDown) movement.x = -1
      else if (this.cursors.right.isDown) movement.x = 1

      if (this.cursors.up.isDown) movement.y = -1
      else if (this.cursors.down.isDown) movement.y = 1

      const length = Math.sqrt(movement.x * movement.x + movement.y * movement.y)
      if (length > 0) {
        movement.x /= length
        movement.y /= length
      }
    }

    // Send input to server if there's movement
    if (this.isMultiplayer && this.networkManager) {
      const hasMovement =
        Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
        Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT

      if (hasMovement) {
        this.networkManager.sendInput(movement, false, undefined, this.controlledPlayerId)
      }
    }

    // Apply local prediction for controlled player (own player OR AI teammate)
    const hasMovement =
      Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
      Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT

    if (hasMovement) {
      // Find the sprite for the controlled player
      let controlledSprite: Phaser.GameObjects.Arc | undefined
      let spriteTeamColor: number

      if (this.controlledPlayerId === this.mySessionId) {
        controlledSprite = this.player
        spriteTeamColor = this.playerTeamColor
      } else {
        controlledSprite = this.remotePlayers.get(this.controlledPlayerId)
        // Get team color from server state
        const state = this.networkManager?.getState()
        const controlledPlayer = state?.players.get(this.controlledPlayerId)
        spriteTeamColor =
          controlledPlayer?.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
      }

      if (controlledSprite) {
        // Apply local prediction
        controlledSprite.x += movement.x * GAME_CONFIG.PLAYER_SPEED * dt
        controlledSprite.y += movement.y * GAME_CONFIG.PLAYER_SPEED * dt

        controlledSprite.x = Phaser.Math.Clamp(
          controlledSprite.x,
          GAME_CONFIG.PLAYER_MARGIN,
          GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_MARGIN
        )
        controlledSprite.y = Phaser.Math.Clamp(
          controlledSprite.y,
          GAME_CONFIG.PLAYER_MARGIN,
          GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_MARGIN
        )

        // Visual feedback: tint when moving
        const movingColor =
          spriteTeamColor === VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            ? VISUAL_CONSTANTS.PLAYER_BLUE_MOVING
            : VISUAL_CONSTANTS.PLAYER_RED_MOVING
        controlledSprite.setFillStyle(movingColor)
      }
    } else {
      // Reset color when not moving
      if (this.controlledPlayerId === this.mySessionId) {
        this.player.setFillStyle(this.playerTeamColor)
      } else {
        const controlledSprite = this.remotePlayers.get(this.controlledPlayerId)
        const state = this.networkManager?.getState()
        const controlledPlayer = state?.players.get(this.controlledPlayerId)
        const spriteTeamColor =
          controlledPlayer?.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
        if (controlledSprite) {
          controlledSprite.setFillStyle(spriteTeamColor)
        }
      }
    }

    // Update from server state
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState()
      if (state) {
        this.syncFromServerState(state)
      }
    }
  }

  protected handleShootAction(power: number): void {
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendInput({ x: 0, y: 0 }, true, power, this.controlledPlayerId)
      console.log('📤 Shoot action sent to server, power:', power.toFixed(2), 'player:', this.controlledPlayerId)
    }
  }

  protected cleanupGameState(): void {
    // Disconnect NetworkManager
    if (this.networkManager) {
      console.log('🔌 [Shutdown] Disconnecting NetworkManager')
      this.networkManager.disconnect()
      this.networkManager = undefined
    }

    // Reset initialization flags
    this.colorInitialized = false
    this.positionInitialized = false
  }

  // Override create to add room debug text and expose test API
  create() {
    super.create()

    // Add room debug text (multiplayer-specific UI)
    this.roomDebugText = this.add.text(10, 10, 'Room: Not connected', {
      fontSize: '14px',
      color: '#888888',
    })
    this.roomDebugText.setOrigin(0, 0)
    this.roomDebugText.setScrollFactor(0)
    this.uiObjects.push(this.roomDebugText)

    // Expose controls for testing (development only)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      ;(window as any).__gameControls = {
        joystick: this.joystick,
        button: this.actionButton,
        scene: this,
        test: {
          touchJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateTouch(x, y)
          },
          dragJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateDrag(x, y)
          },
          releaseJoystick: () => {
            this.joystick.__test_simulateRelease()
          },
          pressButton: () => {
            this.actionButton.__test_simulatePress()
          },
          releaseButton: (holdMs: number = 500) => {
            this.actionButton.__test_simulateRelease(holdMs)
          },
          getState: () => ({
            joystick: this.joystick.__test_getState(),
            button: this.actionButton.__test_getState(),
          }),
        },
      }

      console.log('🧪 Testing API exposed: window.__gameControls')
    }
  }

  // ========== MULTIPLAYER NETWORKING METHODS ==========

  private async connectToMultiplayer() {
    try {
      const hostname = window.location.hostname
      const serverUrl = `ws://${hostname}:3000`

      this.networkManager = new NetworkManager({
        serverUrl,
        roomName: 'match',
      })
      await this.networkManager.connect()
      this.mySessionId = this.networkManager.getMySessionId()
      this.myPlayerId = this.mySessionId // Set myPlayerId to match session ID
      this.controlledPlayerId = this.mySessionId
      this.isMultiplayer = true

      // Update room debug text
      const room = this.networkManager.getRoom()
      if (room) {
        this.roomDebugText.setText(`Room: ${room.id}`)
      }

      console.log('🎮 Multiplayer mode enabled')
      console.log('📡 Session ID:', this.mySessionId)
      console.log('🏠 Room ID:', room?.id)

      this.setupNetworkListeners()
      this.networkManager.checkExistingPlayers()
    } catch (error) {
      console.warn('⚠️ Multiplayer unavailable, running single-player', error)
      this.isMultiplayer = false
    }
  }

  private setupNetworkListeners() {
    if (!this.networkManager) return

    try {
      // Player joined event
      this.networkManager.on('playerJoin', (player: any) => {
        try {
          console.log('👤 Remote player joined:', player.id, player.team)
          if (player.id !== this.mySessionId) {
            this.createRemotePlayer(player.id, player)
          }
        } catch (error) {
          console.error('[GameScene] Error handling playerJoin:', error)
        }
      })

      // Player left event
      this.networkManager.on('playerLeave', (playerId: string) => {
        try {
          console.log('👋 Remote player left:', playerId)
          this.removeRemotePlayer(playerId)
        } catch (error) {
          console.error('[GameScene] Error handling playerLeave:', error)
        }
      })

      // State change event
      this.networkManager.on('stateChange', (state: any) => {
        try {
          // Initialize player color and position on first state update
          if (!this.colorInitialized && state?.players?.has(this.mySessionId)) {
            console.log(`🎨 [Init] Initializing colors (colorInitialized=${this.colorInitialized})`)
            this.updateLocalPlayerColor()

            if (!this.positionInitialized) {
              this.syncLocalPlayerPosition()
              this.positionInitialized = true
            }

            this.colorInitialized = true
            console.log(`🎨 [Init] Color initialization complete`)
          }
        } catch (error) {
          console.error('[GameScene] Error handling stateChange:', error)
        }
      })

      // Goal scored event
      this.networkManager.on('goalScored', (data: any) => {
        try {
          console.log('⚽ Goal scored by', data.team)
          if (!this.goalScored) {
            this.onGoalScored(data.team)
          }
        } catch (error) {
          console.error('[GameScene] Error handling goalScored:', error)
        }
      })

      // Match end event
      this.networkManager.on('matchEnd', (data: any) => {
        try {
          console.log('🏁 Match ended, winner:', data.winner)
          if (!this.matchEnded) {
            this.onMatchEnd()
          }
        } catch (error) {
          console.error('[GameScene] Error handling matchEnd:', error)
        }
      })

      console.log('✅ Network listeners set up successfully')
    } catch (error) {
      console.error('[GameScene] Error setting up network listeners:', error)
    }
  }

  private removeRemotePlayer(sessionId: string) {
    const sprite = this.remotePlayers.get(sessionId)
    if (sprite) {
      sprite.destroy()
      this.remotePlayers.delete(sessionId)
    }
    console.log('🗑️ Remote player removed:', sessionId)
  }

  private syncFromServerState(state: any) {
    if (!state) return

    // DEBUG: Log state updates periodically
    if (!this.stateUpdateCount) this.stateUpdateCount = 0
    this.stateUpdateCount++

    // Update ball position with interpolation
    if (state.ball) {
      const lerpFactor = VISUAL_CONSTANTS.BALL_LERP_FACTOR
      this.ball.x += (state.ball.x - this.ball.x) * lerpFactor
      this.ball.y += (state.ball.y - this.ball.y) * lerpFactor
      // Update shadow to follow ball
      this.ballShadow.x = this.ball.x + 2
      this.ballShadow.y = this.ball.y + 3
    }

    // Update all players from server state
    state.players.forEach((player: any, sessionId: string) => {
      if (sessionId === this.mySessionId) {
        // Server reconciliation for local player
        this.reconcileLocalPlayer(player)
      } else {
        // Update or create remote player
        this.updateRemotePlayer(sessionId, player)
      }
    })
  }

  private reconcileLocalPlayer(playerState: any) {
    const serverX = playerState.x
    const serverY = playerState.y
    const deltaX = Math.abs(this.player.x - serverX)
    const deltaY = Math.abs(this.player.y - serverY)

    // Adaptive reconciliation factor based on error magnitude
    let reconcileFactor = VISUAL_CONSTANTS.BASE_RECONCILE_FACTOR

    if (deltaX > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD || deltaY > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD) {
      reconcileFactor = VISUAL_CONSTANTS.STRONG_RECONCILE_FACTOR
    } else if (
      deltaX > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD ||
      deltaY > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD
    ) {
      reconcileFactor = VISUAL_CONSTANTS.MODERATE_RECONCILE_FACTOR
    }

    // Blend toward server position
    this.player.x += (serverX - this.player.x) * reconcileFactor
    this.player.y += (serverY - this.player.y) * reconcileFactor
  }

  private updateRemotePlayer(sessionId: string, playerState: any) {
    let sprite = this.remotePlayers.get(sessionId)

    // Create sprite if it doesn't exist (lazy creation for AI bots)
    if (!sprite) {
      console.log('🎭 Creating remote player (lazy):', sessionId, playerState.team)
      this.createRemotePlayer(sessionId, playerState)
      sprite = this.remotePlayers.get(sessionId)
      if (!sprite) return
    }

    // Interpolate toward server position
    const lerpFactor = VISUAL_CONSTANTS.REMOTE_PLAYER_LERP_FACTOR
    sprite.x += (playerState.x - sprite.x) * lerpFactor
    sprite.y += (playerState.y - sprite.y) * lerpFactor
  }

  private updateLocalPlayerColor() {
    if (!this.isMultiplayer || !this.networkManager || !this.mySessionId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      const localPlayer = state.players.get(this.mySessionId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state')
        return
      }

      const teamColor =
        localPlayer.team === 'blue' ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR : VISUAL_CONSTANTS.PLAYER_RED_COLOR

      this.playerTeamColor = teamColor
      this.player.setFillStyle(this.playerTeamColor)

      if (this.joystick) {
        this.joystick.setTeamColor(this.playerTeamColor)
      }

      if (this.actionButton) {
        this.actionButton.setTeamColor(this.playerTeamColor)
      }

      console.log(`🎨 [Client] UI colors synchronized to ${localPlayer.team} (${this.playerTeamColor.toString(16)})`)
    } catch (error) {
      console.error('[GameScene] Error updating local player color:', error)
    }
  }

  private syncLocalPlayerPosition() {
    if (!this.isMultiplayer || !this.networkManager || !this.mySessionId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      const localPlayer = state.players.get(this.mySessionId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state for position sync')
        return
      }

      this.player.setPosition(localPlayer.x, localPlayer.y)
    } catch (error) {
      console.error('[GameScene] Error syncing local player position:', error)
    }
  }
}
