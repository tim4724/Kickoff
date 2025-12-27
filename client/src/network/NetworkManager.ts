import { Client, Room } from 'colyseus.js'
import { gameClock } from '@shared/engine/GameClock'
import type { MapSchema } from '@colyseus/schema'
import type { Team, PlayerState, GamePhase } from '@shared/types'

export interface NetworkConfig {
  serverUrl: string
  roomName: string
}

// Colyseus schema types for the client
/**
 * Client-side representation of Colyseus Player schema
 * Mirrors the schema defined in server/src/schema/GameState.ts
 *
 * This interface represents a player entity as synchronized from the server
 * via Colyseus WebSocket state synchronization.
 */
interface ColyseusPlayer {
  id: string
  team: Team
  isHuman: boolean
  isControlled: boolean
  x: number
  y: number
  velocityX: number
  velocityY: number
  state: PlayerState
  direction: number
}

/**
 * Client-side representation of Colyseus Ball schema
 * Mirrors the schema defined in server/src/schema/GameState.ts
 *
 * This interface represents the ball entity as synchronized from the server
 * via Colyseus WebSocket state synchronization.
 */
interface ColyseusBall {
  x: number
  y: number
  velocityX: number
  velocityY: number
  possessedBy: string
  pressureLevel: number
}

/**
 * Extended MapSchema to include runtime methods added by Colyseus
 *
 * Colyseus adds these callback methods at runtime to MapSchema instances
 * for tracking changes to collections. These methods may not be present
 * immediately after connection, so they're marked as optional.
 *
 * Always check for their existence before use:
 * ```typescript
 * if (players && typeof players.onAdd === 'function') {
 *   players.onAdd((player, key) => { ... })
 * }
 * ```
 */
interface ColyseusMapSchema<V> extends MapSchema<V> {
  onAdd?: (callback: (value: V, key: string) => void) => void
  onRemove?: (callback: (value: V, key: string) => void) => void
  onChange?: (callback: (value: V, key: string) => void) => void
}

/**
 * Client-side representation of Colyseus GameState schema
 * Mirrors the schema defined in server/src/schema/GameState.ts
 *
 * This interface represents the complete game state as synchronized from
 * the server via Colyseus WebSocket state synchronization. It's received
 * through `room.state` and `room.onStateChange()` callbacks.
 */
interface ColyseusGameState {
  matchTime: number
  scoreBlue: number
  scoreRed: number
  phase: GamePhase
  players: ColyseusMapSchema<ColyseusPlayer>
  ball: ColyseusBall
}

export interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  timestamp: number
  playerId: string
}

// Extended input with isHuman flag for internal buffering
interface BufferedPlayerInput extends PlayerInput {
  isHuman: boolean
}

// Network message format for sending multiple player inputs to server
// Uses plain object (not Map) for JSON serialization over WebSocket
export interface MultiPlayerInput {
  inputs: { [key: string]: PlayerInput }
  timestamp: number
}

// Room join/create options
interface JoinRoomOptions {
  roomName: string
  timeScale?: string
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
    pressureLevel: number
  }
}

export class NetworkManager {
  private static instance: NetworkManager
  private client: Client
  private room?: Room
  private config: NetworkConfig

  private connected: boolean = false
  private sessionId: string = ''
  private lastRoomClosedReason: string | null = null
  private roomClosedListeners: Array<(reason: string) => void> = []
  public roomName: string = 'Unknown'

  private inputBuffer: Map<string, BufferedPlayerInput> = new Map()

