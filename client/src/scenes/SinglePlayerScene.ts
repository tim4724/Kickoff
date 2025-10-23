import { GAME_CONFIG } from '@shared/types'
import { GameEngine } from '@shared'
import type { EnginePlayerData, EnginePlayerInput, PlayerData } from '@shared'
import { BaseGameScene } from './BaseGameScene'
import { VISUAL_CONSTANTS } from './GameSceneConstants'
import { gameClock as GameClock } from '@shared/engine/GameClock'
import { AIManager } from '../ai'
import { InterceptionCalculator } from '../ai/utils/InterceptionCalculator'
import type { Vector2D } from '@shared/types'

/**
 * Single Player Scene
 * Extends BaseGameScene to provide local GameEngine-based gameplay with AI opponents
 * Features:
 * - AI teammates for human player
 * - AI opponents
 * - Auto-switching to ball carrier
 * - Manual switching with action button (short press)
 */
export class SinglePlayerScene extends BaseGameScene {
  private gameEngine!: GameEngine
  private aiManager!: AIManager
  private lastBallPossessor: string = ''
  private aiEnabled: boolean = true
  private autoSwitchEnabled: boolean = true

  constructor() {
    super({ key: 'SinglePlayerScene' })
  }

  protected initializeGameState(): void {
    // Set GameClock to normal speed (1.0x) to prevent state pollution from other scenes
    GameClock.setTimeScale(1.0)

    // Initialize game engine
    this.gameEngine = new GameEngine({
      matchDuration: GAME_CONFIG.MATCH_DURATION,
    })

    // Add players (3v3: 3 players per team)
    this.gameEngine.addPlayer('player1', 'blue', true) // Human controlled team
    this.gameEngine.addPlayer('player2', 'red', false) // AI controlled team

    // Initialize AI system for both teams
    this.aiManager = new AIManager()
    this.aiManager.initialize(
      ['player1', 'player1-bot1', 'player1-bot2'], // Blue team (human + 2 AI teammates)
      ['player2', 'player2-bot1', 'player2-bot2'], // Red team (3 AI opponents)
      (playerId, decision) => this.applyAIDecision(playerId, decision)
    )

    console.log('🤖 SinglePlayer mode: Human player with AI teammates vs AI opponents')

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

    // Expose controls for testing (development only)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      ;(window as any).__gameControls = {
        joystick: this.joystick,
        button: this.actionButton,
        scene: this,
        test: {
          touchJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateTouch(x, y)
          },
          dragJoystick: (x: number, y: number) => {
            this.joystick.__test_simulateDrag(x, y)
          },
          releaseJoystick: () => {
            this.joystick.__test_simulateRelease()
          },
          pressButton: () => {
            this.actionButton.__test_simulatePress()
          },
          releaseButton: (holdMs: number = 500) => {
            this.actionButton.__test_simulateRelease(holdMs)
          },
          getState: () => ({
            joystick: this.joystick.__test_getState(),
            button: this.actionButton.__test_getState(),
            aiEnabled: this.aiEnabled,
            autoSwitchEnabled: this.autoSwitchEnabled,
          }),
          setAIEnabled: (enabled: boolean) => {
            this.aiEnabled = enabled
            console.log(`🤖 AI ${enabled ? 'enabled' : 'disabled'}`)
          },
          setAutoSwitchEnabled: (enabled: boolean) => {
            this.autoSwitchEnabled = enabled
            console.log(`🔄 Auto-switch ${enabled ? 'enabled' : 'disabled'}`)
          },
          // Direct input method (bypasses UI simulation)
          // Queues continuous input for specified duration
          // durationMs is in GAME TIME - we convert to frames based on time scale
          directMove: async (dx: number, dy: number, gameTimeDurationMs: number) => {
            // Normalize direction vector
            const length = Math.sqrt(dx * dx + dy * dy)
            const normalizedX = length > 0 ? dx / length : 0
            const normalizedY = length > 0 ? dy / length : 0

            const timeScale = GameClock.getTimeScale()

            // Calculate frames needed: at 60fps, each frame is ~16.67ms real time
            // With time scale, we process (16.67 * timeScale)ms game time per frame
            const realTimeDurationMs = gameTimeDurationMs / timeScale
            const framesNeeded = Math.ceil(realTimeDurationMs / 16.67)

            console.log(`🎮 [Test] Direct move: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)}) for ${framesNeeded} frames`)

            let frameCount = 0

            return new Promise<void>((resolve) => {
              const queueInput = () => {
                if (frameCount >= framesNeeded) {
                  console.log(`🎮 [Test] Direct move complete: ${frameCount} frames`)
                  resolve()
                  return
                }

                // Queue one input per frame
                this.gameEngine.queueInput(this.myPlayerId, {
                  movement: { x: normalizedX, y: normalizedY },
                  action: false,
                  timestamp: this.gameEngine.frameCount,
                })

                frameCount++
                requestAnimationFrame(queueInput)
              }

              requestAnimationFrame(queueInput)
            })
          },
        },
      }
      // Expose GameClock for time control in tests
      ;(window as any).GameClock = GameClock
      console.log('🧪 Testing API exposed: window.__gameControls')
      console.log('🕐 GameClock exposed for time control')
    }
  }

  protected getGameState(): any {
    return this.gameEngine.getState()
  }

  protected updateGameState(delta: number): void {
    // Auto-switch to ball carrier if ball possession changed
    if (this.autoSwitchEnabled) {
      this.handleAutoSwitch()
    }

    // Update AI for all non-controlled players
    if (this.aiEnabled) {
      this.updateAI()
    }

    // Get input from joystick or keyboard for controlled player
    const movement = { x: 0, y: 0 }

    if (this.joystick && this.joystick.isPressed()) {
      const joystickInput = this.joystick.getInput()
      movement.x = joystickInput.x
      movement.y = joystickInput.y
    } else if (this.cursors) {
      // Arrow keys
      if (this.cursors.left.isDown) movement.x = -1
      else if (this.cursors.right.isDown) movement.x = 1

      if (this.cursors.up.isDown) movement.y = -1
      else if (this.cursors.down.isDown) movement.y = 1

      // WASD keys (override arrow keys if pressed)
      if (this.wasd.a.isDown) movement.x = -1
      else if (this.wasd.d.isDown) movement.x = 1

      if (this.wasd.w.isDown) movement.y = -1
      else if (this.wasd.s.isDown) movement.y = 1

      const length = Math.sqrt(movement.x * movement.x + movement.y * movement.y)
      if (length > 0) {
        movement.x /= length
        movement.y /= length
      }
    }

    // Queue input for controlled player
    if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
      this.gameEngine.queueInput(this.controlledPlayerId, {
        movement,
        action: false,
        timestamp: this.gameEngine.frameCount,
      })
    }

    // Update game engine
    this.gameEngine.update(delta)

    // Sync visuals from engine state
    this.syncVisualsFromEngine()
  }

  protected handleShootAction(power: number): void {
    // Shoot with variable power
    // (BaseGameScene already checks hasBall before calling this method)
    this.gameEngine.queueInput(this.controlledPlayerId, {
      movement: { x: 0, y: 0 },
      action: true,
      actionPower: power,
      timestamp: this.gameEngine.frameCount,
    })

    // Auto-switching is handled by handleAutoSwitch() when ball becomes loose
  }

  /**
   * Auto-switch to the teammate with best chance to intercept the ball
   */
  private autoSwitchToBestInterceptor(): void {
    const engineState = this.gameEngine.getState()
    const ball = engineState.ball

    // Get all blue team players (human team) INCLUDING the current player
    const blueTeamPlayers: EnginePlayerData[] = []
    engineState.players.forEach((player) => {
      if (player.team === 'blue') {
        blueTeamPlayers.push(player)
      }
    })

    if (blueTeamPlayers.length === 0) return

    // Convert to format InterceptionCalculator expects (PlayerData format)
    const teammates: PlayerData[] = blueTeamPlayers.map(p => ({
      id: p.id,
      team: p.team,
      isHuman: p.isHuman,
      isControlled: p.isControlled,
      position: { x: p.x, y: p.y },
      velocity: { x: p.velocityX, y: p.velocityY },
      state: p.state,
      direction: p.direction,
    }))

    // Create ball prediction function
    const predictBallPosition = (t: number): Vector2D => {
      return InterceptionCalculator.simulateBallPosition(
        { x: ball.x, y: ball.y },
        { x: ball.velocityX, y: ball.velocityY },
        t
      )
    }

    // Calculate best interceptor
    const { interceptor } = InterceptionCalculator.calculateInterception(
      teammates,
      predictBallPosition,
      { x: ball.x, y: ball.y }
    )

    // Only switch if the best interceptor is NOT the current player
    if (interceptor.id === this.controlledPlayerId) {
      console.log(`⚽ Current player is best interceptor, staying in control: ${interceptor.id}`)
      return
    }

    // Switch to the best interceptor
    this.switchToPlayer(interceptor.id)
    console.log(`⚽ Auto-switched to best interceptor: ${interceptor.id}`)
  }

  protected cleanupGameState(): void {
    // GameEngine cleanup (if needed in future)
  }

  /**
   * Update AI and apply decisions to game engine
   */
  private updateAI() {
    const engineState = this.gameEngine.getState()

    // Convert GameEngineState to GameStateData format
    const gameStateData = this.convertEngineStateToGameStateData(engineState)

    // Update AI Manager (this will call TeamAI.update() which calls each AIPlayer.update())
    this.aiManager.update(gameStateData)
  }

  /**
   * Apply AI decision by queuing input to game engine
   * Only applies if the player is NOT human-controlled
   */
  private applyAIDecision(playerId: string, decision: any) {
    const engineState = this.gameEngine.getState()
    const player = engineState.players.get(playerId)

    // Don't apply AI to human-controlled player
    if (player && player.isControlled) {
      return
    }

    const input: EnginePlayerInput = {
      movement: {
        x: decision.moveX,
        y: decision.moveY,
      },
      action: decision.shootPower !== null,
      actionPower: decision.shootPower ?? 0,
      timestamp: this.gameEngine.frameCount,
      playerId: playerId,
    }

    this.gameEngine.queueInput(playerId, input)
  }

  /**
   * Auto-switch to ball carrier when possession changes
   */
  private handleAutoSwitch() {
    const engineState = this.gameEngine.getState()
    const ballPossessor = engineState.ball.possessedBy

    // Check if possession changed and belongs to blue team (human team)
    if (ballPossessor && ballPossessor !== this.lastBallPossessor) {
      const player = engineState.players.get(ballPossessor)
      if (player && player.team === 'blue') {
        // Switch to the ball carrier
        this.switchToPlayer(ballPossessor)
        console.log(`⚽ Auto-switched to ball carrier: ${ballPossessor}`)
      }
      this.lastBallPossessor = ballPossessor
    } else if (!ballPossessor && this.lastBallPossessor) {
      // Ball became loose - check if opponent shot/lost possession
      const lastPlayer = engineState.players.get(this.lastBallPossessor)

      // If last possessor was red team (opponent), switch to best interceptor
      if (lastPlayer && lastPlayer.team === 'red') {
        console.log(`⚽ Opponent lost possession, switching to best interceptor`)
        this.autoSwitchToBestInterceptor()
      }
      // If last possessor was blue team (us) and ball is loose, also switch to best interceptor
      else if (lastPlayer && lastPlayer.team === 'blue') {
        console.log(`⚽ Ball loose after blue team possession, switching to best interceptor`)
        this.autoSwitchToBestInterceptor()
      }

      this.lastBallPossessor = ''
    }
  }

  /**
   * Switch to next teammate (manual switching)
   */
  protected switchToNextTeammate() {
    const engineState = this.gameEngine.getState()
    const blueTeamPlayers: string[] = []

    // Collect all blue team players
    engineState.players.forEach((player, playerId) => {
      if (player.team === 'blue') {
        blueTeamPlayers.push(playerId)
      }
    })

    if (blueTeamPlayers.length === 0) return

    // Find current controlled player index
    const currentIndex = blueTeamPlayers.indexOf(this.controlledPlayerId)
    const nextIndex = (currentIndex + 1) % blueTeamPlayers.length
    const nextPlayerId = blueTeamPlayers[nextIndex]

    this.switchToPlayer(nextPlayerId)
    console.log(`🔄 Manual switch to: ${nextPlayerId}`)
  }

  /**
   * Switch control to a specific player
   */
  private switchToPlayer(playerId: string) {
    const engineState = this.gameEngine.getState()
    const player = engineState.players.get(playerId)

    if (!player || player.team !== 'blue') {
      return
    }

    // Update controlled player
    this.controlledPlayerId = playerId
    this.gameEngine.setPlayerControl(this.myPlayerId, playerId)

    // Update player borders to show who is controlled
    this.updatePlayerBorders()
  }

  /**
   * Convert GameEngineState to GameStateData format for AI
   */
  private convertEngineStateToGameStateData(engineState: any): any {
    // Convert players map
    const playersMap = new Map()
    engineState.players.forEach((player: EnginePlayerData, playerId: string) => {
      playersMap.set(playerId, {
        id: player.id,
        team: player.team,
        isHuman: player.isHuman,
        isControlled: player.isControlled,
        position: { x: player.x, y: player.y },
        velocity: { x: player.velocityX, y: player.velocityY },
        state: player.state,
        direction: player.direction,
      })
    })

    // Convert ball
    const ball = {
      position: { x: engineState.ball.x, y: engineState.ball.y },
      velocity: { x: engineState.ball.velocityX, y: engineState.ball.velocityY },
      possessedBy: engineState.ball.possessedBy,
    }

    return {
      players: playersMap,
      ball: ball,
      scoreBlue: engineState.scoreBlue,
      scoreRed: engineState.scoreRed,
      matchTime: engineState.matchTime,
      phase: engineState.phase,
    }
  }

  private syncPlayersFromEngine() {
    const state = this.gameEngine.getState()

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        this.player.setPosition(playerData.x, playerData.y)
        const color =
          playerData.team === 'blue'
            ? VISUAL_CONSTANTS.PLAYER_BLUE_COLOR
            : VISUAL_CONSTANTS.PLAYER_RED_COLOR
        this.player.setFillStyle(color)
        this.player.isFilled = true // Restore fill after setFillStyle
        this.playerTeamColor = color
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

    // Update players - sync all sprites based on their actual IDs
    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      if (playerId === this.myPlayerId) {
        // Always update the main player sprite (represents original human player)
        this.player.setPosition(playerData.x, playerData.y)
        // Ensure color is always set
        this.player.setFillStyle(this.playerTeamColor)
        this.player.isFilled = true // Restore fill after setFillStyle
      } else {
        // Update remote player sprites (teammates and opponents)
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
   * Update AI debug visualization (called from BaseGameScene when debug is enabled)
   */
  protected updateAIDebugLabels(): void {
    const state = this.gameEngine.getState()

    state.players.forEach((playerData: EnginePlayerData, playerId: string) => {
      // Get AI player instance from AIManager
      const teamAI = this.aiManager.getTeamAI(playerData.team)
      const aiPlayer = teamAI?.getPlayer(playerId)

      // Get goal text from AIPlayer (debug label)
      const goal = aiPlayer?.getGoal()
      let goalText = goal ? goal.toUpperCase() : ''

      // Update goal label
      this.aiDebugRenderer.updatePlayerLabel(
        playerId,
        { x: playerData.x, y: playerData.y },
        goalText,
        playerData.team
      )

      // Get target position from AIPlayer
      const targetPos = aiPlayer?.getTargetPosition()
      if (targetPos) {
        // Draw target line to AI's actual target position
        this.aiDebugRenderer.updateTargetLine(
          playerId,
          { x: playerData.x, y: playerData.y },
          targetPos,
          playerData.team
        )
      }
    })
  }
}
