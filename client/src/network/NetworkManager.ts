import { Client, Room } from 'colyseus.js'

export interface NetworkConfig {
  serverUrl: string
  roomName: string
}

export interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
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

  // Input buffering
  private inputBuffer: PlayerInput[] = []
  private readonly MAX_BUFFER_SIZE = 10

  // Event callbacks
  private onStateChange?: (state: GameStateData) => void
  private onPlayerJoin?: (player: RemotePlayer) => void
  private onPlayerLeave?: (playerId: string) => void
  private onGoalScored?: (team: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onMatchStart?: (duration: number) => void
  private onMatchEnd?: (winner: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onConnectionError?: (error: string) => void

  constructor(config: NetworkConfig) {
    this.config = config
    this.client = new Client(config.serverUrl)
    console.log('[NetworkManager] Initialized with server:', config.serverUrl)
  }

  /**
   * Connect to the game server and join a match room
   */
  async connect(): Promise<boolean> {
    try {
      console.log('[NetworkManager] Connecting to match room:', this.config.roomName)

      this.room = await this.client.joinOrCreate(this.config.roomName)
      this.sessionId = this.room.sessionId
      this.connected = true

      console.log('[NetworkManager] Connected! Session ID:', this.sessionId)

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
    if (this.room) {
      console.log('[NetworkManager] Disconnecting...')
      this.room.leave()
      this.connected = false
      this.room = undefined
    }
  }

  /**
   * Send player input to the server
   * Inputs are buffered to reduce network traffic
   */
  sendInput(movement: { x: number; y: number }, action: boolean): void {
    if (!this.connected || !this.room) {
      return
    }

    const input: PlayerInput = {
      movement,
      action,
      timestamp: Date.now(),
    }

    // Add to buffer
    this.inputBuffer.push(input)

    // Send if buffer is full or action is pressed
    if (this.inputBuffer.length >= this.MAX_BUFFER_SIZE || action) {
      this.flushInputBuffer()
    }
  }

  /**
   * Flush input buffer to server
   */
  private flushInputBuffer(): void {
    if (!this.room || this.inputBuffer.length === 0) {
      return
    }

    // Send the latest input (most recent state)
    const latestInput = this.inputBuffer[this.inputBuffer.length - 1]
    this.room.send('input', latestInput)

    // Clear buffer
    this.inputBuffer = []
  }

  /**
   * Set up listeners for server state changes
   */
  private setupStateListeners(): void {
    if (!this.room) return

    // Listen for state changes
    this.room.onStateChange((state) => {
      const gameState: GameStateData = {
        matchTime: state.matchTime,
        scoreBlue: state.scoreBlue,
        scoreRed: state.scoreRed,
        phase: state.phase,
        players: new Map(),
        ball: {
          x: state.ball.x,
          y: state.ball.y,
          velocityX: state.ball.velocityX,
          velocityY: state.ball.velocityY,
          possessedBy: state.ball.possessedBy,
        },
      }

      // Convert players
      state.players.forEach((player: any, key: string) => {
        gameState.players.set(key, {
          id: player.id,
          team: player.team,
          x: player.x,
          y: player.y,
          velocityX: player.velocityX,
          velocityY: player.velocityY,
          state: player.state,
          direction: player.direction,
        })
      })

      this.onStateChange?.(gameState)
    })

    // Listen for players joining
    this.room.state.players.onAdd((player: any, key: string) => {
      console.log('[NetworkManager] Player joined:', key)
      this.onPlayerJoin?.({
        id: player.id,
        team: player.team,
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        state: player.state,
        direction: player.direction,
      })
    })

    // Listen for players leaving
    this.room.state.players.onRemove((player: any, key: string) => {
      console.log('[NetworkManager] Player left:', key)
      this.onPlayerLeave?.(key)
    })
  }

  /**
   * Set up listeners for server messages
   */
  private setupMessageListeners(): void {
    if (!this.room) return

    // Match start event
    this.room.onMessage('match_start', (message) => {
      console.log('[NetworkManager] Match starting!', message)
      this.onMatchStart?.(message.duration)
    })

    // Match end event
    this.room.onMessage('match_end', (message) => {
      console.log('[NetworkManager] Match ended!', message)
      this.onMatchEnd?.(message.winner, message.scoreBlue, message.scoreRed)
    })

    // Goal scored event (optional - can also track via state changes)
    this.room.onMessage('goal_scored', (message) => {
      console.log('[NetworkManager] Goal scored!', message)
      this.onGoalScored?.(message.team, message.scoreBlue, message.scoreRed)
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

  /**
   * Get room instance (for advanced usage)
   */
  getRoom(): Room | undefined {
    return this.room
  }
}
