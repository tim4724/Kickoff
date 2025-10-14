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
  maxClients = 2 // 2 human players (1v1 match)

  // Fixed timestep accumulator for deterministic physics
  private physicsAccumulator: number = 0

  async onCreate(options: any) {
    console.log('Match room created:', this.roomId, options)

    // Set metadata BEFORE any logic for filterBy to work
    // filterBy checks metadata to match rooms, so this must be immediate
    const roomName = options.roomName || 'match'
    await this.setMetadata({ roomName })
    console.log('🏷️  Room name set:', roomName)

    const gameState = new GameState()
    this.setState(gameState)

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

  async onJoin(client: Client, options: any) {
    console.log(`Player joined: ${client.sessionId}`)

    // Add player to game state (wait for completion to ensure atomic team assignment)
    const playerInfo = await this.state.addPlayer(client.sessionId)

    // Send player_ready message with sessionId and team
    // This signals to the client that initialization is complete
    client.send('player_ready', {
      sessionId: client.sessionId,
      team: playerInfo.team,
    })

    console.log(`🎮 Player ${client.sessionId} ready on ${playerInfo.team} team`)

    // Count human players (non-AI)
    let humanPlayerCount = 0
    this.state.players.forEach((player) => {
      if (player.isHuman) {
        humanPlayerCount++
      }
    })

    // Start match when 2 human players join (proper multiplayer)
    if (humanPlayerCount === 2) {
      console.log('🎮 Two players connected, starting multiplayer match!')
      this.startMatch()
    } else if (humanPlayerCount === 1) {
      // Wait indefinitely for second player - no timeout
      console.log('⏱️ Waiting for second player to join...')
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
    // Use input.playerId if provided (for teammate switching), otherwise use client.sessionId
    const targetPlayerId = input.playerId || client.sessionId
    this.state.queueInput(targetPlayerId, input)
  }

  private startMatch() {
    console.log('🎮 Match starting!')

    // Call GameState's startMatch() which handles team creation and engine startup
    this.state.startMatch()

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
  }
}
