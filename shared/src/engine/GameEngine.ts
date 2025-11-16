/**
 * Game Engine
 * Complete game loop orchestrator - physics and state management
 * Shared between client single-player and server multiplayer
 */

import { PhysicsEngine } from './PhysicsEngine.js'
import { gameClock } from './GameClock.js'
import type {
  EnginePlayerData,
  EngineBallData,
  GameEngineState,
  EnginePlayerInput,
  PhysicsConfig,
  GoalEvent,
} from './types.js'
import type { Team, GamePhase } from '../types.js'
import { GAME_CONFIG } from '../types.js'

export interface GameEngineConfig {
  matchDuration: number // seconds
}

export class GameEngine {
  private physics: PhysicsEngine
  private state: GameEngineState
  private config: GameEngineConfig
  private goalScored: boolean = false
  private inputQueues: Map<string, EnginePlayerInput[]> = new Map()

  // Fixed timestep configuration
  private readonly FIXED_TIMESTEP_MS = 1000 / 60
  private readonly FIXED_TIMESTEP_S = this.FIXED_TIMESTEP_MS / 1000
  private physicsAccumulator: number = 0

  // Frame counter (deterministic, increments on each physics step)
  public frameCount: number = 0

  // Event callbacks
  private onGoalCallback?: (event: GoalEvent) => void
  private onMatchEndCallback?: () => void
  private onShootCallback?: (playerId: string, power: number) => void

  // Goal reset timer
  private goalResetTimerId?: number

  constructor(config: GameEngineConfig) {
    this.config = config

    // Initialize physics engine
    const physicsConfig: PhysicsConfig = {
      fieldWidth: GAME_CONFIG.FIELD_WIDTH,
      fieldHeight: GAME_CONFIG.FIELD_HEIGHT,
      fieldMargin: GAME_CONFIG.FIELD_MARGIN,
      playerMargin: GAME_CONFIG.PLAYER_MARGIN,
      playerSpeed: GAME_CONFIG.PLAYER_SPEED,
      ballRadius: GAME_CONFIG.BALL_RADIUS,
      ballFriction: GAME_CONFIG.BALL_FRICTION,
      shootSpeed: GAME_CONFIG.SHOOT_SPEED,
      minShootSpeed: GAME_CONFIG.MIN_SHOOT_SPEED,
      possessionRadius: GAME_CONFIG.POSSESSION_RADIUS,
      pressureRadius: GAME_CONFIG.PRESSURE_RADIUS,
      pressureBuildup: GAME_CONFIG.PRESSURE_BUILDUP_RATE,
      pressureDecay: GAME_CONFIG.PRESSURE_DECAY_RATE,
      pressureThreshold: GAME_CONFIG.PRESSURE_RELEASE_THRESHOLD,
      captureLockoutMs: GAME_CONFIG.CAPTURE_LOCKOUT_MS,
      lossLockoutMs: GAME_CONFIG.LOSS_LOCKOUT_MS,
      goalYMin: GAME_CONFIG.GOAL_Y_MIN,
      goalYMax: GAME_CONFIG.GOAL_Y_MAX,
    }
    this.physics = new PhysicsEngine(physicsConfig)

    // Initialize state
    this.state = {
      players: new Map(),
      ball: {
        x: GAME_CONFIG.FIELD_WIDTH / 2,
        y: GAME_CONFIG.FIELD_HEIGHT / 2,
        velocityX: 0,
        velocityY: 0,
        possessedBy: '',
        pressureLevel: 0,
        lastShotTime: 0,
        lastShooter: '',
        inGoal: false,
      },
      scoreBlue: 0,
      scoreRed: 0,
      matchTime: config.matchDuration,
      phase: 'waiting',
    }
  }

  /**
   * Add a player to the game (always creates 3 players per team for 3v3)
   * All players are named uniformly: ${sessionId}-p1, ${sessionId}-p2, ${sessionId}-p3
   */
  addPlayer(sessionId: string, team: Team, isHuman: boolean = true): void {
    const p1Id = `${sessionId}-p1`
    const p2Id = `${sessionId}-p2`
    const p3Id = `${sessionId}-p3`

    if (this.state.players.has(p1Id)) {
      console.warn(`Player ${p1Id} already exists`)
      return
    }

    // Always create 3 players per team (3v3 format)
    if (team === 'blue') {
        const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.36)
        const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.19)

