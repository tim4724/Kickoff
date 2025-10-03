import Colyseus from 'colyseus'
import { GameState } from '../schema/GameState'

const { Room } = Colyseus
type Client = Colyseus.Client

const GAME_CONFIG = {
  TICK_RATE: 60, // Increased from 30 for lower latency
  MATCH_DURATION: 120,
} as const

export class MatchRoom extends Room<GameState> {
  maxClients = 2 // Start with 2 humans only (will add AI later)
  private frameCount = 0 // DEBUG: Track update cycles

  onCreate(options: any) {
    console.log('Match room created:', this.roomId, options)

    this.setState(new GameState())

    // Start game loop at 30 Hz
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / GAME_CONFIG.TICK_RATE)

    // Handle player input
    this.onMessage('input', (client, message) => {
      this.onPlayerInput(client, message)
    })

    // Handle ping for latency measurement
    this.onMessage('ping', (client, message) => {
      // Echo back immediately
      client.send('pong', message)
    })

    console.log('✅ Match room initialized')
  }

  onJoin(client: Client, options: any) {
    console.log(`Player joined: ${client.sessionId}`)

    // Add player to game state
    this.state.addPlayer(client.sessionId)

    // Start match when 2 players join (proper multiplayer)
    if (this.state.players.size === 2) {
      this.startMatch()
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player left: ${client.sessionId} (consented: ${consented})`)

    // Remove player
    this.state.removePlayer(client.sessionId)

    // Return to waiting phase if only 1 player remains
    if (this.state.players.size === 1 && this.state.phase === 'playing') {
      console.log('Only 1 player remaining, returning to waiting phase')
      this.state.phase = 'waiting'
      this.state.matchTime = GAME_CONFIG.MATCH_DURATION // Reset timer
    }

    // End match if no players left
    if (this.state.players.size === 0) {
      console.log('No players left, disposing room')
      this.disconnect()
    }
  }

  private onPlayerInput(client: Client, input: any) {
    // DEBUG: Log all input messages received
    console.log(`📥 [MatchRoom] Input received from ${client.sessionId}:`, {
      movement: input.movement,
      action: input.action,
      timestamp: input.timestamp,
    })
    this.state.queueInput(client.sessionId, input)
  }

  private startMatch() {
    console.log('🎮 Match starting!')
    this.state.phase = 'playing'
    this.broadcast('match_start', { duration: GAME_CONFIG.MATCH_DURATION })
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000 // Convert to seconds

    // DEBUG: Log update cycle every 60 frames (2 seconds at 30Hz)
    this.frameCount++
    if (this.frameCount % 60 === 0) {
      console.log(`[MatchRoom] Update tick #${this.frameCount}, dt: ${dt.toFixed(3)}s, phase: ${this.state.phase}`)
    }

    if (this.state.phase === 'playing') {
      // Process queued inputs
      this.state.processInputs(dt)

      // Update physics
      this.state.updatePhysics(dt)

      // Update timer (countdown)
      this.state.updateTimer(dt)

      // Check for match end (timer reaches 0)
      if (this.state.matchTime <= 0) {
        this.endMatch()
      }
    }
  }

  private endMatch() {
    console.log('Match ended! Final score:', this.state.scoreBlue, '-', this.state.scoreRed)
    this.state.phase = 'ended'

    this.broadcast('match_end', {
      scoreBlue: this.state.scoreBlue,
      scoreRed: this.state.scoreRed,
      winner: this.state.scoreBlue > this.state.scoreRed ? 'blue' : 'red',
    })

    // Auto-close room after 10 seconds
    setTimeout(() => {
      this.disconnect()
    }, 10000)
  }

  onDispose() {
    console.log('Match room disposed:', this.roomId)
  }
}
