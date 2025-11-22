import { Client, Room } from 'colyseus.js'
import { gameClock } from '@shared/engine/GameClock'

export interface NetworkConfig {
  serverUrl: string
  roomName: string
}

export interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number // 0.0-1.0, power for shooting (optional, defaults to 0.8)
  timestamp: number
  playerId: string // Player ID this input is for
}

export interface MultiPlayerInput {
  inputs: Map<string, PlayerInput> // Map of playerId -> input
  timestamp: number
}

export interface RemotePlayer {
  id: string
  team: 'blue' | 'red'
  x: number
  y: number
  velocityX: number
  velocityY: number
  state: 'idle' | 'running' | 'kicking'
  direction: number
}

export interface GameStateData {
  matchTime: number
  scoreBlue: number
  scoreRed: number
  phase: 'waiting' | 'playing' | 'ended'
  players: Map<string, RemotePlayer>
  ball: {
    x: number
    y: number
    velocityX: number
    velocityY: number
    possessedBy: string
    pressureLevel: number // 0.0-1.0, how much pressure on possessor
  }
}

/**
 * NetworkManager handles all client-server communication
 * - Connection management
 * - State synchronization
 * - Input buffering and transmission
 * - Event handling
 */
export class NetworkManager {
  private client: Client
  private room?: Room
  private config: NetworkConfig

  // Connection state
  private connected: boolean = false
  private sessionId: string = ''
  private lastRoomClosedReason: string | null = null
  private roomClosedListeners: Array<(reason: string) => void> = []

  // Input buffering - collect all player inputs and send together
  private inputBuffer: Map<string, PlayerInput> = new Map()

