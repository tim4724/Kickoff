import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import type { EnginePlayerData } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { AIDebugRenderer } from '../utils/AIDebugRenderer'

/**
 * AI-Only Scene
 * Development mode where all players are AI-controlled
 * Useful for testing AI behavior and watching AI vs AI matches
 */
export class AIOnlyScene extends BaseGameScene {
  private gameEngine!: GameEngine
  private aiDebugRenderer!: AIDebugRenderer
  private debugEnabled: boolean = true

  constructor() {
    super({ key: 'AIOnlyScene' })
  }

  protected initializeGameState(): void {
    // Initialize game engine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Add AI-only teams (all players are AI-controlled)
    // Blue team: 2 AI players
    this.gameEngine.addPlayer('ai-blue-team', 'blue', false)

    // Red team: 2 AI players
    this.gameEngine.addPlayer('ai-red-team', 'red', false)

    console.log('🤖 AI-Only mode: 4 AI players created (2 blue, 2 red)')

    // Set up callbacks
    this.gameEngine.onGoal((event: { team: 'blue' | 'red'; time: number }) => {
      console.log('⚽ Goal!', event.team)
      if (!this.goalScored) {
        this.onGoalScored(event.team)
      }
    })

    this.gameEngine.onMatchEnd(() => {
      console.log('🏁 Match ended')
      if (!this.matchEnded) {
        this.onMatchEnd()
      }
    })

    // Start match immediately
    this.gameEngine.startMatch()

    // Initialize player visuals from engine state
    this.syncPlayersFromEngine()

    // Initialize AI debug renderer (pass UI camera so debug elements only show on game camera)
    this.aiDebugRenderer = new AIDebugRenderer(this, this.cameraManager.getUICamera())

    // Enable spectator camera controls
    this.setupSpectatorControls()
  }

  protected getGameState(): any {
    return this.gameEngine.getState()
  }

  protected updateGameState(delta: number): void {
    // No human input - all players are AI-controlled
    // Just update game engine
    this.gameEngine.update(delta)

    // Sync visuals from engine state
    this.syncVisualsFromEngine()

    // Update AI debug visualization
    if (this.debugEnabled) {
      this.updateAIDebug()
    }
  }

  protected handleShootAction(_power: number): void {
    // No shooting action in AI-only mode (all automated)
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup (if needed in future)
  }

  /**
   * Set up spectator controls
   */
  private setupSpectatorControls() {
    console.log('📹 AI-Only Mode - Spectator View')
    console.log('  - D: Toggle AI debug visualization')

    // Hide joystick and action button (they exist but we don't need them)
    // Controls are created in BaseGameScene but not needed for spectating

    // Add D key to toggle debug visualization
    this.input.keyboard?.on('keydown-D', () => {
      this.debugEnabled = !this.debugEnabled
      this.aiDebugRenderer.setEnabled(this.debugEnabled)
      console.log('🐛 AI Debug:', this.debugEnabled ? 'ON' : 'OFF')
    })
  }

  private syncPlayersFromEngine() {
    const state = this.gameEngine.getState()

    // In AI-only mode, we don't have a "myPlayerId"
    // Create all players as remote players for rendering
    let isFirstPlayer = true

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (isFirstPlayer) {
        // Use the main player sprite for the first AI player (visual consistency)
        this.player.setPosition(playerData.x, playerData.y)
        const color =
          playerData.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
        this.player.setFillStyle(color)
        this.player.isFilled = true
        this.playerTeamColor = color
        // Store reference so we can update it
        this.myPlayerId = playerId
        isFirstPlayer = false
      } else {
        this.createRemotePlayer(playerId, playerData)
      }
    })
  }

  private syncVisualsFromEngine() {
    const state = this.gameEngine.getState()

    // Update ball
    this.ball.setPosition(state.ball.x, state.ball.y)
    this.ballShadow.setPosition(state.ball.x + 2, state.ball.y + 3)

    // Update players
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        // Update the main player sprite
        this.player.setPosition(playerData.x, playerData.y)
        this.player.setFillStyle(this.playerTeamColor)
        this.player.isFilled = true
      } else {
        // Update remote player sprites
        const sprite = this.remotePlayers.get(playerId)
        if (sprite) {
          sprite.setPosition(playerData.x, playerData.y)
        }
      }
    })

    // Update UI
    this.scoreText.setText(`${state.scoreBlue} - ${state.scoreRed}`)

    const minutes = Math.floor(state.matchTime / 60)
    const seconds = Math.floor(state.matchTime % 60)
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

    if (state.matchTime <= 30 && state.matchTime > 0) {
      this.timerText.setColor('#ff4444')
    } else {
      this.timerText.setColor('#ffffff')
    }
  }

  /**
   * Update AI debug visualization
   */
  private updateAIDebug() {
    const state = this.gameEngine.getState()
    const ball = state.ball

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      // In AI-only mode, show debug for ALL players (all are AI-controlled)

      // Determine AI goal text based on role
      let goalText = ''
      if (playerData.role === 'defender') {
        if (ball.possessedBy === playerId) {
          goalText = 'DEFEND: HAS BALL'
        } else {
          const distToBall = Math.sqrt(
            (ball.x - playerData.x) ** 2 + (ball.y - playerData.y) ** 2
          )
          if (distToBall < 300) {
            goalText = 'DEFEND: CHASE BALL'
          } else {
            goalText = 'DEFEND: POSITION'
          }
        }
      } else {
        // Forward
        if (ball.possessedBy === playerId) {
          const goalX = playerData.team === 'blue' ? GAME_CONFIG.FIELD_WIDTH : 0
          const distToGoal = Math.sqrt(
            (goalX - ball.x) ** 2 + (GAME_CONFIG.FIELD_HEIGHT / 2 - ball.y) ** 2
          )
          if (distToGoal < 500) {
            goalText = 'FORWARD: SHOOT'
          } else {
            goalText = 'FORWARD: DRIBBLE'
          }
        } else {
          goalText = 'FORWARD: CHASE BALL'
        }
      }

      // Update goal label
      this.aiDebugRenderer.updatePlayerLabel(
        playerId,
        { x: playerData.x, y: playerData.y },
        goalText,
        playerData.team
      )

      // Determine target position
      let targetX = ball.x
      let targetY = ball.y

      if (playerData.role === 'defender' && ball.possessedBy !== playerId) {
        const distToBall = Math.sqrt(
          (ball.x - playerData.x) ** 2 + (ball.y - playerData.y) ** 2
        )
        if (distToBall >= 300) {
          // Return to defensive position
          targetX =
            playerData.team === 'blue'
              ? GAME_CONFIG.FIELD_WIDTH * 0.19
              : GAME_CONFIG.FIELD_WIDTH * 0.81
          targetY = playerData.y // Maintain vertical lane
        }
      }

      // Draw target line
      this.aiDebugRenderer.updateTargetLine(
        playerId,
        { x: playerData.x, y: playerData.y },
        { x: targetX, y: targetY },
        playerData.team
      )
    })
  }
}