  private onStateChange?: (state: GameStateData) => void
  private onPlayerJoin?: (player: RemotePlayer) => void
  private onPlayerLeave?: (playerId: string) => void
  private onGoalScored?: (team: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onMatchStart?: (duration: number) => void
  private onMatchEnd?: (winner: 'blue' | 'red', scoreBlue: number, scoreRed: number) => void
  private onConnectionError?: (error: string) => void
  private onPlayerReady?: (sessionId: string, team: 'blue' | 'red', roomName?: string) => void

  constructor(config: NetworkConfig) {
    this.config = config
    this.client = new Client(config.serverUrl)

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.disconnect()
      })
    }
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      const resolveServerUrl = (): string => {
        const pageIsHttps = window.location.protocol === 'https:'
        const normalizeToWs = (url: string): string => {
          if (url.startsWith('http://')) return url.replace('http://', 'ws://')
          if (url.startsWith('https://')) return url.replace('https://', 'wss://')
          if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`
          return url
        }

        const winUrl = window.__SERVER_URL__
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

      NetworkManager.instance = new NetworkManager({
        serverUrl,
        roomName: 'match',
      })
    }
    return NetworkManager.instance
  }

  async getRooms(): Promise<any[]> {
    const httpUrl = this.config.serverUrl.replace(/^ws/, 'http')
    try {
        const response = await fetch(`${httpUrl}/api/rooms`)
        if (!response.ok) throw new Error(`Failed to fetch rooms: ${response.statusText}`)
        return await response.json()
    } catch (error) {
        console.error('[NetworkManager] Error fetching rooms:', error)
        throw error
    }
  }

  async joinById(roomId: string): Promise<boolean> {
      return this.internalConnect(async () => {
          return await this.client.joinById(roomId)
      })
  }

  async joinRoom(options: any): Promise<boolean> {
      return this.internalConnect(async () => {
          return await this.client.joinOrCreate(this.config.roomName, options)
      })
  }

  private async internalConnect(joinAction: () => Promise<Room>): Promise<boolean> {
    try {
      if (this.room) {
          this.room.leave()
      }

      this.room = await joinAction()
      this.sessionId = this.room.sessionId
      this.connected = true

      // Update config roomName if changed? Not really needed.

      this.room.onError((code, message) => {
        console.error('[NetworkManager] Room error:', code, message)
        this.onConnectionError?.(`Room error: ${message}`)
      })

      this.room.onLeave(() => {
        this.connected = false
      })

      this.setupStateListeners()
      this.setupMessageListeners()

      return true
    } catch (error) {
      console.error('[NetworkManager] Connection failed:', error)
      this.onConnectionError?.((error as Error).message)
      throw error // Re-throw for caller to handle
    }
  }

  private getRoomIdFromHash(): string | null {
    if (window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1]
      const hashParams = new URLSearchParams(hashQuery)
      return hashParams.get('id') // Changed from roomId to id for deep link ID
    }
    return null
  }

  private getRoomName(): string {
    // 1. Check URL query params (legacy/test isolation)
    const urlParams = new URLSearchParams(window.location.search)
    const urlRoomId = urlParams.get('roomId')
    if (urlRoomId) return urlRoomId

    // 2. Check Hash query params (legacy/test isolation)
    if (window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1]
        const hashParams = new URLSearchParams(hashQuery)
        const hashRoomId = hashParams.get('roomId')
        if (hashRoomId) return hashRoomId
    }

    // 3. Check Test ID
    const testRoomId = window.__testRoomId
    if (testRoomId) return testRoomId

    return this.config.roomName
  }

  async connect(): Promise<boolean> {
      if (this.connected && this.room) {
          console.log('[NetworkManager] Already connected to room:', this.room.roomId)
          return true
      }

    try {
      // Priority 1: Join by ID (Deep Link)
      const joinId = this.getRoomIdFromHash()
      if (joinId) {
        console.log('[NetworkManager] Attempting to join by ID:', joinId)
        try {
          return await this.internalConnect(() => this.client.joinById(joinId))
        } catch (error) {
          console.warn('[NetworkManager] Failed to join by ID, not falling back to create:', error)
          return false // Stop here, do not create a new room
        }
      }

      // Priority 2: Join or Create by Name (Lobby / Test)
      const roomName = this.getRoomName()
      const options: JoinRoomOptions = { roomName }

      const testTimeScale = window.__testTimeScale
      if (testTimeScale) {
        options.timeScale = testTimeScale
      }

      return await this.internalConnect(() => this.client.joinOrCreate('match', options))
    } catch (error) {
      return false
    }
  }

  disconnect(): void {
    if (this.room) {
      try {
        if (this.connected) {
          this.room.leave()
        }
      } catch (e) {
        console.warn('[NetworkManager] Error during room.leave():', e)
      }
      this.connected = false
      this.room = undefined
    }
    
    this.inputBuffer.clear()
    
    this.onStateChange = undefined
    this.onPlayerJoin = undefined
    this.onPlayerLeave = undefined
    this.onGoalScored = undefined
    this.onMatchStart = undefined
    this.onMatchEnd = undefined
    this.onConnectionError = undefined
    this.onPlayerReady = undefined
    this.roomClosedListeners = []
  }

  sendInput(movement: { x: number; y: number }, action: boolean, playerId: string, isHuman: boolean = false): void {
    if (!this.connected || !this.room) return

    const input: BufferedPlayerInput = {
      movement,
      action,
      timestamp: gameClock.now(),
      playerId,
      isHuman,
    }

    const existingInput = this.inputBuffer.get(playerId)
    if (existingInput) {
      if (existingInput.isHuman && !isHuman) return

      if (action) {
        input.movement = existingInput.movement
      } else if (existingInput.action) {
        input.action = existingInput.action
      }
    }

    this.inputBuffer.set(playerId, input)

    if (isHuman && !action && (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01)) {
      this.flushInputBuffer()
    }
  }

  flushInputs(): void {
    if (!this.room || this.inputBuffer.size === 0) return
    this.flushInputBuffer()
  }

  private flushInputBuffer(): void {
    if (!this.connected || !this.room || this.inputBuffer.size === 0) return

    const inputsMap: { [key: string]: PlayerInput } = {}
    this.inputBuffer.forEach((input, playerId) => {
      // Remove isHuman flag before sending to server (it's for local buffering only)
      const { isHuman, ...playerInput } = input
      inputsMap[playerId] = playerInput
    })

    const multiInput: MultiPlayerInput = {
      inputs: inputsMap,
      timestamp: gameClock.now(),
    }

    this.room.send('inputs', multiInput)
    this.inputBuffer.clear()
  }

  private setupStateListeners(): void {
    if (!this.room) return

    let playersHooksRegistered = false
    const tryHookPlayers = (state?: ColyseusGameState) => {
      if (playersHooksRegistered || !state) return
      const players = state.players
      if (players && typeof players.onAdd === 'function' && typeof players.onRemove === 'function') {
        playersHooksRegistered = true

        players.onAdd((player: ColyseusPlayer, key: string) => {
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
        })

        players.onRemove((_player: ColyseusPlayer, key: string) => {
          this.onPlayerLeave?.(key)
        })
      }
    }

    if (this.room.state) {
      tryHookPlayers(this.room.state as ColyseusGameState)
    }

    this.room.onStateChange((state: ColyseusGameState) => {
      tryHookPlayers(state)
      if (!state || !state.ball || !state.players) return

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

      state.players.forEach((player: ColyseusPlayer, key: string) => {
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

      this.onStateChange?.(gameState)
    })
  }

  private setupMessageListeners(): void {
    if (!this.room) return

    this.room.onMessage('player_ready', (message) => {
      this.sessionId = message.sessionId
      this.roomName = message.roomName || 'Unknown'
      this.onPlayerReady?.(message.sessionId, message.team, message.roomName)
    })

    this.room.onMessage('match_start', (message) => {
      this.onMatchStart?.(message.duration)
    })

    this.room.onMessage('match_end', (message) => {
      this.onMatchEnd?.(message.winner, message.scoreBlue, message.scoreRed)
    })

    this.room.onMessage('goal_scored', (message) => {
      this.onGoalScored?.(message.team, message.scoreBlue, message.scoreRed)
    })

    this.room.onMessage('room_closed', (message) => {
      this.lastRoomClosedReason = message.reason || 'unknown'
      this.emitRoomClosed(message.reason || 'unknown')
    })

    this.room.onLeave((code) => {
      this.connected = false
      const reason = this.lastRoomClosedReason || (code === 4000 ? 'opponent_left' : 'disconnected')
      this.emitRoomClosed(reason)
      this.lastRoomClosedReason = null
    })
  }

  on(event: string, callback: any): void {
    switch (event) {
      case 'stateChange': this.onStateChange = callback; break
      case 'playerJoin': this.onPlayerJoin = callback; break
      case 'playerLeave': this.onPlayerLeave = callback; break
      case 'goalScored': this.onGoalScored = callback; break
      case 'matchStart': this.onMatchStart = callback; break
      case 'matchEnd': this.onMatchEnd = callback; break
      case 'connectionError': this.onConnectionError = callback; break
      case 'playerReady': this.onPlayerReady = callback; break
      case 'roomClosed': this.roomClosedListeners.push(callback); break
    }
  }

  isConnected(): boolean { return this.connected }
  getSessionId(): string { return this.sessionId }
  getRoom(): Room | undefined { return this.room }
  getMySessionId(): string { return this.sessionId }
  getState(): any { return this.room?.state }

  private emitRoomClosed(reason: string) {
    const listeners = [...this.roomClosedListeners]
    for (const listener of listeners) {
      try { listener(reason) } catch (error) { console.error(error) }
    }
  }

  checkExistingPlayers(): void {
    if (!this.room || !this.room.state || !this.room.state.players) return
    const state = this.room.state as ColyseusGameState
    state.players.forEach((player: ColyseusPlayer, key: string) => {
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
