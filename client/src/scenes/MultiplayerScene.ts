import { GAME_CONFIG } from '@shared/types'
import { NetworkManager } from '../network/NetworkManager'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { StateAdapter, type UnifiedGameState } from '../utils/StateAdapter'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '../ai'
import { sceneRouter } from '../utils/SceneRouter'
import type { Room } from 'colyseus.js'

/**
 * Multiplayer Game Scene
 * Extends BaseGameScene to provide networked gameplay with server authority
 * Supports AI players as teammates or opponents
 */
export class MultiplayerScene extends BaseGameScene {
  // Multiplayer networking
  private networkManager?: NetworkManager
  protected mySessionId?: string
  private isMultiplayer: boolean = false

  // Room debug text (multiplayer-specific UI)
  private roomDebugText!: Phaser.GameObjects.Text

  // DEBUG: State update tracking
  private stateUpdateCount: number = 0

  // Initialization flags
  private colorInitialized: boolean = false
  private positionInitialized: boolean = false

  // Navigation guard
  private returningToMenu: boolean = false

  // AI support
  private aiEnabled: boolean = true

  constructor() {
    super({ key: 'MultiplayerScene' })
  }

  protected initializeGameState(): void {
    console.log('🎮 [MultiplayerScene] Initializing game state')
    
    if (GameClock.isMockMode()) {
      console.warn('🕐 MultiplayerScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()
    GameClock.resetTimeScale()

    // Reset state before connecting
    // This ensures we start fresh even if scene was restarted
    this.isMultiplayer = false
    this.mySessionId = undefined
    this.colorInitialized = false
    this.positionInitialized = false
    this.stateUpdateCount = 0

    // Connect to multiplayer server
    this.connectToMultiplayer()
  }

  protected getGameState(): any {
    return this.networkManager?.getState() || null
  }

  protected updateGameState(delta: number): void {
    // Early exit if scene is not active or multiplayer is disabled
    if (!this.scene.isActive() || !this.isMultiplayer || !this.networkManager) {
      return
    }

    try {
      const dt = delta / 1000 // Convert to seconds

      // Get input from joystick or keyboard (using base class method)
      const movement = this.collectMovementInput()

      // Apply local prediction for controlled player (own player OR AI teammate)
      const hasMovement =
        Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
        Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT

      if (hasMovement) {
        // Find the sprite for the controlled player (unified approach)
        const controlledSprite = this.players.get(this.controlledPlayerId)

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
        }
      }

      // Collect human input for controlled player
      // Only send if there's actual movement (avoid sending zero input that stops player)
      if (this.controlledPlayerId) {
        const movement = this.collectMovementInput()
        const hasMovement =
          Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
          Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT
        
        // Only send input if there's actual movement
        // This prevents sending (0,0) which would stop the player
        if (hasMovement && this.networkManager.isConnected()) {
          this.networkManager.sendInput(
            movement,
            false,
            undefined,
            this.controlledPlayerId,
            true // Mark as human input (takes priority over AI)
          )
        }
      }

      // Update AI for non-human players if enabled
      if (this.aiEnabled && this.aiManager) {
        this.updateAI()
      }

      // Flush all inputs (human + AI) to server
      if (this.networkManager.isConnected()) {
        this.networkManager.flushInputs()
      }

      // Update from server state (process immediately for lower latency)
      const state = this.networkManager.getState()
      if (state) {
        this.syncFromServerState(state)
      }
    } catch (error) {
      console.error('[MultiplayerScene] Error during updateGameState:', error)
    }
  }

  protected handleShootAction(power: number): void {
    if (this.isMultiplayer && this.networkManager && this.controlledPlayerId) {
      // Send shoot action for the currently controlled player
      // Movement will be preserved from existing buffer (if player is moving)
      this.networkManager.sendInput({ x: 0, y: 0 }, true, power, this.controlledPlayerId, true)
      console.log('📤 Shoot action sent to server, power:', power.toFixed(2), 'player:', this.controlledPlayerId)
    }
  }

  /**
   * Override shutdown to ensure NetworkManager disconnects BEFORE scene cleanup
   * This ensures the server is notified immediately when navigating away
   */
  shutdown() {
    console.log('🔄 [MultiplayerScene] shutdown() called - disconnecting immediately')
    
    // CRITICAL: Disconnect NetworkManager FIRST, before base class shutdown
    // This ensures the server is notified immediately and other clients see the disconnect
    this.cleanupGameState()
    
    // Call base class shutdown for remaining cleanup
    super.shutdown()
  }

  protected cleanupGameState(): void {
    console.log('🧹 [MultiplayerScene] Cleaning up game state - disconnecting immediately')
    
    // CRITICAL: Disconnect NetworkManager FIRST, before stopping multiplayer
    // This ensures the server is notified immediately and other clients see the disconnect
    if (this.networkManager) {
      console.log('🔌 [Cleanup] Disconnecting NetworkManager immediately')
      
      // Stop multiplayer flag first to prevent any more updates
      this.isMultiplayer = false
      
      try {
        // Leave the room synchronously - this notifies the server immediately
        const room = this.networkManager.getRoom() as (Room & { id?: string }) | undefined
        if (room && this.networkManager.isConnected()) {
          console.log('🚪 [Cleanup] Leaving room immediately:', room.id ?? 'unknown')
          // Call leave() directly on room - this triggers server onLeave and notifies other clients
          room.leave() // Synchronous - server is notified immediately
        }
        // Then call disconnect to clean up NetworkManager state
        this.networkManager.disconnect()
      } catch (e) {
        console.error('[MultiplayerScene] Error during NetworkManager disconnect:', e)
      }
      this.networkManager = undefined
    } else {
      // No network manager, but still stop multiplayer flag
      this.isMultiplayer = false
    }

    // Clear all state immediately to prevent any update loops from running
    this.mySessionId = undefined
    this.myPlayerId = 'player1-p1' // Reset to default
    this.controlledPlayerId = 'player1-p1' // Reset to default

    // Reset initialization flags
    this.colorInitialized = false
    this.positionInitialized = false
    this.returningToMenu = false
    
    // Clear AI manager
    if (this.aiManager) {
      // AI Manager doesn't have explicit cleanup, but resetting reference ensures fresh state
      this.aiManager = undefined
    }

    console.log('✅ [MultiplayerScene] Cleanup complete - disconnected and game stopped')
  }

  /**
   * Get unified game state (implements BaseGameScene abstract method)
   * Converts raw Colyseus schema state (flat x/y) to nested structure expected by StateAdapter
   */
  protected getUnifiedState() {
    const rawState = this.networkManager?.getState()
    if (!rawState) return null

    // Convert raw Colyseus schema (flat structure) to nested GameStateData format
    const convertedState: any = {
      matchTime: rawState.matchTime || 0,
      scoreBlue: rawState.scoreBlue || 0,
      scoreRed: rawState.scoreRed || 0,
      phase: rawState.phase || 'waiting',
      players: new Map(),
      ball: {
        position: {
          x: rawState.ball?.x ?? 0,
          y: rawState.ball?.y ?? 0,
        },
        velocity: {
          x: rawState.ball?.velocityX ?? 0,
          y: rawState.ball?.velocityY ?? 0,
        },
        possessedBy: rawState.ball?.possessedBy || '',
      },
    }

    // Convert players from flat to nested structure
    if (rawState.players) {
      rawState.players.forEach((player: any, playerId: string) => {
        convertedState.players.set(playerId, {
          id: player.id || playerId,
          team: player.team || 'blue',
          isHuman: player.isHuman ?? false,
          isControlled: player.isControlled ?? false,
          position: {
            x: player.x ?? 0,
            y: player.y ?? 0,
          },
          velocity: {
            x: player.velocityX ?? 0,
            y: player.velocityY ?? 0,
          },
          state: player.state || 'idle',
          direction: player.direction || 0,
        })
      })
    }

    return StateAdapter.fromNetwork(convertedState)
  }

  // Override create to add room debug text and expose test API
  create() {
    super.create()

    // Reset room debug text if it exists (shouldn't, but be safe)
    if (this.roomDebugText) {
      this.roomDebugText.destroy()
    }

    // Add room debug text (multiplayer-specific UI) at top left corner
    // Position below back button (back button is at 10, 10 with height 40)
    this.roomDebugText = this.add.text(10, 60, 'Room: Connecting...', {
      fontSize: '14px',
      color: '#888888',
    })
    this.roomDebugText.setOrigin(0, 0)
    this.roomDebugText.setScrollFactor(0)
    this.roomDebugText.setDepth(10000) // Very high depth to render on top

    this.uiObjects.push(this.roomDebugText)

    // Ensure UI camera renders this text
    this.cameraManager.getGameCamera().ignore([this.roomDebugText])

    // Set up test API with MultiplayerScene-specific methods
    this.setupTestAPI({
      getState: () => ({
        joystick: this.joystick ? this.joystick.__test_getState() : null,
        button: this.actionButton ? this.actionButton.__test_getState() : null,
      }),
      // Deterministic player movement for tests (bypasses UI simulation)
      // Directly sends input to server at fixed intervals, unaffected by RAF throttling
      movePlayerDirect: async (dx: number, dy: number, durationMs: number): Promise<void> => {
        if (!this.networkManager) {
          throw new Error('NetworkManager not available')
        }

        // Normalize direction vector
        const length = Math.sqrt(dx * dx + dy * dy)
        const normalizedX = length > 0 ? dx / length : 0
        const normalizedY = length > 0 ? dy / length : 0

        console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)}) for ${durationMs}ms game time`)

        const GameClock = (window as any).GameClock
        const startTime = GameClock.now()
        const endTime = startTime + durationMs

        // Send input continuously until game time duration expires
        if (this.controlledPlayerId) {
          while (GameClock.now() < endTime) {
            this.networkManager.sendInput(
              { x: normalizedX, y: normalizedY },
              false,
              undefined,
              this.controlledPlayerId
            )

            // Small delay in real time to avoid overwhelming network
            await new Promise(resolve => setTimeout(resolve, 5))
          }
        }

        console.log(`🎮 [Test] Direct move complete (game time: ${GameClock.now() - startTime}ms)`)
      },
    })
  }

  // ========== MULTIPLAYER NETWORKING METHODS ==========

  private async connectToMultiplayer() {
    // Ensure previous connection is fully cleaned up before connecting again
    if (this.networkManager) {
      console.warn('[MultiplayerScene] Previous NetworkManager exists, cleaning up first')
      this.networkManager.disconnect()
      this.networkManager = undefined
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    try {
      // Runtime server URL configuration (single source of truth)
      const resolveServerUrl = (): string => {
        const pageIsHttps = window.location.protocol === 'https:'
        const normalizeToWs = (url: string): string => {
          if (url.startsWith('http://')) return url.replace('http://', 'ws://')
          if (url.startsWith('https://')) return url.replace('https://', 'wss://')
          if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`
          return url
        }

        // Primary: runtime-injected env (single source of truth)
        const winUrl = (window as any).__SERVER_URL__ as string | undefined
        if (winUrl) return normalizeToWs(winUrl)

        // Secondary: build-time port hint for dev/test (Vite define)
        const portHint = import.meta.env.VITE_SERVER_PORT as string | undefined
        if (portHint) {
          const hostname = window.location.hostname
          return `${pageIsHttps ? 'wss' : 'ws'}://${hostname}:${portHint}`
        }

        // Fallback: current host + port 3000
        const hostname = window.location.hostname
        return `${pageIsHttps ? 'wss' : 'ws'}://${hostname}:3000`
      }