  // Event callbacks
  private onStateChange?: (state: GameStateData) => void
  private onPlayerJoin?: (player: RemotePlayer) => void
  private onPlayerLeave?: (playerId: string) => void
  private onGoalScored?: (team: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onMatchStart?: (duration: number) => void
  private onMatchEnd?: (winner: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onConnectionError?: (error: string) => void
  private onPlayerReady?: (sessionId: string, team: 'blue' | 'red') => void

  constructor(config: NetworkConfig) {
    this.config = config
    this.client = new Client(config.serverUrl)
  }

  /**
   * Get room name with support for test isolation
   * Priority: URL param > window variable > default config
   */
  private getRoomName(): string {
    // Check URL parameters for ?roomId=...
    const urlParams = new URLSearchParams(window.location.search)
    const urlRoomId = urlParams.get('roomId')
    if (urlRoomId) {
      return urlRoomId
    }

    // Check window variable for test isolation
    const testRoomId = (window as any).__testRoomId
    if (testRoomId) {
      // Log for test verification (dev/test mode only)
      if (import.meta.env.DEV) {
        console.log('[NetworkManager] Using test room:', testRoomId)
      }
      return testRoomId
    }

    // Default to config room name
    return this.config.roomName
  }

  /**
   * Connect to the game server and join a match room
   */
  async connect(): Promise<boolean> {
    try {
      // Suppress console errors during Colyseus connection (schema deserialization warnings)
      const originalError = console.error
      const filteredError = (...args: any[]) => {
        const msg = args[0]?.toString() || ''
        if (msg.includes('Cannot read properties of undefined')) {
          // Suppress harmless Colyseus schema initialization errors
          return
        }
        originalError.apply(console, args)
      }
      console.error = filteredError

      // Get room name (test room ID or production room)
      const roomName = this.getRoomName()
      console.log('[NetworkManager] Connecting with roomName:', roomName)

      // Build options object with roomName and optional timeScale (for tests)
      const options: any = { roomName }

      // Check for test time scale
      const testTimeScale = (window as any).__testTimeScale
      if (testTimeScale) {
        options.timeScale = testTimeScale
      }

      // ALWAYS pass roomName for filterBy to work correctly
      // Tests: unique room ID for isolation + time scale
      // Production: use config room name for matchmaking
      this.room = await this.client.joinOrCreate('match', options)

      // Restore console.error
      console.error = originalError

      this.sessionId = this.room.sessionId
      this.connected = true

      // Log for test verification (dev/test mode only)
      if (import.meta.env.DEV) {
        console.log('[NetworkManager] Connected! Session ID:', this.sessionId)
      }

      // Handle room errors
      this.room.onError((code, message) => {
        console.error('[NetworkManager] Room error:', code, message)
        this.onConnectionError?.(`Room error: ${message}`)
      })

      // Handle room leave (will be set up in setupMessageListeners)
      // This is just to mark as disconnected for early connection issues
      this.room.onLeave(() => {
        this.connected = false
      })

      // Set up state change listeners
      this.setupStateListeners()

      // Set up message listeners
      this.setupMessageListeners()

      return true
    } catch (error) {
      console.error('[NetworkManager] Connection failed:', error)
      this.onConnectionError?.((error as Error).message)
      return false
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    console.log('[NetworkManager] Disconnecting...')
    
    // Clear all event callbacks first to prevent triggering during disconnect
    
    if (this.room) {
      try {
        this.room.leave()
      } catch (e) {
        console.warn('[NetworkManager] Error during room.leave():', e)
      }
      this.connected = false
      this.room = undefined
    }
    
    // Clear input buffer
    this.inputBuffer.clear()
    
    // Clear all event callbacks to prevent stale references
    this.onStateChange = undefined
    this.onPlayerJoin = undefined
    this.onPlayerLeave = undefined
    this.onGoalScored = undefined
    this.onMatchStart = undefined
    this.onMatchEnd = undefined
    this.onConnectionError = undefined
    this.onPlayerReady = undefined
    this.roomClosedListeners = []
    
    console.log('[NetworkManager] Disconnected and cleaned up')
  }

  /**
   * Send input for a single player (adds to buffer, sends when ready)
   * Note: Action inputs (shooting) are buffered and sent with other inputs, not immediately
   * Movement inputs from human players are sent immediately for lower latency
   */
  sendInput(movement: { x: number; y: number }, action: boolean, actionPower: number | undefined, playerId: string, isHuman: boolean = false): void {
    if (!this.connected || !this.room) {
      return
    }

    const input: PlayerInput = {
      movement,
      action,
      actionPower,
      timestamp: gameClock.now(),
      playerId, // Always required - which player this input is for
    }

    // Add to buffer (overwrites previous input for same player)
    // If player already has an input in buffer, merge appropriately
    const existingInput = this.inputBuffer.get(playerId)
    if (existingInput) {
      // Safety: If existing input is from human and new input is from AI, preserve human input
      // This prevents AI from overwriting human input
      const existingIsHuman = (existingInput as any).isHuman ?? false
      if (existingIsHuman && !isHuman) {
        // Human input takes priority - don't overwrite with AI input
        return
      }
      
      if (action) {
        // Shooting: preserve existing movement, add action
        input.movement = existingInput.movement
      } else if (existingInput.action) {
        // Movement update: preserve action if it exists
        input.action = existingInput.action
        input.actionPower = existingInput.actionPower
      }
    }

    // Mark input source for priority handling
    ;(input as any).isHuman = isHuman

    this.inputBuffer.set(playerId, input)
    
    // Send immediately for human movement inputs (reduces latency by ~16ms)
    // Action inputs (shooting) are still buffered to merge with movement
    if (isHuman && !action && (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01)) {
      this.flushInputBuffer()
    }
  }

  /**
   * Send all buffered inputs to server (called every frame)
   */
  flushInputs(): void {
    if (!this.room || this.inputBuffer.size === 0) {
      return
    }

    // Always send if there's input - don't rate limit
    // The server can handle the input rate
    this.flushInputBuffer()
  }

  /**
   * Flush input buffer to server
   */
  private flushInputBuffer(): void {
    // Don't send if not connected or no room
    if (!this.connected || !this.room || this.inputBuffer.size === 0) {
      return
    }

    // Convert Map to serializable format
    const inputsMap: { [key: string]: PlayerInput } = {}
    this.inputBuffer.forEach((input, playerId) => {
      inputsMap[playerId] = input
    })

    const multiInput: MultiPlayerInput = {
      inputs: inputsMap as any, // Will be serialized as object
      timestamp: gameClock.now(),
    }

    // Debug: Log what we're sending (occasionally)
    if (Math.random() < 0.05) { // 5% of the time
      const playerIds = Object.keys(inputsMap)
      console.log(`[NetworkManager] Sending inputs for ${playerIds.length} players:`, playerIds)
      playerIds.forEach(id => {
        const input = inputsMap[id]
        console.log(`  ${id}: move(${input.movement.x.toFixed(2)}, ${input.movement.y.toFixed(2)}), action=${input.action}`)
      })
    }

    this.room.send('inputs', multiInput)

    // Clear buffer after sending
    this.inputBuffer.clear()
  }

  /**
   * Set up listeners for server state changes
   */
  private setupStateListeners(): void {
    if (!this.room) return

    let playersHooksRegistered = false
    const tryHookPlayers = (state: any) => {
      if (playersHooksRegistered) return
      const players = state?.players
      if (players && typeof players.onAdd === 'function' && typeof players.onRemove === 'function') {
        playersHooksRegistered = true

        players.onAdd((player: any, key: string) => {
          try {
            if (key === this.sessionId) return
            this.onPlayerJoin?.({
              id: player.id || key,
              team: player.team || 'blue',
              x: player.x || 0,
              y: player.y || 0,
              velocityX: player.velocityX || 0,
              velocityY: player.velocityY || 0,
              state: player.state || 'idle',
              direction: player.direction || 0,
            })
          } catch (error) {
            console.error('[NetworkManager] Error in player join:', error)
          }
        })

        players.onRemove((_player: any, key: string) => {
          try {
            this.onPlayerLeave?.(key)
          } catch (error) {
            console.error('[NetworkManager] Error in player leave:', error)
          }
        })
      }
    }

    // Attempt immediate hook with current state
    tryHookPlayers(this.room.state)

    // Listen for state changes
    this.room.onStateChange((state) => {
      try {
        tryHookPlayers(state)

        if (!state || !state.ball || !state.players || typeof state.players.forEach !== 'function') {
          console.warn('[NetworkManager] State or ball not ready yet')
          return
        }

        const gameState: GameStateData = {
          matchTime: state.matchTime || 0,
          scoreBlue: state.scoreBlue || 0,
          scoreRed: state.scoreRed || 0,
          phase: state.phase || 'waiting',
          players: new Map(),
          ball: {
            x: state.ball.x || 0,
            y: state.ball.y || 0,
            velocityX: state.ball.velocityX || 0,
            velocityY: state.ball.velocityY || 0,
            possessedBy: state.ball.possessedBy || '',
            pressureLevel: state.ball.pressureLevel || 0,
          },
        }

        // Convert players
        if (state.players) {
          state.players.forEach((player: any, key: string) => {
            gameState.players.set(key, {
              id: player.id || key,
              team: player.team || 'blue',
              x: player.x || 0,
              y: player.y || 0,
              velocityX: player.velocityX || 0,
              velocityY: player.velocityY || 0,
              state: player.state || 'idle',
              direction: player.direction || 0,
            })
          })
        }

        this.onStateChange?.(gameState)
      } catch (error) {
        console.error('[NetworkManager] Error in state change:', error)
      }
    })

  }

  /**
   * Set up listeners for server messages
   */
  private setupMessageListeners(): void {
    if (!this.room) return

    // Player ready event - confirms player is fully initialized on server
    this.room.onMessage('player_ready', (message) => {
      // Update sessionId from server confirmation (though it should already match)
      this.sessionId = message.sessionId
      this.onPlayerReady?.(message.sessionId, message.team)
    })

    // Match start event
    this.room.onMessage('match_start', (message) => {
      this.onMatchStart?.(message.duration)
    })

    // Match end event
    this.room.onMessage('match_end', (message) => {
      this.onMatchEnd?.(message.winner, message.scoreBlue, message.scoreRed)
    })

    // Goal scored event (optional - can also track via state changes)
    this.room.onMessage('goal_scored', (message) => {
      this.onGoalScored?.(message.team, message.scoreBlue, message.scoreRed)
    })

    // Room closed event (when opponent leaves in 2-player game)
    this.room.onMessage('room_closed', (message) => {
      console.log('[NetworkManager] Room closed:', message.reason)
      this.lastRoomClosedReason = message.reason || 'unknown'
      this.emitRoomClosed(message.reason || 'unknown')
    })

    // Listen for room disconnect (when room is destroyed)
    // This is the main handler that triggers navigation back to menu
    // The onLeave in connect() just sets connected = false for early connection issues
    this.room.onLeave((code) => {
      console.log('[NetworkManager] Room disconnected, code:', code)
      this.connected = false
      // Trigger roomClosed callback to navigate back to menu
      // This happens when room is destroyed (opponent left in 2-player game)
      const reason = this.lastRoomClosedReason || (code === 4000 ? 'opponent_left' : 'disconnected')
      this.emitRoomClosed(reason)
      this.lastRoomClosedReason = null
    })
  }

  /**
   * Register event callbacks
   */
  on(event: 'stateChange', callback: (state: GameStateData) => void): void
  on(event: 'playerJoin', callback: (player: RemotePlayer) => void): void
  on(event: 'playerLeave', callback: (playerId: string) => void): void
  on(event: 'goalScored', callback: (team: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void): void
  on(event: 'matchStart', callback: (duration: number) => void): void
  on(event: 'matchEnd', callback: (winner: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void): void
  on(event: 'connectionError', callback: (error: string) => void): void
  on(event: 'playerReady', callback: (sessionId: string, team: 'blue' | 'red') => void): void
  on(event: 'roomClosed', callback: (reason: string) => void): void
  on(event: string, callback: any): void {
    switch (event) {
      case 'stateChange':
        this.onStateChange = callback
        break
      case 'playerJoin':
        this.onPlayerJoin = callback
        break
      case 'playerLeave':
        this.onPlayerLeave = callback
        break
      case 'goalScored':
        this.onGoalScored = callback
        break
      case 'matchStart':
        this.onMatchStart = callback
        break
      case 'matchEnd':
        this.onMatchEnd = callback
        break
      case 'connectionError':
        this.onConnectionError = callback
        break
      case 'playerReady':
        this.onPlayerReady = callback
        break
      case 'roomClosed':
        this.roomClosedListeners.push(callback)
        break
    }
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  private emitRoomClosed(reason: string) {
    if (!this.roomClosedListeners.length) return

    const listeners = [...this.roomClosedListeners]
    for (const listener of listeners) {
      try {
        listener(reason)
      } catch (error) {
        console.error('[NetworkManager] Error in roomClosed listener:', error)
      }
    }
  }

  /**
   * Get room instance (for advanced usage)
   */
  getRoom(): Room | undefined {
    return this.room
  }

  /**
   * Get current session ID (alias for getSessionId)
   */
  getMySessionId(): string {
    return this.sessionId
  }

  /**
   * Get current game state
   */
  getState(): any {
    return this.room?.state
  }

  /**
   * Check for existing players in the room and emit playerJoin events
   * Call this AFTER registering event callbacks to handle players who joined before connection
   */
  checkExistingPlayers(): void {
    if (!this.room || !this.room.state || !this.room.state.players) {
      return
    }

    this.room.state.players.forEach((player: any, key: string) => {
      if (key !== this.sessionId) {
        this.onPlayerJoin?.({
          id: player.id || key,
          team: player.team || 'blue',
          x: player.x || 0,
          y: player.y || 0,
          velocityX: player.velocityX || 0,
          velocityY: player.velocityY || 0,
          state: player.state || 'idle',
          direction: player.direction || 0,
        })
      }
    })
  }
}
