import { Schema, type, MapSchema } from '@colyseus/schema'
import { GAME_CONFIG } from '@kickoff/shared/types'
import { GameEngine } from '@kickoff/shared/engine/GameEngine'
import type { GameEngineState, EnginePlayerData, EnginePlayerInput, GoalEvent } from '@kickoff/shared/engine/types'
import type { Team, PlayerState, GamePhase } from '@kickoff/shared/types'

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

  // Player addition lock to prevent race conditions when multiple clients join simultaneously
  private playerAdditionLock: Promise<void> = Promise.resolve()

  constructor() {
    super()

    // Initialize GameEngine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
      // Hold last movement for ~100ms at 60Hz to mask packet loss
      holdLastInputFrames: 6,
    })

    // Register callbacks
    this.gameEngine.onGoal((event: GoalEvent) => {
      console.log(`⚽ GOAL! Team ${event.team} scores!`)
      // Sync score from engine
      this.syncScoresFromEngine()
    })

    this.gameEngine.onMatchEnd(() => {
      console.log('🏁 Match ended!')
      this.phase = 'ended'
    })
  }


  async addPlayer(sessionId: string): Promise<{ team: Team }> {
    // Serialize player additions to prevent race conditions
    // Wait for any pending player addition to complete
    await this.playerAdditionLock

    // Create new lock for this addition
    let resolveLock: (() => void) | undefined
    this.playerAdditionLock = new Promise((resolve) => {
      resolveLock = resolve
    })

    try {
      // Defensive check: prevent duplicate player additions
      // Check for the first player ID (sessionId-p1) since that's what GameEngine creates
      const firstPlayerId = `${sessionId}-p1`
      if (this.players.has(firstPlayerId)) {
        console.warn(`⚠️ Player ${sessionId} already exists (found ${firstPlayerId}), skipping add`)
        // Find the team from any of the session's players
        const existingPlayer = this.players.get(firstPlayerId)
        if (!existingPlayer) {
          // Race condition: player was removed between has() and get()
          // Recalculate team assignment instead of throwing
          console.warn(`⚠️ Player ${firstPlayerId} removed during lookup, reassigning team`)
          const redCount = Array.from(this.players.values()).filter(p => p.isHuman && p.team === 'red').length
          const blueCount = Array.from(this.players.values()).filter(p => p.isHuman && p.team === 'blue').length
          return { team: redCount <= blueCount ? 'red' : 'blue' }
        }
        return { team: existingPlayer.team }
      }

      // Count only human players to determine team assignment
      // This runs atomically now due to the lock
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

      console.log(`✅ Player ${sessionId} added to ${team} team (Blue: ${blueHumans + (team === 'blue' ? 1 : 0)}, Red: ${redHumans + (team === 'red' ? 1 : 0)})`)

      return { team }
    } finally {
      // Release the lock
      if (resolveLock) {
        resolveLock()
      }
    }
  }

  removePlayer(sessionId: string) {
    // Remove from GameEngine (which removes sessionId-p1, sessionId-p2, sessionId-p3)
    this.gameEngine.removePlayer(sessionId)

    // Remove from Schema (use the new ID format)
    this.players.delete(`${sessionId}-p1`)
    this.players.delete(`${sessionId}-p2`)
    this.players.delete(`${sessionId}-p3`)
    console.log(`Removed player ${sessionId} and their teammates (remaining players: ${this.players.size})`)
  }

  queueInput(playerId: string, input: EnginePlayerInput) {
    // Simplified: Just queue the input for the specified player
    // No knowledge of human/AI, no control switching logic
    this.gameEngine.queueInput(playerId, {
      movement: input.movement,
      action: input.action,
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

    // Sync players - ensure all engine players exist in schema
    state.players.forEach((enginePlayer: EnginePlayerData, playerId: string) => {
      let schemaPlayer = this.players.get(playerId)
      
      // Create player in schema if it doesn't exist (can happen if AI bots are created after match start)
      if (!schemaPlayer) {
        schemaPlayer = new Player(
          enginePlayer.id,
          enginePlayer.team,
          enginePlayer.x,
          enginePlayer.y,
          enginePlayer.isHuman,
          enginePlayer.role
        )
        this.players.set(playerId, schemaPlayer)
      }
      
      // Update existing player properties
      schemaPlayer.x = enginePlayer.x
      schemaPlayer.y = enginePlayer.y
      schemaPlayer.velocityX = enginePlayer.velocityX
      schemaPlayer.velocityY = enginePlayer.velocityY
      schemaPlayer.state = enginePlayer.state
      schemaPlayer.direction = enginePlayer.direction
      schemaPlayer.isControlled = enginePlayer.isControlled
    })

    // Sync timer
    this.matchTime = state.matchTime

    // DON'T sync phase - room controls phase lifecycle (waiting/playing/ended)
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