      let serverUrl = resolveServerUrl()

      // Final safeguard: if page is HTTPS, force wss:// to avoid mixed-content blocking
      if (window.location.protocol === 'https:' && serverUrl.startsWith('ws://')) {
        serverUrl = serverUrl.replace('ws://', 'wss://')
      }

      console.log(`[MultiplayerScene] Using server URL: ${serverUrl}`)

      this.networkManager = new NetworkManager({
        serverUrl,
        roomName: 'match',
      })
      await this.networkManager.connect()
      this.mySessionId = this.networkManager.getMySessionId()
      // Set myPlayerId to the first player ID (sessionId-p1)
      // The server creates players with -p1, -p2, -p3 suffixes
      this.myPlayerId = `${this.mySessionId}-p1`
      // Initialize controlledPlayerId to the human player
      // This can change when switching to teammates
      this.controlledPlayerId = `${this.mySessionId}-p1`
      this.isMultiplayer = true
      
      console.log('🎮 [Multiplayer] Human player initialized:', {
        mySessionId: this.mySessionId,
        myPlayerId: this.myPlayerId,
        controlledPlayerId: this.controlledPlayerId
      })

      // Update room debug text
      const room = this.networkManager.getRoom() as (Room & { id?: string; roomId?: string }) | undefined
      const roomId = room?.id ?? room?.roomId ?? 'Unknown'
      if (room && this.roomDebugText) {
        this.roomDebugText.setText(`Room: ${roomId}`)
      }

