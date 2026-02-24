import { Application, Text } from 'pixi.js'
import { GAME_CONFIG } from '@shared/types'
import { NetworkManager } from '@/network/NetworkManager'
import { GeometryUtils } from '@shared/utils/geometry'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import type { GameEngineState, EnginePlayerData } from '@shared/engine/types'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '@/ai'
import { sceneRouter } from '@/utils/SceneRouter'
import type { Room } from 'colyseus.js'
import { PixiSceneManager } from '@/utils/PixiSceneManager'
import { NetworkSmoothnessMetrics } from '@/utils/NetworkSmoothnessMetrics'

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
  private lastControlledPlayerId?: string
  private lastMovementWasNonZero: boolean = false
  private smoothnessMetrics?: NetworkSmoothnessMetrics

  // Snapshot interpolation state — store recent server snapshots and interpolate
  // between them with a small delay.  Eliminates the "sawtooth" target-position
  // discontinuity that dead-reckoning + lerp produces on every patch arrival.
  private static readonly INTERP_DELAY_MS = 25 // render ~1.5 patch-intervals in the past at 60Hz
  private static readonly MAX_SNAPSHOTS = 6
  private static readonly SNAP_DISTANCE = 100 // teleport threshold (goal reset, etc.)

  private ballSnapshots: Array<{ x: number; y: number; vx: number; vy: number; t: number }> = []
  private lastBallPossessedBy: string = ''
  private remotePlayerSnapshots = new Map<string, Array<{ x: number; y: number; t: number }>>()

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
    this.lastControlledPlayerId = undefined
    this.lastMovementWasNonZero = false

    this.smoothnessMetrics = new NetworkSmoothnessMetrics()
    window.__networkMetrics = this.smoothnessMetrics

    this.connectToMultiplayer()
  }

  protected getGameState(): any {
    return this.networkManager?.getState() || null
  }

  protected updateGameState(delta: number): void {
    if (!this.container.visible || !this.isMultiplayer || !this.networkManager) {
      return
    }

    try {
      const dt = delta / 1000 // Convert to seconds assuming delta is MS.

      const currentControlledId = this.controlledPlayerId
      if (this.lastControlledPlayerId && this.lastControlledPlayerId !== currentControlledId) {
        if (this.networkManager.isConnected()) {
          // Send a stop for the previously controlled player to avoid lingering movement
          this.networkManager.sendInput(
            { x: 0, y: 0 },
            false,
            this.lastControlledPlayerId,
            true
          )
        }
        this.lastMovementWasNonZero = false
      }
      this.lastControlledPlayerId = currentControlledId

      const movement = this.collectMovementInput()

      const hasMovement =
        Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
        Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT

      if (hasMovement) {
        const controlledSprite = this.players.get(this.controlledPlayerId)

        if (controlledSprite) {
          controlledSprite.x += movement.x * GAME_CONFIG.PLAYER_SPEED * dt
          controlledSprite.y += movement.y * GAME_CONFIG.PLAYER_SPEED * dt

          // Clamp to field bounds (matches server physics)
          controlledSprite.x = Math.max(0, Math.min(controlledSprite.x, GAME_CONFIG.FIELD_WIDTH))
          controlledSprite.y = Math.max(0, Math.min(controlledSprite.y, GAME_CONFIG.FIELD_HEIGHT))
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
            this.controlledPlayerId,
            true
          )
          this.lastMovementWasNonZero = true
        } else if (!hasMovement && this.lastMovementWasNonZero && this.networkManager.isConnected()) {
          // Send a single "stop" input so the server doesn't keep moving on hold-last-input
          this.networkManager.sendInput(
            { x: 0, y: 0 },
            false,
            this.controlledPlayerId,
            true
          )
          this.lastMovementWasNonZero = false
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
        this.smoothnessMetrics?.samplePreSync(state, this.players, this.myPlayerId)
        this.syncFromServerState(state)
        this.smoothnessMetrics?.samplePostSync(this.ball, this.players, this.myPlayerId)
      }
    } catch (error) {
      console.error('[MultiplayerScene] Error during updateGameState:', error)
    }
  }

  protected handleShootAction(): void {
    if (this.isMultiplayer && this.networkManager && this.controlledPlayerId) {
      this.networkManager.sendInput({ x: 0, y: 0 }, true, this.controlledPlayerId, true)
      console.log('📤 Shoot action sent to server, player:', this.controlledPlayerId)
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

    if (this.smoothnessMetrics) {
      delete window.__networkMetrics
      this.smoothnessMetrics = undefined
    }

    this.ballSnapshots.length = 0
    this.lastBallPossessedBy = ''
    this.remotePlayerSnapshots.clear()

    console.log('✅ [MultiplayerScene] Cleanup complete - disconnected and game stopped')
  }

  protected getUnifiedState(): GameEngineState | null {
    const rawState = this.networkManager?.getState()
    if (!rawState) return null
    return this.fromNetwork(rawState)
  }

  /**
   * Convert NetworkManager state (Multiplayer) to GameEngineState format
   */
  private fromNetwork(state: any): GameEngineState {
    const unifiedPlayers = new Map<string, EnginePlayerData>()

    // Handle both flat (NetworkManager) and nested (Shared Types) formats
    // The server schema uses flat x/y, but shared types define nested position
    if (state.players) {
        state.players.forEach((player: any, id: string) => {
          unifiedPlayers.set(id, {
            id: player.id,
            team: player.team,
            isHuman: player.isHuman,
            isControlled: player.isControlled,
            x: player.x ?? player.position?.x ?? 0,
            y: player.y ?? player.position?.y ?? 0,
            velocityX: player.velocityX ?? player.velocity?.x ?? 0,
            velocityY: player.velocityY ?? player.velocity?.y ?? 0,
            state: player.state,
            direction: player.direction,
          })
        })
    }

    const ballX = state.ball?.x ?? state.ball?.position?.x ?? 0
    const ballY = state.ball?.y ?? state.ball?.position?.y ?? 0
    const ballVx = state.ball?.velocityX ?? state.ball?.velocity?.x ?? 0
    const ballVy = state.ball?.velocityY ?? state.ball?.velocity?.y ?? 0

    return {
      players: unifiedPlayers,
      ball: {
        x: ballX,
        y: ballY,
        velocityX: ballVx,
        velocityY: ballVy,
        possessedBy: state.ball?.possessedBy || '',
        pressureLevel: state.ball?.pressureLevel ?? 0,
      },
      scoreBlue: state.scoreBlue,
      scoreRed: state.scoreRed,
      matchTime: state.matchTime,
      phase: state.phase,
    }
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

    // Update text if already connected (race condition with initializeGameState)
    if (this.networkManager?.isConnected()) {
        const room = this.networkManager.getRoom() as any
        const roomName = this.networkManager.roomName !== 'Unknown'
            ? this.networkManager.roomName
            : (room?.metadata?.roomName || 'Unknown')
        const roomId = room?.id ?? room?.roomId ?? 'Unknown'
        this.roomDebugText.text = `Room: ${roomName} (${roomId})`
    }

    this.setupTestAPI({
      getState: () => ({
        joystick: this.joystick ? this.joystick.__test_getState() : null,
        button: this.actionButton ? this.actionButton.__test_getState() : null,
      }),
      movePlayerDirect: async (dx: number, dy: number, durationMs: number): Promise<void> => {
        if (!this.networkManager) {
          throw new Error('NetworkManager not available')
        }

        const normalized = GeometryUtils.normalizeScalar(dx, dy)
        const normalizedX = normalized.x
        const normalizedY = normalized.y

        console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)}) for ${durationMs}ms game time`)

        const GameClock = (window as any).GameClock
        const startTime = GameClock.now()
        const endTime = startTime + durationMs

        if (this.controlledPlayerId) {
          while (GameClock.now() < endTime) {
            this.networkManager.sendInput(
              { x: normalizedX, y: normalizedY },
              false,
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
    try {
      this.networkManager = NetworkManager.getInstance()
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

      const room = this.networkManager.getRoom() as (Room & { id?: string; roomId?: string; metadata?: any }) | undefined
      const roomId = room?.id ?? room?.roomId ?? 'Unknown'
      const roomName = this.networkManager.roomName !== 'Unknown'
          ? this.networkManager.roomName
          : (room?.metadata?.roomName || 'Unknown')

      // Update URL with room ID for deep linking
      if (roomId !== 'Unknown') {
          const currentHash = window.location.hash.split('?')[0]
          const newUrl = `${currentHash}?id=${roomId}`
          console.log(`🔗 Updating URL to: ${newUrl}`)
          window.history.replaceState(null, '', newUrl)
      }

      if (room && this.roomDebugText) {
        this.roomDebugText.text = `Room: ${roomName} (${roomId})`
      }

      console.log('🎮 Multiplayer mode enabled')
      console.log('📡 Session ID:', this.mySessionId)
      console.log('🏠 Room ID:', roomId)

      this.setupNetworkListeners()
      this.networkManager.checkExistingPlayers()
    } catch (error) {
      console.error('❌ Multiplayer connection failed:', error)
      this.isMultiplayer = false
      
      if (this.roomDebugText) {
        this.roomDebugText.text = 'Room: Connection failed'
        this.roomDebugText.style.fill = '#ff4444'
      }

      // Redirect to lobby on failure
      console.log('🔙 Redirecting to lobby due to connection failure')
      setTimeout(() => {
          sceneRouter.navigateTo('LobbyScene')
      }, 2000)
    }
  }

  private setupNetworkListeners() {
    if (!this.networkManager) return

    try {
      this.networkManager.on('playerReady', (_sessionId: string, _team: string, roomName?: string) => {
          if (roomName && this.roomDebugText) {
               const roomId = this.networkManager?.getRoom()?.roomId || 'Unknown'
               this.roomDebugText.text = `Room: ${roomName} (${roomId})`
          }
      })

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

    // Disconnect immediately to allow server to clean up session while user sees the message
    if (this.networkManager) {
      console.log('🔌 [ReturnToMenu] Disconnecting early to facilitate cleanup')
      this.networkManager.disconnect()
    }
    
    setTimeout(() => {
        sceneRouter.navigateTo('MenuScene')
    }, 2000)
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
      const now = performance.now()
      const serverBall = state.ball

      // Detect possession change → reset snapshots so we don't interpolate across a teleport
      const currentPossessor = serverBall.possessedBy || ''
      if (currentPossessor !== this.lastBallPossessedBy) {
        this.ballSnapshots.length = 0
        this.lastBallPossessedBy = currentPossessor
      }

      // Push a new snapshot when the server reports a changed position
      const snaps = this.ballSnapshots
      const lastSnap = snaps.length > 0 ? snaps[snaps.length - 1] : null
      if (
        !lastSnap ||
        serverBall.x !== lastSnap.x ||
        serverBall.y !== lastSnap.y ||
        (serverBall.velocityX ?? 0) !== lastSnap.vx ||
        (serverBall.velocityY ?? 0) !== lastSnap.vy
      ) {
        snaps.push({
          x: serverBall.x,
          y: serverBall.y,
          vx: serverBall.velocityX ?? 0,
          vy: serverBall.velocityY ?? 0,
          t: now,
        })
        if (snaps.length > MultiplayerScene.MAX_SNAPSHOTS) snaps.shift()
      }

      if (this.ball.x == null || this.ball.y == null || isNaN(this.ball.x) || isNaN(this.ball.y)) {
        this.ball.x = serverBall.x
        this.ball.y = serverBall.y
      } else if (snaps.length < 2) {
        // Not enough snapshots yet — snap directly
        this.ball.x = serverBall.x
        this.ball.y = serverBall.y
      } else {
        // Snapshot interpolation: render at (now - INTERP_DELAY) and interpolate
        // between the two bracketing snapshots.  This eliminates the sawtooth
        // target-position discontinuity that dead-reckoning produces on each patch.
        const renderTime = now - MultiplayerScene.INTERP_DELAY_MS

        // Find the two snapshots that bracket renderTime
        let s0 = snaps[0]
        let s1 = snaps[1]
        for (let i = 1; i < snaps.length; i++) {
          if (snaps[i].t >= renderTime) {
            s0 = snaps[i - 1]
            s1 = snaps[i]
            break
          }
          // If renderTime is past all snapshots, use the last two
          s0 = snaps[i - 1]
          s1 = snaps[i]
        }

        const interval = s1.t - s0.t
        let targetX: number
        let targetY: number

        if (interval <= 0) {
          targetX = s1.x
          targetY = s1.y
        } else {
          // alpha: <0 = render time before s0 (ramp-up), 0-1 = interpolating, >1 = extrapolating
          const rawAlpha = (renderTime - s0.t) / interval

          if (rawAlpha < 0) {
            // Render time is before first snapshot pair — use latest position to avoid stall
            const latest = snaps[snaps.length - 1]
            targetX = latest.x
            targetY = latest.y
          } else if (rawAlpha <= 1.0) {
            // Pure interpolation between two known server positions
            targetX = s0.x + (s1.x - s0.x) * rawAlpha
            targetY = s0.y + (s1.y - s0.y) * rawAlpha
          } else {
            // Slight extrapolation using last snapshot's velocity (capped at 2x interval)
            const alpha = Math.min(rawAlpha, 2.0)
            const extraDt = ((alpha - 1.0) * interval) / 1000
            targetX = s1.x + s1.vx * extraDt
            targetY = s1.y + s1.vy * extraDt
          }

          targetX = Math.max(0, Math.min(targetX, GAME_CONFIG.FIELD_WIDTH))
          targetY = Math.max(0, Math.min(targetY, GAME_CONFIG.FIELD_HEIGHT))
        }

        // Teleport detection: snap immediately on large jumps (goal reset, etc.)
        const dx = targetX - this.ball.x
        const dy = targetY - this.ball.y
        if (dx * dx + dy * dy > MultiplayerScene.SNAP_DISTANCE * MultiplayerScene.SNAP_DISTANCE) {
          this.ball.x = targetX
          this.ball.y = targetY
        } else {
          // Gentle final smoothing (high factor — target is already continuous)
          this.ball.x += dx * 0.7
          this.ball.y += dy * 0.7
        }
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

    // Update broadcast-style scoreboard
    if (this.blueScoreText) this.blueScoreText.text = `${state.scoreBlue}`
    if (this.redScoreText) this.redScoreText.text = `${state.scoreRed}`

    const minutes = Math.floor(state.matchTime / 60)
    const seconds = Math.floor(state.matchTime % 60)
    this.timerText.text = `${minutes}:${seconds.toString().padStart(2, '0')}`

    // Timer urgency effect in last 30 seconds
    if (state.matchTime <= 30 && state.matchTime > 0) {
      this.timerText.style.fill = '#ff5252'
      if (this.timerBg) {
        this.timerBg.tint = 0xff5252
        this.timerBg.alpha = 0.15 + Math.sin(Date.now() / 200) * 0.05
      }
    } else {
      this.timerText.style.fill = '#ffffff'
      if (this.timerBg) {
        this.timerBg.tint = 0xffffff
        this.timerBg.alpha = 1
      }
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

    const now = performance.now()

    // Build snapshot buffer for this player
    let snaps = this.remotePlayerSnapshots.get(sessionId)
    if (!snaps) {
      snaps = []
      this.remotePlayerSnapshots.set(sessionId, snaps)
    }

    const lastSnap = snaps.length > 0 ? snaps[snaps.length - 1] : null
    if (!lastSnap || lastSnap.x !== playerState.x || lastSnap.y !== playerState.y) {
      snaps.push({ x: playerState.x, y: playerState.y, t: now })
      if (snaps.length > MultiplayerScene.MAX_SNAPSHOTS) snaps.shift()
    }

    if (snaps.length < 2) {
      // Not enough history — snap directly
      sprite.x = playerState.x
      sprite.y = playerState.y
      return
    }

    // Snapshot interpolation (same approach as ball)
    const renderTime = now - MultiplayerScene.INTERP_DELAY_MS
    let s0 = snaps[0]
    let s1 = snaps[1]
    for (let i = 1; i < snaps.length; i++) {
      if (snaps[i].t >= renderTime) {
        s0 = snaps[i - 1]
        s1 = snaps[i]
        break
      }
      s0 = snaps[i - 1]
      s1 = snaps[i]
    }

    const interval = s1.t - s0.t
    let targetX: number
    let targetY: number

    if (interval <= 0) {
      targetX = s1.x
      targetY = s1.y
    } else {
      const rawAlpha = (renderTime - s0.t) / interval
      if (rawAlpha < 0) {
        // Render time before first pair — use latest to avoid stall
        const latest = snaps[snaps.length - 1]
        targetX = latest.x
        targetY = latest.y
      } else if (rawAlpha <= 1.0) {
        targetX = s0.x + (s1.x - s0.x) * rawAlpha
        targetY = s0.y + (s1.y - s0.y) * rawAlpha
      } else {
        // Extrapolate linearly from last two snapshots (capped at 2x interval)
        const alpha = Math.min(rawAlpha, 2.0)
        targetX = s1.x + (s1.x - s0.x) * (alpha - 1.0)
        targetY = s1.y + (s1.y - s0.y) * (alpha - 1.0)
      }
      targetX = Math.max(0, Math.min(targetX, GAME_CONFIG.FIELD_WIDTH))
      targetY = Math.max(0, Math.min(targetY, GAME_CONFIG.FIELD_HEIGHT))
    }

    // Teleport detection
    const dx = targetX - sprite.x
    const dy = targetY - sprite.y
    if (dx * dx + dy * dy > MultiplayerScene.SNAP_DISTANCE * MultiplayerScene.SNAP_DISTANCE) {
      sprite.x = targetX
      sprite.y = targetY
    } else {
      sprite.x += dx * 0.7
      sprite.y += dy * 0.7
    }
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

    try {
      this.aiManager.update(unifiedState)
    } catch (error) {
      console.error('[MultiplayerScene] Error during AI update:', error)
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
    
    const myTeam = this.getPlayerTeam(unifiedState, this.myPlayerId)
    const playerTeam = this.getPlayerTeam(unifiedState, playerId)
    
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
      decision.shoot,
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
