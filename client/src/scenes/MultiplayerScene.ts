import { Application, Text } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { NetworkManager } from '../network/NetworkManager'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { StateAdapter, type UnifiedGameState } from '../utils/StateAdapter'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '../ai'
import { sceneRouter } from '../utils/SceneRouter'
import type { Room } from 'colyseus.js'
import { PixiSceneManager } from '../utils/PixiSceneManager'

/**
 * Multiplayer Game Scene (PixiJS)
 * Extends BaseGameScene to provide networked gameplay with server authority
 */
export class MultiplayerScene extends BaseGameScene {
  private networkManager?: NetworkManager
  protected mySessionId?: string
  private isMultiplayer: boolean = false
  private roomDebugText!: Text
  private stateUpdateCount: number = 0
  private colorInitialized: boolean = false
  private positionInitialized: boolean = false
  private returningToMenu: boolean = false
  private aiEnabled: boolean = true

  constructor(app: Application, key: string, manager: PixiSceneManager) {
    super(app, key, manager)
  }

  protected initializeGameState(): void {
    console.log('🎮 [MultiplayerScene] Initializing game state')
    
    if (GameClock.isMockMode()) {
      console.warn('🕐 MultiplayerScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()
    GameClock.resetTimeScale()

    this.isMultiplayer = false
    this.mySessionId = undefined
    this.colorInitialized = false
    this.positionInitialized = false
    this.stateUpdateCount = 0

    this.connectToMultiplayer()
  }

  protected getGameState(): any {
    return this.networkManager?.getState() || null
  }

  protected updateGameState(delta: number): void {
    if (!this.container.visible || !this.isMultiplayer || !this.networkManager) {
      return
    }

    // Check if scene is active via manager? PixiScene doesn't have isActive().
    // We check if it is current scene or similar.
    // If updateGameState is called, it means update() is called, which means scene is likely active.

    try {
      const dt = delta / 1000 // Convert to seconds assuming delta is MS.
      // Wait, we need to clarify what delta BaseGameScene passes.
      // If BaseGameScene passes app.ticker.deltaMS, then / 1000 is correct.

      const movement = this.collectMovementInput()

      const hasMovement =
        Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
        Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT

      if (hasMovement) {
        const controlledSprite = this.players.get(this.controlledPlayerId)

        if (controlledSprite) {
          controlledSprite.x += movement.x * GAME_CONFIG.PLAYER_SPEED * dt
          controlledSprite.y += movement.y * GAME_CONFIG.PLAYER_SPEED * dt

          controlledSprite.x = Math.max(
            GAME_CONFIG.PLAYER_MARGIN,
            Math.min(controlledSprite.x, GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_MARGIN)
          )
          controlledSprite.y = Math.max(
            GAME_CONFIG.PLAYER_MARGIN,
            Math.min(controlledSprite.y, GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_MARGIN)
          )
        }
      }

      if (this.controlledPlayerId) {
        const movement = this.collectMovementInput()
        const hasMovement =
          Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
          Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT
        
        if (hasMovement && this.networkManager.isConnected()) {
          this.networkManager.sendInput(
            movement,
            false,
            undefined,
            this.controlledPlayerId,
            true
          )
        }
      }

      if (this.aiEnabled && this.aiManager) {
        this.updateAI()
      }

      if (this.networkManager.isConnected()) {
        this.networkManager.flushInputs()
      }

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
      this.networkManager.sendInput({ x: 0, y: 0 }, true, power, this.controlledPlayerId, true)
      console.log('📤 Shoot action sent to server, power:', power.toFixed(2), 'player:', this.controlledPlayerId)
    }
  }

  destroy() {
    console.log('🔄 [MultiplayerScene] shutdown() called - disconnecting immediately')
    this.cleanupGameState()
    super.destroy()
  }

  protected cleanupGameState(): void {
    console.log('🧹 [MultiplayerScene] Cleaning up game state - disconnecting immediately')
    
    if (this.networkManager) {
      console.log('🔌 [Cleanup] Disconnecting NetworkManager immediately')
      
      this.isMultiplayer = false
      
      try {
        const room = this.networkManager.getRoom() as (Room & { id?: string }) | undefined
        if (room && this.networkManager.isConnected()) {
          console.log('🚪 [Cleanup] Leaving room immediately:', room.id ?? 'unknown')
          room.leave()
        }
        this.networkManager.disconnect()
      } catch (e) {
        console.error('[MultiplayerScene] Error during NetworkManager disconnect:', e)
      }
      this.networkManager = undefined
    } else {
      this.isMultiplayer = false
    }

    this.mySessionId = undefined
    this.myPlayerId = 'player1-p1'
    this.controlledPlayerId = 'player1-p1'

    this.colorInitialized = false
    this.positionInitialized = false
    this.returningToMenu = false
    
    if (this.aiManager) {
      this.aiManager = undefined
    }

    console.log('✅ [MultiplayerScene] Cleanup complete - disconnected and game stopped')
  }

  protected getUnifiedState() {
    const rawState = this.networkManager?.getState()
    if (!rawState) return null

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

  async create() {
    await super.create()

    // Debug text handling
    if (this.roomDebugText) {
      this.roomDebugText.destroy()
    }

    this.roomDebugText = new Text({
        text: 'Room: Connecting...',
        style: {
            fontSize: 14,
            fill: '#888888',
        }
    })
    this.roomDebugText.position.set(10, 60)
    this.roomDebugText.zIndex = 10000

    this.cameraManager.getUIContainer().addChild(this.roomDebugText)

    this.setupTestAPI({
      getState: () => ({
        joystick: this.joystick ? this.joystick.__test_getState() : null,
        button: this.actionButton ? this.actionButton.__test_getState() : null,
      }),
      movePlayerDirect: async (dx: number, dy: number, durationMs: number): Promise<void> => {
        if (!this.networkManager) {
          throw new Error('NetworkManager not available')
        }

        const length = Math.sqrt(dx * dx + dy * dy)
        const normalizedX = length > 0 ? dx / length : 0
        const normalizedY = length > 0 ? dy / length : 0

        console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)}) for ${durationMs}ms game time`)

        const GameClock = (window as any).GameClock
        const startTime = GameClock.now()
        const endTime = startTime + durationMs

        if (this.controlledPlayerId) {
          while (GameClock.now() < endTime) {
            this.networkManager.sendInput(
              { x: normalizedX, y: normalizedY },
              false,
              undefined,
              this.controlledPlayerId
            )

            await new Promise(resolve => setTimeout(resolve, 5))
          }
        }

        console.log(`🎮 [Test] Direct move complete (game time: ${GameClock.now() - startTime}ms)`)
      },
    })
  }

  private async connectToMultiplayer() {
    if (this.networkManager) {
      console.warn('[MultiplayerScene] Previous NetworkManager exists, cleaning up first')
      this.networkManager.disconnect()
      this.networkManager = undefined
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    try {
      const resolveServerUrl = (): string => {
        const pageIsHttps = window.location.protocol === 'https:'
        const normalizeToWs = (url: string): string => {
          if (url.startsWith('http://')) return url.replace('http://', 'ws://')
          if (url.startsWith('https://')) return url.replace('https://', 'wss://')
          if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`
          return url
        }

        const winUrl = (window as any).__SERVER_URL__ as string | undefined
        if (winUrl) return normalizeToWs(winUrl)

        const portHint = import.meta.env.VITE_SERVER_PORT as string | undefined
        if (portHint) {
          const hostname = window.location.hostname
          return `${pageIsHttps ? 'wss' : 'ws'}://${hostname}:${portHint}`
        }

        const hostname = window.location.hostname
        return `${pageIsHttps ? 'wss' : 'ws'}://${hostname}:3000`
      }

      let serverUrl = resolveServerUrl()

      if (window.location.protocol === 'https:' && serverUrl.startsWith('ws://')) {
        serverUrl = serverUrl.replace('ws://', 'wss://')
      }

      console.log(`[MultiplayerScene] Using server URL: ${serverUrl}`)

      this.networkManager = new NetworkManager({
        serverUrl,
        roomName: 'match',
      })
      const connected = await this.networkManager.connect()
      if (!connected) {
        throw new Error('Connection failed (connect returned false)')
      }

      // Check if scene was destroyed while connecting
      if (!this.networkManager) {
        console.warn('[MultiplayerScene] NetworkManager destroyed during connection')
        return
      }

      this.mySessionId = this.networkManager.getMySessionId()
      this.myPlayerId = `${this.mySessionId}-p1`
      this.controlledPlayerId = `${this.mySessionId}-p1`
      this.isMultiplayer = true
      
      console.log('🎮 [Multiplayer] Human player initialized:', {
        mySessionId: this.mySessionId,
        myPlayerId: this.myPlayerId,
        controlledPlayerId: this.controlledPlayerId
      })

      const room = this.networkManager.getRoom() as (Room & { id?: string; roomId?: string }) | undefined
      const roomId = room?.id ?? room?.roomId ?? 'Unknown'
      if (room && this.roomDebugText) {
        this.roomDebugText.text = `Room: ${roomId}`
      }

      console.log('🎮 Multiplayer mode enabled')
      console.log('📡 Session ID:', this.mySessionId)
      console.log('🏠 Room ID:', roomId)

      if (this.roomDebugText) {
        this.roomDebugText.text = `Room: ${roomId}`
      }

      this.setupNetworkListeners()
      this.networkManager.checkExistingPlayers()
    } catch (error) {
      console.error('❌ Multiplayer connection failed:', error)
      this.isMultiplayer = false
      
      if (this.roomDebugText) {
        this.roomDebugText.text = 'Room: Connection failed'
        this.roomDebugText.style.fill = '#ff4444'
      }
    }
  }