      console.log('🎮 Multiplayer mode enabled')
      console.log('📡 Session ID:', this.mySessionId)
      console.log('🏠 Room ID:', roomId)

      // Update room debug text
      if (this.roomDebugText) {
        this.roomDebugText.setText(`Room: ${roomId}`)
      }

      this.setupNetworkListeners()
      this.networkManager.checkExistingPlayers()
    } catch (error) {
      console.error('❌ Multiplayer connection failed:', error)
      this.isMultiplayer = false
      
      // Update room debug text to show error
      if (this.roomDebugText) {
        this.roomDebugText.setText('Room: Connection failed')
        this.roomDebugText.setColor('#ff4444')
      }
      
      // Don't throw - allow scene to continue without multiplayer
    }
  }

  private setupNetworkListeners() {
    if (!this.networkManager) return

    try {
      // Player joined event
      this.networkManager.on('playerJoin', (player: any) => {
        try {
          console.log('👤 Remote player joined:', player.id, player.team)
          // Create sprite for all players uniformly
          if (!this.players.has(player.id)) {
            this.createPlayerSprite(player.id, player.x, player.y, player.team)
          }
          // Re-initialize AI when players join to include new players
          this.initializeAI()
        } catch (error) {
          console.error('[MultiplayerScene] Error handling playerJoin:', error)
        }
      })

      // Player left event
      this.networkManager.on('playerLeave', (playerId: string) => {
        try {
          console.log('👋 Remote player left:', playerId)
          this.removeRemotePlayer(playerId)
          // Re-initialize AI when players leave to update player list
          this.initializeAI()
        } catch (error) {
          console.error('[MultiplayerScene] Error handling playerLeave:', error)
        }
      })

      // State change event
      this.networkManager.on('stateChange', (state: any) => {
        try {
          // Create player sprites for all players in the state (if not already created)
          if (state?.players) {
            state.players.forEach((player: any, playerId: string) => {
              if (!this.players.has(playerId)) {
                console.log(`🎭 Creating player sprite from state: ${playerId} (${player.team})`)
                this.createPlayerSprite(playerId, player.x, player.y, player.team)
              }
            })
          }

          // Initialize player color and position on first state update
          if (!this.colorInitialized && state?.players?.has(this.myPlayerId)) {
            console.log(`🎨 [Init] Initializing colors (colorInitialized=${this.colorInitialized})`)
            this.updateLocalPlayerColor()

            if (!this.positionInitialized) {
              this.syncLocalPlayerPosition()
              this.positionInitialized = true
            }

            this.colorInitialized = true
            console.log(`🎨 [Init] Color initialization complete`)
            
            // Initialize control arrow and update borders
            this.initializeControlArrow()
            this.updatePlayerBorders()
          }
          
          // Initialize AI after colors are set (we have valid state now)
          // Also ensure myPlayerId is still set (in case it wasn't set during connection)
          if (!this.myPlayerId && this.mySessionId) {
            console.warn('[MultiplayerScene] myPlayerId not set, initializing from sessionId')
            this.myPlayerId = `${this.mySessionId}-p1`
            this.controlledPlayerId = `${this.mySessionId}-p1`
          }
          
          // Initialize AI whenever we have valid state (can happen multiple times as players join)
          if (this.colorInitialized && state?.players?.size > 0) {
            this.initializeAI()
          }
        } catch (error) {
          console.error('[MultiplayerScene] Error handling stateChange:', error)
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
          console.error('[MultiplayerScene] Error handling goalScored:', error)
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
          console.error('[MultiplayerScene] Error handling matchEnd:', error)
        }
      })

      // Room closed event (when opponent leaves in 2-player game)
      this.networkManager.on('roomClosed', (reason: string) => {
        try {
          // Prevent duplicate navigation
          if (this.returningToMenu) {
            console.log('[MultiplayerScene] Already returning to menu, ignoring duplicate roomClosed')
            return
          }

          console.log('🚪 Room closed:', reason)
          if (reason === 'opponent_left') {
            // Opponent left - return to menu
            console.log('👋 Opponent left the game, returning to menu')
            this.returnToMenu('Opponent left the game')
          } else {
            // Other reason (disconnected, etc.)
            console.log('🔌 Room disconnected, returning to menu')
            this.returnToMenu('Connection lost')
          }
        } catch (error) {
          console.error('[MultiplayerScene] Error handling roomClosed:', error)
        }
      })

      console.log('✅ Network listeners set up successfully')
    } catch (error) {
      console.error('[MultiplayerScene] Error setting up network listeners:', error)
    }
  }

  /**
   * Return to menu when room is closed
   */
  private returnToMenu(message: string): void {
    // Prevent duplicate navigation
    if (this.returningToMenu) {
      console.log('[MultiplayerScene] Already returning to menu, ignoring duplicate call')
      return
    }

    this.returningToMenu = true
    console.log(`🔙 Returning to menu: ${message}`)
    
    // Show a brief message to the user
    const width = this.scale.width
    const height = this.scale.height

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c12, 0.85)
    overlay.setDepth(2000)
    overlay.setScrollFactor(0)

    const messageText = this.add.text(width / 2, height / 2 - 30, message, {
      fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: '24px',
      color: '#f4f7fb',
      fontStyle: 'bold',
      align: 'center',
    })
    messageText.setOrigin(0.5)
    messageText.setDepth(2001)
    messageText.setScrollFactor(0)
    messageText.setResolution(2)

    const returnText = this.add.text(width / 2, height / 2 + 30, 'Returning to menu...', {
      fontFamily: 'JetBrains Mono, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: '18px',
      color: '#a6adbb',
      align: 'center',
    })
    returnText.setOrigin(0.5)
    returnText.setDepth(2001)
    returnText.setScrollFactor(0)
    returnText.setResolution(2)

    this.cameraManager.getGameCamera().ignore([overlay, messageText, returnText])

    console.log('🛡️ Disconnect overlay shown - blocking gameplay input')

    // Allow tap/click anywhere to return immediately (use pointerup to avoid leaking press into next scene)
    const navigateToMenu = (() => {
      let triggered = false
      return () => {
        if (triggered) return
        triggered = true
        console.log('🔙 Disconnect overlay navigating to menu')
        if (typeof window !== 'undefined' && (window as any).__testRoomId) {
          console.log('🧪 Clearing __testRoomId to prevent auto-rejoin on menu')
          ;(window as any).__testRoomId = null
        }
        // Disable further input in this scene so the current pointer doesn't bubble into MenuScene
        this.input.enabled = false
        this.input.manager.enabled = false
        // Defer navigation to the next tick so the current pointer event is fully consumed
        this.time.delayedCall(20, () => sceneRouter.navigateTo('MenuScene'))
      }
    })()

    // Block underlying input while overlay is up
    overlay.setInteractive({ useHandCursor: true, pixelPerfect: false })
    messageText.setInteractive({ useHandCursor: true })
    returnText
      .setInteractive({ useHandCursor: true })
      .setText('Tap anywhere to return to menu')

    // Consume pointer events so they don't reach scenes beneath
    const stop = (pointer: Phaser.Input.Pointer) => {
      console.log('🖱️ Disconnect overlay click captured')
      pointer.event?.stopImmediatePropagation()
      pointer.event?.stopPropagation?.()
      pointer.event?.preventDefault?.()
    }

    overlay.once('pointerdown', stop)
    messageText.once('pointerdown', stop)
    returnText.once('pointerdown', stop)

    // Navigate on pointerup to avoid forwarding the press to the next scene
    overlay.once('pointerup', navigateToMenu)
    messageText.once('pointerup', navigateToMenu)
    returnText.once('pointerup', navigateToMenu)

    // Navigate to menu after a brief delay (or immediately on user click)
    this.time.delayedCall(5000, navigateToMenu)
  }

  private removeRemotePlayer(sessionId: string) {
    const sprite = this.players.get(sessionId)
    if (sprite) {
      sprite.destroy()
      this.players.delete(sessionId)
    }
    console.log('🗑️ Remote player removed:', sessionId)
  }

  private syncFromServerState(state: any) {
    if (!state || !state.players || typeof state.players.forEach !== 'function' || !state.ball) {
      return
    }

    // DEBUG: Log state updates periodically
    if (!this.stateUpdateCount) this.stateUpdateCount = 0
    this.stateUpdateCount++

    // Update ball position with interpolation
    if (state.ball) {
      // Initialize ball position if not set or invalid (fixes null/NaN position issue)
      if (this.ball.x == null || this.ball.y == null || isNaN(this.ball.x) || isNaN(this.ball.y)) {
        this.ball.x = state.ball.x
        this.ball.y = state.ball.y
      } else {
        const lerpFactor = VISUAL_CONSTANTS.BALL_LERP_FACTOR
        this.ball.x += (state.ball.x - this.ball.x) * lerpFactor
        this.ball.y += (state.ball.y - this.ball.y) * lerpFactor
      }
      // Update shadow to follow ball
      this.ballShadow.x = this.ball.x + 2
      this.ballShadow.y = this.ball.y + 3
    }

    // Update all players from server state
    state.players.forEach((player: any, playerId: string) => {
      if (playerId === this.myPlayerId) {
        // Server reconciliation for local player (my controlled player)
        this.reconcileLocalPlayer(player)
      } else {
        // Update or create remote player
        this.updateRemotePlayer(playerId, player)
      }
    })

    // Update UI (score and timer)
    this.scoreText.setText(`${state.scoreBlue} - ${state.scoreRed}`)

    const minutes = Math.floor(state.matchTime / 60)
    const seconds = Math.floor(state.matchTime % 60)
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

    if (state.matchTime <= 30 && state.matchTime > 0) {
      this.timerText.setColor('#ff4444')
    } else {
      this.timerText.setColor('#ffffff')
    }
  }

  private reconcileLocalPlayer(playerState: any) {
    const myPlayerSprite = this.players.get(this.myPlayerId)
    if (!myPlayerSprite) return

    const serverX = playerState.x
    const serverY = playerState.y
    const deltaX = Math.abs(myPlayerSprite.x - serverX)
    const deltaY = Math.abs(myPlayerSprite.y - serverY)

    // Adaptive reconciliation factor based on error magnitude
    // Higher factors = faster correction = lower perceived lag
    let reconcileFactor: number = VISUAL_CONSTANTS.BASE_RECONCILE_FACTOR

    if (deltaX > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD || deltaY > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD) {
      reconcileFactor = VISUAL_CONSTANTS.STRONG_RECONCILE_FACTOR
    } else if (
      deltaX > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD ||
      deltaY > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD
    ) {
      reconcileFactor = VISUAL_CONSTANTS.MODERATE_RECONCILE_FACTOR
    }

    // Blend toward server position (faster correction for better responsiveness)
    myPlayerSprite.x += (serverX - myPlayerSprite.x) * reconcileFactor
    myPlayerSprite.y += (serverY - myPlayerSprite.y) * reconcileFactor
  }

  private updateRemotePlayer(sessionId: string, playerState: any) {
    let sprite = this.players.get(sessionId)

    // Create sprite if it doesn't exist (lazy creation for AI bots)
    if (!sprite) {
      console.log('🎭 Creating player (lazy):', sessionId, playerState.team)
      this.createPlayerSprite(sessionId, playerState.x, playerState.y, playerState.team)
      sprite = this.players.get(sessionId)
      if (!sprite) return
    }

    // Interpolate toward server position (higher factor = faster sync = lower latency)
    const lerpFactor = VISUAL_CONSTANTS.REMOTE_PLAYER_LERP_FACTOR
    sprite.x += (playerState.x - sprite.x) * lerpFactor
    sprite.y += (playerState.y - sprite.y) * lerpFactor

    // Update team color (in case player switched teams or color wasn't set correctly)
    const teamColor =
      playerState.team === 'blue' ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR : VISUAL_CONSTANTS.PLAYER_RED_COLOR
    sprite.setFillStyle(teamColor)
    sprite.isFilled = true
  }

  private updateLocalPlayerColor() {
    if (!this.isMultiplayer || !this.networkManager || !this.myPlayerId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      // Use myPlayerId (sessionId-p1) instead of mySessionId
      const localPlayer = state.players.get(this.myPlayerId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state:', this.myPlayerId)
        return
      }

      const teamColor =
        localPlayer.team === 'blue' ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR : VISUAL_CONSTANTS.PLAYER_RED_COLOR

      this.playerTeamColor = teamColor
      
      // Update sprite color
      const myPlayerSprite = this.players.get(this.myPlayerId)
      if (myPlayerSprite) {
        myPlayerSprite.setFillStyle(this.playerTeamColor)
      }

      if (this.joystick) {
        this.joystick.setTeamColor(this.playerTeamColor)
      }

      if (this.actionButton) {
        this.actionButton.setTeamColor(this.playerTeamColor)
      }

      console.log(`🎨 [Client] UI colors synchronized to ${localPlayer.team} (${this.playerTeamColor.toString(16)})`)
    } catch (error) {
      console.error('[MultiplayerScene] Error updating local player color:', error)
    }
  }

  private syncLocalPlayerPosition() {
    if (!this.isMultiplayer || !this.networkManager || !this.myPlayerId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      const localPlayer = state.players.get(this.myPlayerId)
      if (!localPlayer) {
        console.warn('⚠️ Local player not found in server state for position sync')
        return
      }

      const myPlayerSprite = this.players.get(this.myPlayerId)
      if (myPlayerSprite) {
        myPlayerSprite.setPosition(localPlayer.x, localPlayer.y)
      }
    } catch (error) {
      console.error('[MultiplayerScene] Error syncing local player position:', error)
    }
  }

  /**
   * Initialize AI system for multiplayer
   * Each client only controls their own team:
   * - Blue client: controls blue team (1 human + 2 AI teammates)
   * - Red client: controls red team (1 human + 2 AI teammates)
   * Each client's AI only controls teammates on THEIR team, not opponents
   * Re-initializes when players join/leave to update the player list
   */
  private initializeAI() {
    if (!this.networkManager || !this.isMultiplayer) return

    const state = this.networkManager.getState()
    if (!state || !state.players || state.players.size === 0) return

    // Verify myPlayerId is set
    if (!this.myPlayerId) {
      console.warn('[MultiplayerScene] Cannot initialize AI: myPlayerId not set')
      return
    }

    // Find which team the local player is on (use myPlayerId which is sessionId-p1)
    const localPlayer = state.players.get(this.myPlayerId)
    if (!localPlayer) {
      console.warn('[MultiplayerScene] Cannot initialize AI: local player not found in state', this.myPlayerId)
      return
    }

    const myTeam: 'blue' | 'red' = localPlayer.team
    
    // Collect ONLY players from OUR team (teammates)
    // Opponent team is controlled by the other client, not us
    const myTeamPlayerIds: string[] = []
    const opponentTeamPlayerIds: string[] = [] // Empty - we don't control opponents

    state.players.forEach((player: any, playerId: string) => {
      if (player.team === myTeam) {
        myTeamPlayerIds.push(playerId)
      }
      // Opponent team players are NOT added - they're controlled by the other client
    })

    // Initialize or re-initialize AI manager
    // Only initialize AI for OUR team (opponent team is empty array)
    // AI will control teammates, but applyAIDecision will skip:
    // 1. The currently controlled player (when switched to teammate)
    // 2. Human player (from network state isHuman flag)
    if (!this.aiManager) {
      this.aiManager = new AIManager()
    }
    
    // Pass our team players to the appropriate parameter
    // Opponent team is always empty - we don't control them
    if (myTeam === 'blue') {
      this.aiManager.initialize(
        myTeamPlayerIds,  // Blue team (our team)
        opponentTeamPlayerIds, // Red team (empty - opponent controls it)
        (playerId, decision) => this.applyAIDecision(playerId, decision)
      )
    } else {
      this.aiManager.initialize(
        opponentTeamPlayerIds, // Blue team (empty - opponent controls it)
        myTeamPlayerIds,  // Red team (our team)
        (playerId, decision) => this.applyAIDecision(playerId, decision)
      )
    }

    // Count teammates for logging
    let humanTeammates = 0
    let aiTeammates = 0
    myTeamPlayerIds.forEach((playerId) => {
      const player = state.players.get(playerId)
      if (player) {
        if (player.isHuman) humanTeammates++
        else aiTeammates++
      }
    })

    console.log(`🤖 AI initialized for ${myTeam} team (our team)`)
    console.log(`   Our team: ${myTeamPlayerIds.length} players (${humanTeammates} human, ${aiTeammates} AI teammates)`)
    console.log(`   Team player IDs: ${myTeamPlayerIds.join(', ')}`)
    console.log(`   Local player: ${this.myPlayerId} (currently controlled: ${this.controlledPlayerId ?? 'unknown'})`)
    console.log(`   Opponent team: controlled by other client (not initialized here)`)
  }

  /**
   * Update AI system (called from updateGameState)
   * Uses network state via getUnifiedState()
   */
  private updateAI(): void {
    if (!this.aiManager || !this.aiEnabled) {
      if (!this.aiManager) console.warn('[MultiplayerScene] AI Manager not initialized')
      if (!this.aiEnabled) console.warn('[MultiplayerScene] AI is disabled')
      return
    }

    if (this.returningToMenu) {
      // Prevent AI work once we're already navigating out
      return
    }

    const unifiedState = this.getUnifiedState()
    if (!unifiedState) {
      console.warn('[MultiplayerScene] Cannot update AI: no unified state')
      return
    }

    // Convert unified state to GameStateData format for AI
    // This includes ALL players (both teams) so AI can see full game state
    const gameStateData = this.convertUnifiedStateToGameStateData(unifiedState)

    // Debug: Log state info and AI decisions more frequently
    if (Math.random() < 0.1) { // 10% of the time
      const playerCount = gameStateData.players.size
      const blueCount = Array.from(gameStateData.players.values()).filter((p: any) => p.team === 'blue').length
      const redCount = Array.from(gameStateData.players.values()).filter((p: any) => p.team === 'red').length
      const myTeam = StateAdapter.getPlayerTeam(unifiedState, this.myPlayerId)
      const myTeamPlayers = Array.from(gameStateData.players.values()).filter((p: any) => p.team === myTeam)
      const aiControlledIds = myTeamPlayers
        .filter((p: any) => this.shouldAllowAIControl(p.id))
        .map((p: any) => p.id)
      console.log(`[MultiplayerScene] AI update: ${playerCount} players (${blueCount} blue, ${redCount} red)`)
      console.log(`  Our team (${myTeam}): ${myTeamPlayers.length} players, controlled: ${this.controlledPlayerId}, should AI control: ${aiControlledIds.join(', ')}`)
    }

    // Update AI Manager
    try {
      this.aiManager.update(gameStateData)
    } catch (error) {
      console.error('[MultiplayerScene] Error during AI update:', error)
    }
  }
  
  /**
   * Convert UnifiedGameState to GameStateData format for AI
   */
  private convertUnifiedStateToGameStateData(unifiedState: UnifiedGameState): any {
    const playersMap = new Map()
    unifiedState.players.forEach((player: any, playerId: string) => {
      playersMap.set(playerId, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        position: { x: player.x, y: player.y },
        velocity: { x: player.velocityX, y: player.velocityY },
        state: player.state,
        direction: player.direction,
      })
    })

    return {
      players: playersMap,
      ball: {
        position: { x: unifiedState.ball.x, y: unifiedState.ball.y },
        velocity: { x: unifiedState.ball.velocityX, y: unifiedState.ball.velocityY },
        possessedBy: unifiedState.ball.possessedBy,
      },
      scoreBlue: unifiedState.scoreBlue,
      scoreRed: unifiedState.scoreRed,
      matchTime: unifiedState.matchTime,
      phase: unifiedState.phase,
    }
  }

  /**
   * Override onPlayerSwitched to handle multiplayer player switching
   * When switching to a teammate, we need to tell the server which player is now controlled
   */
  protected onPlayerSwitched(playerId: string): void {
    // Base class handles GameEngine (not needed here for multiplayer)
    // For multiplayer, the server will handle player control when we send input with playerId
    // We've already updated controlledPlayerId in switchToPlayer, so subsequent inputs will use the new player
    console.log(`🔄 [Multiplayer] Player switched to: ${playerId}`)
  }

  /**
   * Override applyAIDecision to send AI decisions to server via NetworkManager
   * Simplified: AI controls all teammates except the currently controlled player
   */
  protected applyAIDecision(playerId: string, decision: any): void {
    if (!this.networkManager || !this.isMultiplayer) {
      return
    }

    // Respect shared AI control rules (skip currently controlled player)
    if (!this.shouldAllowAIControl(playerId)) {
      return
    }

    // Only control players from our own team
    const unifiedState = this.getUnifiedState()
    if (!unifiedState) {
      return
    }
    
    const myTeam = StateAdapter.getPlayerTeam(unifiedState, this.myPlayerId)
    const playerTeam = StateAdapter.getPlayerTeam(unifiedState, playerId)
    
    // Only control players from our team
    if (!myTeam || !playerTeam || playerTeam !== myTeam) {
      return
    }

    // If this player currently possesses the ball, immediately hand control to human
    const ballPossessor = unifiedState.ball.possessedBy
    if (ballPossessor === playerId) {
      if (playerId !== this.controlledPlayerId) {
        this.switchToPlayer(playerId)
        console.log(`⚽ [AI->Human] Auto control transfer to ball possessor ${playerId}`)
      }
      return // Prevent AI from acting while we take control
    }

    // Add AI decision to input buffer (will be sent with human input)
    // Mark as AI input (lower priority than human input)
    this.networkManager.sendInput(
      { x: decision.moveX, y: decision.moveY },
      decision.shootPower !== null,
      decision.shootPower ?? undefined,
      playerId,
      false // Mark as AI input (won't overwrite human input)
    )
  }

  protected shouldAllowAIControl(playerId: string): boolean {
    if (!this.isMultiplayer || !this.networkManager) {
      return super.shouldAllowAIControl(playerId)
    }

    // Never allow AI to control the currently selected player
    if (playerId === this.controlledPlayerId) {
      return false
    }

    // Allow AI to control our original session player when we're controlling a teammate
    if (playerId === this.mySessionId) {
      // If we're not actively controlling this player, AI may control them
      return true
    }

    return super.shouldAllowAIControl(playerId)
  }

}
