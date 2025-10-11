import { Schema, type, MapSchema } from '@colyseus/schema'
import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared/engine/GameEngine'
import type { GameEngineState, EnginePlayerData } from '@shared/engine/types'

// Shared types
type Team = 'blue' | 'red'
type PlayerState = 'idle' | 'running' | 'kicking'
type GamePhase = 'waiting' | 'playing' | 'ended'

interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number // 0.0-1.0, power for shooting (optional, defaults to 0.8)
  timestamp: number
  playerId?: string // Player ID to control (for AI teammate switching)
}

export class Player extends Schema {
  @type('string') id: string = ''
  @type('string') team: Team = 'blue'
  @type('boolean') isHuman: boolean = true
  @type('boolean') isControlled: boolean = false

  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('number') velocityX: number = 0
  @type('number') velocityY: number = 0

  @type('string') state: PlayerState = 'idle'
  @type('number') direction: number = 0

  // AI-specific fields (not synced)
  role?: 'defender' | 'forward'

  constructor(id: string, team: Team, x: number, y: number, isHuman: boolean = true, role?: 'defender' | 'forward') {
    super()
    this.id = id
    this.team = team
    this.x = x
    this.y = y
    this.isHuman = isHuman
    this.isControlled = isHuman
    this.role = role
  }
}

export class Ball extends Schema {
  @type('number') x: number = GAME_CONFIG.FIELD_WIDTH / 2
  @type('number') y: number = GAME_CONFIG.FIELD_HEIGHT / 2
  @type('number') velocityX: number = 0
  @type('number') velocityY: number = 0
  @type('string') possessedBy: string = ''
  @type('number') pressureLevel: number = 0

  reset() {
    this.x = GAME_CONFIG.FIELD_WIDTH / 2
    this.y = GAME_CONFIG.FIELD_HEIGHT / 2
    this.velocityX = 0
    this.velocityY = 0
    this.possessedBy = ''
    this.pressureLevel = 0
  }
}

export class GameState extends Schema {
  @type('number') matchTime: number = GAME_CONFIG.MATCH_DURATION
  @type('number') scoreBlue: number = 0
  @type('number') scoreRed: number = 0
  @type('string') phase: GamePhase = 'waiting'

  @type({ map: Player }) players = new MapSchema<Player>()
  @type(Ball) ball = new Ball()

  // Internal GameEngine (not synced, just for physics)
  private gameEngine: GameEngine

  constructor() {
    super()

    // Initialize GameEngine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Register callbacks
    this.gameEngine.onGoal((event) => {
      console.log(`⚽ GOAL! Team ${event.team} scores!`)
      // Sync score from engine
      this.syncScoresFromEngine()
    })

    this.gameEngine.onMatchEnd(() => {
      console.log('🏁 Match ended!')
      this.phase = 'ended'
    })
  }


  addPlayer(sessionId: string) {
    // Defensive check: prevent duplicate player additions
    if (this.players.has(sessionId)) {
      console.warn(`⚠️ Player ${sessionId} already exists, skipping add`)
      return
    }

    // Count only human players to determine team assignment
    let blueHumans = 0
    let redHumans = 0
    this.players.forEach((player) => {
      if (player.isHuman) {
        if (player.team === 'blue') blueHumans++
        else redHumans++
      }
    })

    const team: Team = blueHumans <= redHumans ? 'blue' : 'red'

    // Add player to GameEngine (automatically creates bots if AI enabled)
    this.gameEngine.addPlayer(sessionId, team, true)

    // Sync players from engine to Schema
    this.syncPlayersFromEngine()

    console.log(`Added player ${sessionId} to team ${team} (current players: ${this.players.size})`)
  }

  removePlayer(sessionId: string) {
    // Remove from GameEngine
    this.gameEngine.removePlayer(sessionId)

    // Remove from Schema
    this.players.delete(sessionId)
    this.players.delete(`${sessionId}-bot1`)
    this.players.delete(`${sessionId}-bot2`)
    console.log(`Removed player ${sessionId} and their teammates (remaining players: ${this.players.size})`)
  }