        const player1: EnginePlayerData = {
          id: p1Id,
          team,
          isHuman: isHuman,
          isControlled: isHuman,
          x: forwardX,
          y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5),
          velocityX: 0,
          velocityY: 0,
          state: 'idle',
          direction: 0,
          role: 'forward',
        }

        const player2: EnginePlayerData = {
          id: p2Id,
          team,
          isHuman: false,
          isControlled: false,
          x: defenderX,
          y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25),
          velocityX: 0,
          velocityY: 0,
          state: 'idle',
          direction: 0,
          role: 'defender',
        }

        const player3: EnginePlayerData = {
          id: p3Id,
          team,
          isHuman: false,
          isControlled: false,
          x: defenderX,
          y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75),
          velocityX: 0,
          velocityY: 0,
          state: 'idle',
          direction: 0,
          role: 'defender',
        }

      this.state.players.set(p1Id, player1)
      this.state.players.set(p2Id, player2)
      this.state.players.set(p3Id, player3)
    } else {
      // Red team
      const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.64)
      const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.81)

      const player1: EnginePlayerData = {
        id: p1Id,
        team,
        isHuman: isHuman,
        isControlled: isHuman,
        x: forwardX,
        y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5),
        velocityX: 0,
        velocityY: 0,
        state: 'idle',
        direction: 0,
        role: 'forward',
      }

      const player2: EnginePlayerData = {
        id: p2Id,
        team,
        isHuman: false,
        isControlled: false,
        x: defenderX,
        y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75),
        velocityX: 0,
        velocityY: 0,
        state: 'idle',
        direction: 0,
        role: 'defender',
      }

      const player3: EnginePlayerData = {
        id: p3Id,
        team,
        isHuman: false,
        isControlled: false,
        x: defenderX,
        y: Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25),
        velocityX: 0,
        velocityY: 0,
        state: 'idle',
        direction: 0,
        role: 'defender',
      }

      this.state.players.set(p1Id, player1)
      this.state.players.set(p2Id, player2)
      this.state.players.set(p3Id, player3)
    }
  }

  /**
   * Remove a player from the game
   */
  removePlayer(sessionId: string): void {
    const p1Id = `${sessionId}-p1`
    const p2Id = `${sessionId}-p2`
    const p3Id = `${sessionId}-p3`

    // Release ball if player had it
    if (
      this.state.ball.possessedBy === p1Id ||
      this.state.ball.possessedBy === p2Id ||
      this.state.ball.possessedBy === p3Id
    ) {
      this.state.ball.possessedBy = ''
    }

    this.state.players.delete(p1Id)
    this.state.players.delete(p2Id)
    this.state.players.delete(p3Id)
  }

  /**
   * Queue player input
   */
  queueInput(playerId: string, input: EnginePlayerInput): void {
    if (!this.inputQueues.has(playerId)) {
      this.inputQueues.set(playerId, [])
    }
    this.inputQueues.get(playerId)!.push(input)
  }

  /**
   * Update which player is being controlled by a human (for teammate switching)
   */
  setPlayerControl(sessionId: string, controlledPlayerId: string): void {
    // Get the team from either the session player or the controlled player
    const sessionPlayer = this.state.players.get(sessionId)
    const controlledPlayer = this.state.players.get(controlledPlayerId)

    if (!controlledPlayer) {
      console.warn(`Cannot set control: player ${controlledPlayerId} not found`)
      return
    }

    const team = controlledPlayer.team

    // Update isControlled flags for all teammates
    this.state.players.forEach((player) => {
      if (player.team === team) {
        player.isControlled = (player.id === controlledPlayerId)
      }
    })
  }

  /**
   * Process all queued inputs
   * IMPORTANT: Processes ALL players, even without queued inputs, so velocity can decay properly
   */
  private processInputs(dt: number): void {
    this.state.players.forEach((player) => {
      const queue = this.inputQueues.get(player.id)
      
      // Merge all queued inputs: use latest movement, but preserve any action
      const mergedInput: EnginePlayerInput = {
        movement: { x: 0, y: 0 },
        action: false,
        actionPower: 0,
        timestamp: this.frameCount,
      }

      if (queue && queue.length > 0) {
        // Use latest movement
        const latestInput = queue[queue.length - 1]
        mergedInput.movement = latestInput.movement
        mergedInput.timestamp = latestInput.timestamp

        // Check if ANY queued input has action=true
        for (const input of queue) {
          if (input.action) {
            mergedInput.action = true
            mergedInput.actionPower = input.actionPower
            break // First action wins
          }
        }

        this.inputQueues.set(player.id, [])
      }
      // If no queued input, mergedInput defaults to {x: 0, y: 0} which allows velocity to decay

      // Update player (always process, even with zero input, so velocity decays)
      this.physics.processPlayerInput(player, mergedInput, dt)

      // Handle action
      if (mergedInput.action) {
        this.physics.handlePlayerAction(
          player,
          this.state.ball,
          mergedInput.actionPower,
          this.onShootCallback
        )
      }
    })
  }

  /**
   * Main update loop (called at variable framerate, uses fixed timestep internally)
   */
  update(deltaTime: number): void {
    if (this.state.phase !== 'playing') return

    // Pause physics during goal reset
    if (this.goalScored) {
      // Still update timer during pause
      const dt = deltaTime / 1000
      this.state.matchTime -= dt
      if (this.state.matchTime <= 0) {
        this.state.matchTime = 0
        this.handleMatchEnd()
      }
      return
    }

    // Accumulate time for physics
    this.physicsAccumulator += deltaTime

    const MAX_PHYSICS_STEPS = 5
    let physicsSteps = 0

    // Run physics in fixed timesteps
    while (
      this.physicsAccumulator >= this.FIXED_TIMESTEP_MS &&
      physicsSteps < MAX_PHYSICS_STEPS
    ) {
      // Process all inputs
      this.processInputs(this.FIXED_TIMESTEP_S)

      // Update possession pressure
      this.physics.updatePossessionPressure(
        this.state.ball,
        this.state.players,
        this.FIXED_TIMESTEP_S
      )

      // Update ball possession
      this.physics.updateBallPossession(this.state.ball, this.state.players)

      // Update ball physics
      this.physics.updateBallPhysics(this.state.ball, this.FIXED_TIMESTEP_S)

      // Check for goals
      const scoringTeam = this.physics.checkGoals(this.state.ball)
      if (scoringTeam && !this.goalScored) {
        this.handleGoal(scoringTeam)
      }

      this.physicsAccumulator -= this.FIXED_TIMESTEP_MS
      physicsSteps++

      // Increment frame counter (deterministic!)
      this.frameCount++
    }

    // Prevent spiral of death
    if (physicsSteps >= MAX_PHYSICS_STEPS) {
      this.physicsAccumulator = 0
    }

    // Update timer (smooth countdown, independent of physics)
    const dt = deltaTime / 1000
    this.state.matchTime -= dt
    if (this.state.matchTime <= 0) {
      this.state.matchTime = 0
      this.handleMatchEnd()
    }
  }

  /**
   * Start the match
   */
  startMatch(): void {
    this.state.phase = 'playing'
    this.physicsAccumulator = 0
    this.frameCount = 0
  }

  /**
   * Handle goal scored
   */
  private handleGoal(team: Team): void {
    this.goalScored = true

    if (team === 'blue') {
      this.state.scoreBlue++
    } else {
      this.state.scoreRed++
    }

    // Reset players and ball immediately
    this.physics.resetPlayers(
      this.state.players,
      GAME_CONFIG.FIELD_WIDTH,
      GAME_CONFIG.FIELD_HEIGHT
    )
    this.physics.resetBall(
      this.state.ball,
      GAME_CONFIG.FIELD_WIDTH,
      GAME_CONFIG.FIELD_HEIGHT
    )

    // Emit goal event
    if (this.onGoalCallback) {
      this.onGoalCallback({ team, time: this.state.matchTime })
    }

    // Cancel any pending goal reset
    if (this.goalResetTimerId !== undefined) {
      gameClock.clearTimeout(this.goalResetTimerId)
    }

    // Pause for 2 seconds before resuming play
    this.goalResetTimerId = gameClock.setTimeout(() => {
      this.goalScored = false
      this.goalResetTimerId = undefined
    }, 2000)
  }

  /**
   * Handle match end
   */
  private handleMatchEnd(): void {
    this.state.phase = 'ended'

    if (this.onMatchEndCallback) {
      this.onMatchEndCallback()
    }
  }

  /**
   * Get current game state (read-only)
   */
  getState(): GameEngineState {
    return this.state
  }

  /**
   * Set goal callback
   */
  onGoal(callback: (event: GoalEvent) => void): void {
    this.onGoalCallback = callback
  }

  /**
   * Set match end callback
   */
  onMatchEnd(callback: () => void): void {
    this.onMatchEndCallback = callback
  }

  /**
   * Set shoot callback
   */
  onShoot(callback: (playerId: string, power: number) => void): void {
    this.onShootCallback = callback
  }
}