  private setupNetworkListeners() {
    if (!this.networkManager) return

    try {
      this.networkManager.on('playerJoin', (player: any) => {
        try {
          console.log('👤 Remote player joined:', player.id, player.team)
          if (!this.players.has(player.id)) {
            this.createPlayerSprite(player.id, player.x, player.y, player.team)
          }
          this.initializeAI()
        } catch (error) {
          console.error('[MultiplayerScene] Error handling playerJoin:', error)
        }
      })

      this.networkManager.on('playerLeave', (playerId: string) => {
        try {
          console.log('👋 Remote player left:', playerId)
          this.removeRemotePlayer(playerId)
          this.initializeAI()
        } catch (error) {
          console.error('[MultiplayerScene] Error handling playerLeave:', error)
        }
      })

      this.networkManager.on('stateChange', (state: any) => {
        try {
          if (state?.players) {
            state.players.forEach((player: any, playerId: string) => {
              if (!this.players.has(playerId)) {
                console.log(`🎭 Creating player sprite from state: ${playerId} (${player.team})`)
                this.createPlayerSprite(playerId, player.x, player.y, player.team)
              }
            })
          }

          if (!this.colorInitialized && state?.players?.has(this.myPlayerId)) {
            console.log(`🎨 [Init] Initializing colors (colorInitialized=${this.colorInitialized})`)
            this.updateLocalPlayerColor()

            if (!this.positionInitialized) {
              this.syncLocalPlayerPosition()
              this.positionInitialized = true
            }

            this.colorInitialized = true
            console.log(`🎨 [Init] Color initialization complete`)
            
            this.initializeControlArrow()
            this.updatePlayerBorders()
          }
          
          if (!this.myPlayerId && this.mySessionId) {
            console.warn('[MultiplayerScene] myPlayerId not set, initializing from sessionId')
            this.myPlayerId = `${this.mySessionId}-p1`
            this.controlledPlayerId = `${this.mySessionId}-p1`
          }
          
          if (this.colorInitialized && state?.players?.size > 0) {
            this.initializeAI()
          }
        } catch (error) {
          console.error('[MultiplayerScene] Error handling stateChange:', error)
        }
      })

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

      this.networkManager.on('roomClosed', (reason: string) => {
        try {
          if (this.returningToMenu) {
            console.log('[MultiplayerScene] Already returning to menu, ignoring duplicate roomClosed')
            return
          }

          console.log('🚪 Room closed:', reason)
          if (reason === 'opponent_left') {
            console.log('👋 Opponent left the game, returning to menu')
            this.returnToMenu('Opponent left the game')
          } else {
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

  private returnToMenu(message: string): void {
    if (this.returningToMenu) {
      return
    }

    this.returningToMenu = true
    console.log(`🔙 Returning to menu: ${message}`)
    
    // Create popup overlay
    // Use container in UI

    // ... Simplified to direct navigation for now or simple timeout since we don't have complex UI setup in Pixi yet easily
    // We'll mimic what was there

    setTimeout(() => {
        sceneRouter.navigateTo('MenuScene')
    }, 2000)

    // For now, let's just log and navigate soon, the overlay logic requires more graphics code
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

    if (!this.stateUpdateCount) this.stateUpdateCount = 0
    this.stateUpdateCount++

    if (state.ball) {
      if (this.ball.x == null || this.ball.y == null || isNaN(this.ball.x) || isNaN(this.ball.y)) {
        this.ball.x = state.ball.x
        this.ball.y = state.ball.y
      } else {
        const lerpFactor = VISUAL_CONSTANTS.BALL_LERP_FACTOR
        this.ball.x += (state.ball.x - this.ball.x) * lerpFactor
        this.ball.y += (state.ball.y - this.ball.y) * lerpFactor
      }
      this.ballShadow.x = this.ball.x + 2
      this.ballShadow.y = this.ball.y + 3
    }

    state.players.forEach((player: any, playerId: string) => {
      if (playerId === this.myPlayerId) {
        this.reconcileLocalPlayer(player)
      } else {
        this.updateRemotePlayer(playerId, player)
      }
    })

    this.scoreText.text = `${state.scoreBlue} - ${state.scoreRed}`

    const minutes = Math.floor(state.matchTime / 60)
    const seconds = Math.floor(state.matchTime % 60)
    this.timerText.text = `${minutes}:${seconds.toString().padStart(2, '0')}`

    if (state.matchTime <= 30 && state.matchTime > 0) {
      this.timerText.style.fill = '#ff4444'
    } else {
      this.timerText.style.fill = '#ffffff'
    }
  }

  private reconcileLocalPlayer(playerState: any) {
    const myPlayerSprite = this.players.get(this.myPlayerId)
    if (!myPlayerSprite) return

    const serverX = playerState.x
    const serverY = playerState.y
    const deltaX = Math.abs(myPlayerSprite.x - serverX)
    const deltaY = Math.abs(myPlayerSprite.y - serverY)

    let reconcileFactor: number = VISUAL_CONSTANTS.BASE_RECONCILE_FACTOR

    if (deltaX > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD || deltaY > VISUAL_CONSTANTS.LARGE_ERROR_THRESHOLD) {
      reconcileFactor = VISUAL_CONSTANTS.STRONG_RECONCILE_FACTOR
    } else if (
      deltaX > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD ||
      deltaY > VISUAL_CONSTANTS.MODERATE_ERROR_THRESHOLD
    ) {
      reconcileFactor = VISUAL_CONSTANTS.MODERATE_RECONCILE_FACTOR
    }

    myPlayerSprite.x += (serverX - myPlayerSprite.x) * reconcileFactor
    myPlayerSprite.y += (serverY - myPlayerSprite.y) * reconcileFactor
  }

  private updateRemotePlayer(sessionId: string, playerState: any) {
    let sprite = this.players.get(sessionId)

    if (!sprite) {
      console.log('🎭 Creating player (lazy):', sessionId, playerState.team)
      this.createPlayerSprite(sessionId, playerState.x, playerState.y, playerState.team)
      sprite = this.players.get(sessionId)
      if (!sprite) return
    }

    const lerpFactor = VISUAL_CONSTANTS.REMOTE_PLAYER_LERP_FACTOR
    sprite.x += (playerState.x - sprite.x) * lerpFactor
    sprite.y += (playerState.y - sprite.y) * lerpFactor

    // Update color
    // We need to access fill color to update it if it changed.
    // Simplified: we set it on creation and assume it doesn't change often.
    // If we need dynamic updates, we'd need to redraw.
    // Let's assume lazy creation handles most cases.
  }

  private updateLocalPlayerColor() {
    if (!this.isMultiplayer || !this.networkManager || !this.myPlayerId) return

    try {
      const state = this.networkManager.getState()
      if (!state || !state.players) return

      const localPlayer = state.players.get(this.myPlayerId)
      if (!localPlayer) return

      const teamColor =
        localPlayer.team === 'blue' ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR : VISUAL_CONSTANTS.PLAYER_RED_COLOR

      this.playerTeamColor = teamColor
      
      const myPlayerSprite = this.players.get(this.myPlayerId)
      if (myPlayerSprite) {
        // Redraw with new color
        // myPlayerSprite.clear() ...
        // We'll skip for now as updateRemotePlayer handles lazy creation which sets color
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
      if (!localPlayer) return

      const myPlayerSprite = this.players.get(this.myPlayerId)
      if (myPlayerSprite) {
        myPlayerSprite.position.set(localPlayer.x, localPlayer.y)
      }
    } catch (error) {
      console.error('[MultiplayerScene] Error syncing local player position:', error)
    }
  }

  private initializeAI() {
    if (!this.networkManager || !this.isMultiplayer) return

    const state = this.networkManager.getState()
    if (!state || !state.players || state.players.size === 0) return

    if (!this.myPlayerId) {
      console.warn('[MultiplayerScene] Cannot initialize AI: myPlayerId not set')
      return
    }

    const localPlayer = state.players.get(this.myPlayerId)
    if (!localPlayer) return

    const myTeam: 'blue' | 'red' = localPlayer.team
    
    const myTeamPlayerIds: string[] = []
    const opponentTeamPlayerIds: string[] = []

    state.players.forEach((player: any, playerId: string) => {
      if (player.team === myTeam) {
        myTeamPlayerIds.push(playerId)
      }
    })

    if (!this.aiManager) {
      this.aiManager = new AIManager()
    }
    
    if (myTeam === 'blue') {
      this.aiManager.initialize(
        myTeamPlayerIds,
        opponentTeamPlayerIds,
        (playerId, decision) => this.applyAIDecision(playerId, decision)
      )
    } else {
      this.aiManager.initialize(
        opponentTeamPlayerIds,
        myTeamPlayerIds,
        (playerId, decision) => this.applyAIDecision(playerId, decision)
      )
    }

    console.log(`🤖 AI initialized for ${myTeam} team`)
  }

  private updateAI(): void {
    if (!this.aiManager || !this.aiEnabled) return

    if (this.returningToMenu) return

    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return

    const gameStateData = this.convertUnifiedStateToGameStateData(unifiedState)

    try {
      this.aiManager.update(gameStateData)
    } catch (error) {
      console.error('[MultiplayerScene] Error during AI update:', error)
    }
  }
  
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

  protected onPlayerSwitched(playerId: string): void {
    console.log(`🔄 [Multiplayer] Player switched to: ${playerId}`)
  }

  protected applyAIDecision(playerId: string, decision: any): void {
    if (!this.networkManager || !this.isMultiplayer) return

    if (!this.shouldAllowAIControl(playerId)) return

    const unifiedState = this.getUnifiedState()
    if (!unifiedState) return
    
    const myTeam = StateAdapter.getPlayerTeam(unifiedState, this.myPlayerId)
    const playerTeam = StateAdapter.getPlayerTeam(unifiedState, playerId)
    
    if (!myTeam || !playerTeam || playerTeam !== myTeam) return

    const ballPossessor = unifiedState.ball.possessedBy
    if (ballPossessor === playerId) {
      if (playerId !== this.controlledPlayerId) {
        this.switchToPlayer(playerId)
        console.log(`⚽ [AI->Human] Auto control transfer to ball possessor ${playerId}`)
      }
      return
    }

    this.networkManager.sendInput(
      { x: decision.moveX, y: decision.moveY },
      decision.shootPower !== null,
      decision.shootPower ?? undefined,
      playerId,
      false
    )
  }

  protected shouldAllowAIControl(playerId: string): boolean {
    if (!this.isMultiplayer || !this.networkManager) {
      return super.shouldAllowAIControl(playerId)
    }

    if (playerId === this.controlledPlayerId) return false
    if (playerId === this.mySessionId) return true

    return super.shouldAllowAIControl(playerId)
  }
}
