import { GAME_CONFIG } from '@shared/types'
import { NetworkManager } from '../network/NetworkManager'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { StateAdapter, type UnifiedGameState } from '../utils/StateAdapter'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '../ai'

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

  // AI support
  private aiEnabled: boolean = true

  constructor() {
    super({ key: 'MultiplayerScene' })
  }

  protected initializeGameState(): void {
    if (GameClock.isMockMode()) {
      console.warn('🕐 MultiplayerScene detected mock GameClock mode - switching to real time')
    }
    GameClock.useRealTime()
    GameClock.resetTimeScale()

    // Connect to multiplayer server
    this.connectToMultiplayer()
  }

  protected getGameState(): any {
    return this.networkManager?.getState() || null
  }

  protected updateGameState(delta: number): void {
    const dt = delta / 1000 // Convert to seconds

    // Get input from joystick or keyboard (using base class method)
    const movement = this.collectMovementInput()

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

    // Collect human input for controlled player
    // Only send if there's actual movement (avoid sending zero input that stops player)
    if (this.isMultiplayer && this.networkManager && this.controlledPlayerId) {
      const movement = this.collectMovementInput()
      const hasMovement =
        Math.abs(movement.x) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT ||
        Math.abs(movement.y) > VISUAL_CONSTANTS.MIN_MOVEMENT_INPUT
      
      // Only send input if there's actual movement
      // This prevents sending (0,0) which would stop the player
      if (hasMovement) {
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
    if (this.aiEnabled && this.aiManager && this.isMultiplayer) {
      this.updateAI()
    }

    // Flush all inputs (human + AI) to server
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.flushInputs()
    }

    // Update from server state (process immediately for lower latency)
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState()
      if (state) {
        this.syncFromServerState(state)
      }
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

    // Add room debug text (multiplayer-specific UI) at top left corner
    this.roomDebugText = this.add.text(10, 10, 'Room: Not connected', {
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
        joystick: this.joystick.__test_getState(),
        button: this.actionButton.__test_getState(),
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
    try {
      const hostname = window.location.hostname
      // Use environment variable for server port (3000 for dev, 3001 for test)
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000'
      const serverUrl = `ws://${hostname}:${serverPort}`

      this.networkManager = new NetworkManager({
        serverUrl,
        roomName: 'match',
      })
      await this.networkManager.connect()
      this.mySessionId = this.networkManager.getMySessionId()
      // Set myPlayerId to match session ID (human-controlled player on this client)
      // This is used for team detection and switching logic
      this.myPlayerId = this.mySessionId
      // Initialize controlledPlayerId to the human player
      // This can change when switching to teammates
      this.controlledPlayerId = this.mySessionId
      this.isMultiplayer = true
      
      console.log('🎮 [Multiplayer] Human player initialized:', {
        mySessionId: this.mySessionId,
        myPlayerId: this.myPlayerId,
        controlledPlayerId: this.controlledPlayerId
      })

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
          
          // Initialize AI after colors are set (we have valid state now)
          // Also ensure myPlayerId is still set (in case it wasn't set during connection)
          if (!this.myPlayerId && this.mySessionId) {
            console.warn('[MultiplayerScene] myPlayerId not set, initializing from sessionId')
            this.myPlayerId = this.mySessionId
            this.controlledPlayerId = this.mySessionId
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

      console.log('✅ Network listeners set up successfully')
    } catch (error) {
      console.error('[MultiplayerScene] Error setting up network listeners:', error)
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
    state.players.forEach((player: any, sessionId: string) => {
      if (sessionId === this.mySessionId) {
        // Server reconciliation for local player
        this.reconcileLocalPlayer(player)
      } else {
        // Update or create remote player
        this.updateRemotePlayer(sessionId, player)
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
    const serverX = playerState.x
    const serverY = playerState.y
    const deltaX = Math.abs(this.player.x - serverX)
    const deltaY = Math.abs(this.player.y - serverY)

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
      console.error('[MultiplayerScene] Error updating local player color:', error)
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

    // Verify mySessionId is set
    if (!this.mySessionId) {
      console.warn('[MultiplayerScene] Cannot initialize AI: mySessionId not set')
      return
    }

    // Find which team the local player is on
    const localPlayer = state.players.get(this.mySessionId)
    if (!localPlayer) {
      console.warn('[MultiplayerScene] Cannot initialize AI: local player not found in state')
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
    console.log(`   Local player: ${this.mySessionId} (currently controlled: ${this.controlledPlayerId ?? 'unknown'})`)
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
    this.aiManager.update(gameStateData)
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
