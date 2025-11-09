import Colyseus from 'colyseus'
import { GameState } from '../schema/GameState'
import { gameClock } from '@shared/engine/GameClock'

const { Room } = Colyseus
type Client = Colyseus.Client

const GAME_CONFIG = {
  TICK_RATE: 60, // Increased from 30 for lower latency
  MATCH_DURATION: 120,
} as const

// Fixed timestep physics configuration
const FIXED_TIMESTEP_MS = 1000 / 60 // 16.666ms - deterministic physics step
const FIXED_TIMESTEP_S = FIXED_TIMESTEP_MS / 1000 // 0.01666s
const MAX_PHYSICS_STEPS = 24 // Increased to handle high CPU contention during parallel tests (8 workers = 16 browser contexts)

export class MatchRoom extends Room<GameState> {
  maxClients = 2 // 2 human players (1v1 match)

  // Fixed timestep accumulator for deterministic physics
  private physicsAccumulator: number = 0

  // Time scale for test acceleration (default 1.0 = real-time)
  private timeScale: number = 1.0

  async onCreate(options: any) {
    console.log('🏗️  Match room created:', this.roomId, 'with options:', options)
    console.log('📋 Room metadata will be set to:', { roomName: options.roomName || 'match' })

    // Apply time scale from environment variable or options (for tests)
    const envTimeScale = process.env.TEST_TIME_SCALE
    const optionsTimeScale = options.timeScale

    if (optionsTimeScale) {
      this.timeScale = parseFloat(optionsTimeScale)
      console.log(`⏱️  Time scale set to ${this.timeScale}x (from room options)`)
    } else if (envTimeScale) {
      this.timeScale = parseFloat(envTimeScale)
      console.log(`⏱️  Time scale set to ${this.timeScale}x (from TEST_TIME_SCALE env)`)
    }

    // Set metadata BEFORE any logic for filterBy to work
    // filterBy checks metadata to match rooms, so this must be immediate
    const roomName = options.roomName || 'match'
    await this.setMetadata({ roomName })
    console.log('🏷️  Room name set:', roomName)

    const gameState = new GameState()
    this.setState(gameState)

    // Start game loop at 60 Hz
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / GAME_CONFIG.TICK_RATE)

    // Handle player inputs (multiple inputs per message)
    this.onMessage('inputs', (client, message) => {
      this.onPlayerInputs(client, message)
    })

    // Legacy support for single input (backwards compatibility)
    this.onMessage('input', (client, message) => {
      // Convert single input to multi-input format
      const multiInput = {
        inputs: { [message.playerId || client.sessionId]: message },
        timestamp: message.timestamp || gameClock.now(),
      }
      this.onPlayerInputs(client, multiInput)
    })

    // Handle ping for latency measurement
    this.onMessage('ping', (client, message) => {
      // Echo back immediately
      client.send('pong', message)
    })

    console.log('✅ Match room initialized')
  }

  async onJoin(client: Client, options: any) {
    console.log(`👋 Player joining: ${client.sessionId} (room: ${this.roomId}, clients: ${this.clients.length}/${this.maxClients})`)

    // Add player to game state (wait for completion to ensure atomic team assignment)
    const playerInfo = await this.state.addPlayer(client.sessionId)

    // Send player_ready message with sessionId and team
    // This signals to the client that initialization is complete
    client.send('player_ready', {
      sessionId: client.sessionId,
      team: playerInfo.team,
    })

    console.log(`🎮 Player ${client.sessionId} ready on ${playerInfo.team} team (${this.clients.length}/${this.maxClients} players)`)

    // Count human players and check team distribution
    let humanPlayerCount = 0
    let hasBlueTeam = false
    let hasRedTeam = false

    this.state.players.forEach((player) => {
      if (player.isHuman) {
        humanPlayerCount++
      }
      if (player.team === 'blue') hasBlueTeam = true
      if (player.team === 'red') hasRedTeam = true
    })

    // Start match when both teams exist (either 2 human players or 1 human + AI)
    if (hasBlueTeam && hasRedTeam) {
      const mode = humanPlayerCount === 2 ? 'multiplayer' : 'single-player with AI'
      console.log(`🎮 Starting ${mode} match (${humanPlayerCount} human players)`)
      this.startMatch()
    } else if (humanPlayerCount === 1) {
      // Wait for GameState to create AI opponents, then check again
      // Small delay to allow AI creation, then check if match should start
      setTimeout(() => {
        let hasBlue = false
        let hasRed = false
        this.state.players.forEach((player) => {
          if (player.team === 'blue') hasBlue = true
          if (player.team === 'red') hasRed = true
        })
        if (hasBlue && hasRed && this.state.phase === 'waiting') {
          this.startMatch()
        }
      }, 100)
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

  private onPlayerInputs(client: Client, message: any) {
    // message.inputs is an object with playerId -> input mapping
    if (!message.inputs || typeof message.inputs !== 'object') {
      return
    }

    // Process each player input
    const playerIds = Object.keys(message.inputs)
    playerIds.forEach((playerId) => {
      const input = message.inputs[playerId]
      if (input && input.playerId) {
        // Verify playerId matches (safety check)
        if (input.playerId !== playerId) {
          console.warn(`[MatchRoom] Input playerId mismatch: ${input.playerId} vs ${playerId}`)
        }
        this.state.queueInput(input.playerId, input)
      } else {
        console.warn(`[MatchRoom] Invalid input for player ${playerId}:`, input)
      }
    })

    // Debug: Log occasionally
    if (Math.random() < 0.05) { // 5% of the time
      console.log(`[MatchRoom] Received inputs from ${client.sessionId} for ${playerIds.length} players:`, playerIds)
    }
  }

  private startMatch() {
    // Call GameState's startMatch() which handles team creation and engine startup
    this.state.startMatch()

    // Reset physics accumulator for clean deterministic start
    this.physicsAccumulator = 0

    this.broadcast('match_start', { duration: GAME_CONFIG.MATCH_DURATION })
  }

  private update(deltaTime: number) {
    if (this.state.phase !== 'playing') return

    // Apply time scale for test acceleration (10x faster during tests)
    const scaledDeltaTime = deltaTime * this.timeScale

    // Accumulate scaled deltaTime for physics steps
    this.physicsAccumulator += scaledDeltaTime

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

    // Update timer with scaled deltaTime (accelerated during tests)
    const dt = scaledDeltaTime / 1000
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