  queueInput(sessionId: string, input: PlayerInput) {
    // Use playerId from input if provided (for teammate switching)
    const targetPlayerId = input.playerId || sessionId

    // Update control status in GameEngine if switching players
    if (input.playerId && input.playerId !== sessionId) {
      this.gameEngine.setPlayerControl(sessionId, targetPlayerId)
    }

    // Queue input to GameEngine
    this.gameEngine.queueInput(targetPlayerId, {
      movement: input.movement,
      action: input.action,
      actionPower: input.actionPower,
      timestamp: input.timestamp,
    })
  }

  processInputs(_dt: number) {
    // GameEngine handles inputs during update()
    // This method is kept for compatibility but does nothing
  }

  updatePhysics(dt: number) {
    // Delegate to GameEngine (expects milliseconds)
    this.gameEngine.update(dt * 1000)

    // Sync state from engine to Schema
    this.syncFromEngine()
  }

  /**
   * Sync all state from GameEngine to Colyseus Schema
   */
  private syncFromEngine() {
    const state = this.gameEngine.getState()

    // Sync ball
    this.ball.x = state.ball.x
    this.ball.y = state.ball.y
    this.ball.velocityX = state.ball.velocityX
    this.ball.velocityY = state.ball.velocityY
    this.ball.possessedBy = state.ball.possessedBy
    this.ball.pressureLevel = state.ball.pressureLevel

    // Sync players
    state.players.forEach((enginePlayer: EnginePlayerData, playerId: string) => {
      const schemaPlayer = this.players.get(playerId)
      if (schemaPlayer) {
        schemaPlayer.x = enginePlayer.x
        schemaPlayer.y = enginePlayer.y
        schemaPlayer.velocityX = enginePlayer.velocityX
        schemaPlayer.velocityY = enginePlayer.velocityY
        schemaPlayer.state = enginePlayer.state
        schemaPlayer.direction = enginePlayer.direction
        schemaPlayer.isControlled = enginePlayer.isControlled
      }
    })

    // Sync timer
    this.matchTime = state.matchTime

    // Sync phase
    this.phase = state.phase
  }

  /**
   * Sync players from GameEngine to Schema (after addPlayer)
   */
  private syncPlayersFromEngine() {
    const state = this.gameEngine.getState()

    state.players.forEach((enginePlayer: EnginePlayerData, playerId: string) => {
      if (!this.players.has(playerId)) {
        // Create new Schema player
        const schemaPlayer = new Player(
          enginePlayer.id,
          enginePlayer.team,
          enginePlayer.x,
          enginePlayer.y,
          enginePlayer.isHuman,
          enginePlayer.role
        )
        this.players.set(playerId, schemaPlayer)
      }
    })
  }

  /**
   * Sync scores from GameEngine to Schema (after goal)
   */
  private syncScoresFromEngine() {
    const state = this.gameEngine.getState()
    this.scoreBlue = state.scoreBlue
    this.scoreRed = state.scoreRed
  }

  updateTimer(dt: number) {
    // GameEngine handles timer internally
    // This method is kept for compatibility but does nothing
  }

  /**
   * Start the match
   */
  startMatch() {
    // Ensure both teams exist for single-player multiplayer
    this.ensureBothTeamsExist()

    this.phase = 'playing'
    this.gameEngine.startMatch()
    console.log('🎮 Match started via GameEngine!')
  }

  /**
   * Ensure both teams exist (for single-player multiplayer mode)
   */
  private ensureBothTeamsExist() {
    let hasBlueTeam = false
    let hasRedTeam = false

    this.players.forEach((player) => {
      if (player.team === 'blue') hasBlueTeam = true
      if (player.team === 'red') hasRedTeam = true
    })

    // If only one team exists, create the opposing team with AI players
    if (hasBlueTeam && !hasRedTeam) {
      console.log('🤖 Creating red team AI opponents for single-player multiplayer')
      this.gameEngine.addPlayer('ai-red-team', 'red', false)
      this.syncPlayersFromEngine()
    } else if (hasRedTeam && !hasBlueTeam) {
      console.log('🤖 Creating blue team AI opponents for single-player multiplayer')
      this.gameEngine.addPlayer('ai-blue-team', 'blue', false)
      this.syncPlayersFromEngine()
    }
  }
}
