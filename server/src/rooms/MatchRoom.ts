import Colyseus from 'colyseus'
import { GameState } from '../schema/GameState'

const { Room } = Colyseus
type Client = Colyseus.Client

const GAME_CONFIG = {
  TICK_RATE: 60, // Increased from 30 for lower latency
  MATCH_DURATION: 120,
} as const

// Fixed timestep physics configuration
const FIXED_TIMESTEP_MS = 1000 / 60 // 16.666ms - deterministic physics step
const FIXED_TIMESTEP_S = FIXED_TIMESTEP_MS / 1000 // 0.01666s
const MAX_PHYSICS_STEPS = 5 // Prevent spiral of death under extreme load

export class MatchRoom extends Room<GameState> {
  maxClients = 2 // Start with 2 humans only (will add AI later)
  private singlePlayerStartTimeout?: NodeJS.Timeout

  // Fixed timestep accumulator for deterministic physics
  private physicsAccumulator: number = 0

  onCreate(options: any) {
    console.log('Match room created:', this.roomId, options)

    // Store room name in metadata for filtering (test isolation)
    if (options.roomName) {
      this.setMetadata({ roomName: options.roomName })
      console.log('🏷️  Room name set:', options.roomName)
    }

    this.setState(new GameState())

    // Start game loop at 60 Hz
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

    // Clear any pending single-player start timeout
    if (this.singlePlayerStartTimeout) {
      clearTimeout(this.singlePlayerStartTimeout)
      this.singlePlayerStartTimeout = undefined
    }

    // Start match when 2 players join (proper multiplayer)
    if (this.state.players.size === 2) {
      this.startMatch()
    } else if (this.state.players.size === 1) {
      // Enable single-player mode: start match after 2 seconds if no second player joins
      console.log('⏱️ Single player detected, starting match in 2 seconds...')
      this.singlePlayerStartTimeout = setTimeout(() => {
        if (this.state.players.size === 1 && this.state.phase === 'waiting') {
          console.log('🎮 Starting single-player match')
          this.startMatch()
        }
      }, 2000)
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
    // Input logging disabled for performance (60+ calls/sec per player)
    this.state.queueInput(client.sessionId, input)
  }

  private startMatch() {
    console.log('🎮 Match starting!')
    this.state.phase = 'playing'

    // Reset physics accumulator for clean deterministic start
    this.physicsAccumulator = 0

    this.broadcast('match_start', { duration: GAME_CONFIG.MATCH_DURATION })
  }

  private update(deltaTime: number) {
    if (this.state.phase !== 'playing') return

    // Accumulate real deltaTime for physics steps
    this.physicsAccumulator += deltaTime

    // Run physics in fixed timesteps for deterministic simulation
    let physicsSteps = 0
    while (this.physicsAccumulator >= FIXED_TIMESTEP_MS && physicsSteps < MAX_PHYSICS_STEPS) {
      // Process inputs with fixed timestep
      this.state.processInputs(FIXED_TIMESTEP_S)

      // Update physics with fixed timestep (always 1/60s = 0.01666s)
      this.state.updatePhysics(FIXED_TIMESTEP_S)

      this.physicsAccumulator -= FIXED_TIMESTEP_MS
      physicsSteps++
    }

    // Prevent spiral of death: if we hit max steps, discard remainder
    if (physicsSteps >= MAX_PHYSICS_STEPS) {
      console.warn(`⚠️ Physics running behind: ${physicsSteps} steps, discarding ${this.physicsAccumulator.toFixed(1)}ms`)
      this.physicsAccumulator = 0
    }

    // Update timer with actual deltaTime (smooth countdown, independent of physics)
    const dt = deltaTime / 1000
    this.state.updateTimer(dt)

    // Check for match end (timer reaches 0)
    if (this.state.matchTime <= 0) {
      this.endMatch()
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

    // Clear any pending single-player start timeout
    if (this.singlePlayerStartTimeout) {
      clearTimeout(this.singlePlayerStartTimeout)
      this.singlePlayerStartTimeout = undefined
    }
  }
}
