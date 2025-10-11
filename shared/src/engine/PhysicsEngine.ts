/**
 * Physics Engine
 * Handles all physics calculations for ball and players
 * Shared between client single-player and server multiplayer
 */

import type { EnginePlayerData, EngineBallData, PhysicsConfig, EnginePlayerInput } from './types'
import type { Team } from '../types'

export class PhysicsEngine {
  private config: PhysicsConfig
  private lastPossessionGainTime = new Map<string, number>()
  private lastPossessionLossTime = new Map<string, number>()

  constructor(config: PhysicsConfig) {
    this.config = config
  }

  /**
   * Process player input and update player position/velocity
   */
  processPlayerInput(player: EnginePlayerData, input: EnginePlayerInput, dt: number): void {
    // Update velocity based on input
    player.velocityX = input.movement.x * this.config.playerSpeed
    player.velocityY = input.movement.y * this.config.playerSpeed

    const oldX = player.x
    const oldY = player.y

    // Update position
    player.x += player.velocityX * dt
    player.y += player.velocityY * dt

    // Clamp to field bounds
    player.x = Math.max(
      this.config.playerMargin,
      Math.min(this.config.fieldWidth - this.config.playerMargin, player.x)
    )
    player.y = Math.max(
      this.config.playerMargin,
      Math.min(this.config.fieldHeight - this.config.playerMargin, player.y)
    )

    // Update state (preserve 'kicking' if still active)
    const now = Date.now()
    if (player.kickingUntil && now < player.kickingUntil) {
      // Keep kicking state, but update direction if moving
      const moving = Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1
      if (moving) {
        player.direction = Math.atan2(input.movement.y, input.movement.x)
      }
    } else {
      // Normal state update
      const moving = Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1
      player.state = moving ? 'running' : 'idle'

      if (moving) {
        player.direction = Math.atan2(input.movement.y, input.movement.x)
      }
    }
  }

  /**
   * Update ball physics (velocity, position, bouncing)
   */
  updateBallPhysics(ball: EngineBallData, dt: number): void {
    // Skip if in goal net (frozen)
    if (ball.inGoal) {
      ball.velocityX = 0
      ball.velocityY = 0
      return
    }

    // Only update if not possessed
    if (ball.possessedBy === '') {
      // Apply friction
      ball.velocityX *= this.config.ballFriction
      ball.velocityY *= this.config.ballFriction

      // Stop if too slow
      if (Math.abs(ball.velocityX) < 1 && Math.abs(ball.velocityY) < 1) {
        ball.velocityX = 0
        ball.velocityY = 0
      }

      // Update position
      ball.x += ball.velocityX * dt
      ball.y += ball.velocityY * dt

      // Bounce off boundaries (exclude goal zones)
      const margin = this.config.fieldMargin

      // Left/right boundaries (exclude goal zones)
      if (
        ball.x <= margin &&
        (ball.y < this.config.goalYMin || ball.y > this.config.goalYMax)
      ) {
        ball.velocityX *= -0.8
        ball.x = margin
      }
      if (
        ball.x >= this.config.fieldWidth - margin &&
        (ball.y < this.config.goalYMin || ball.y > this.config.goalYMax)
      ) {
        ball.velocityX *= -0.8
        ball.x = this.config.fieldWidth - margin
      }

      // Top/bottom boundaries
      if (ball.y <= margin || ball.y >= this.config.fieldHeight - margin) {
        ball.velocityY *= -0.8
        ball.y = Math.max(margin, Math.min(this.config.fieldHeight - margin, ball.y))
      }
    }
  }

  /**
   * Update possession pressure system
   */
  updatePossessionPressure(
    ball: EngineBallData,
    players: Map<string, EnginePlayerData>,
    dt: number
  ): void {
    // Only apply pressure if someone has possession
    if (ball.possessedBy === '') {
      ball.pressureLevel = 0
      return
    }

    const possessor = players.get(ball.possessedBy)
    if (!possessor) {
      ball.pressureLevel = 0
      return
    }

    // Count opponents within pressure radius
    let opponentsNearby = 0
    let nearestOpponent: EnginePlayerData | null = null
    let nearestOpponentDist = Infinity

    players.forEach((player) => {
      if (player.id === possessor.id) return

      const dx = player.x - ball.x
      const dy = player.y - ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < this.config.pressureRadius && player.team !== possessor.team) {
        opponentsNearby++
        if (dist < nearestOpponentDist) {
          nearestOpponent = player
          nearestOpponentDist = dist
        }
      }
    })

    // Update pressure level
    if (opponentsNearby > 0) {
      const pressureIncrease = this.config.pressureBuildup * dt * opponentsNearby
      ball.pressureLevel = Math.min(
        this.config.pressureThreshold,
        ball.pressureLevel + pressureIncrease
      )
    } else {
      const pressureDecrease = this.config.pressureDecay * dt
      ball.pressureLevel = Math.max(0, ball.pressureLevel - pressureDecrease)
    }

    // Check if pressure threshold reached - transfer possession
    if (ball.pressureLevel >= this.config.pressureThreshold) {
      // Check capture lockout
      const timeSinceCapture =
        Date.now() - (this.lastPossessionGainTime.get(possessor.id) || 0)
      if (timeSinceCapture < this.config.captureLockoutMs) {
        return
      }

      // Transfer to nearest opponent
      if (nearestOpponent) {
        const opponent = nearestOpponent as EnginePlayerData
        this.lastPossessionLossTime.set(possessor.id, Date.now())
        ball.possessedBy = opponent.id
        this.lastPossessionGainTime.set(opponent.id, Date.now())
        ball.pressureLevel = 0
      } else {
        // Release if no opponent nearby
        ball.possessedBy = ''
        ball.pressureLevel = 0
        this.lastPossessionLossTime.set(possessor.id, Date.now())
      }
    }
  }

  /**
   * Update ball possession (magnetism and capture)
   */
  updateBallPossession(ball: EngineBallData, players: Map<string, EnginePlayerData>): void {
    // Check if current possessor is still close enough
    if (ball.possessedBy !== '') {
      const possessor = players.get(ball.possessedBy)
      if (possessor) {
        const dx = ball.x - possessor.x
        const dy = ball.y - possessor.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const releaseThreshold = this.config.possessionRadius + 10
        if (dist > releaseThreshold) {
          ball.possessedBy = ''
          this.lastPossessionLossTime.set(possessor.id, Date.now())
        } else {
          // Apply magnetism - ball sticks in front of player
          const offsetDistance = 25
          ball.x = possessor.x + Math.cos(possessor.direction) * offsetDistance
          ball.y = possessor.y + Math.sin(possessor.direction) * offsetDistance
          ball.velocityX = 0
          ball.velocityY = 0
        }
      } else {
        ball.possessedBy = ''
      }
    }

    // Check for new possession if ball is free
    if (ball.possessedBy === '') {
      const SHOT_IMMUNITY_MS = 300
      const timeSinceShot = Date.now() - (ball.lastShotTime || 0)
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS

      players.forEach((player) => {
        if (ball.possessedBy !== '') return

        // Skip shooter during immunity
        if (hasImmunity && player.id === ball.lastShooter) return

        const dx = ball.x - player.x
        const dy = ball.y - player.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < this.config.possessionRadius) {
          // Check loss lockout
          const timeSinceLoss = Date.now() - (this.lastPossessionLossTime.get(player.id) || 0)
          if (timeSinceLoss < this.config.lossLockoutMs) return

          ball.possessedBy = player.id
          this.lastPossessionGainTime.set(player.id, Date.now())
        }
      })
    }
  }

  /**
   * Handle player action (shoot/pass)
   */
  handlePlayerAction(
    player: EnginePlayerData,
    ball: EngineBallData,
    actionPower: number = 0.8
  ): void {
    if (ball.possessedBy === player.id) {
      // Shoot in direction player is facing
      const dx = Math.cos(player.direction)
      const dy = Math.sin(player.direction)

      const speed =
        this.config.minShootSpeed +
        (this.config.shootSpeed - this.config.minShootSpeed) * actionPower

      ball.velocityX = dx * speed
      ball.velocityY = dy * speed
      ball.possessedBy = ''

      ball.lastShotTime = Date.now()
      ball.lastShooter = player.id

      this.lastPossessionLossTime.set(player.id, Date.now())

      player.state = 'kicking'
      player.kickingUntil = Date.now() + 300
    } else {
      // Try to gain possession
      const dx = ball.x - player.x
      const dy = ball.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const SHOT_IMMUNITY_MS = 300
      const timeSinceShot = Date.now() - (ball.lastShotTime || 0)
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS
      const isShooter = player.id === ball.lastShooter

      if (
        dist < this.config.possessionRadius &&
        ball.possessedBy === '' &&
        !(hasImmunity && isShooter)
      ) {
        const timeSinceLoss = Date.now() - (this.lastPossessionLossTime.get(player.id) || 0)
        if (timeSinceLoss < this.config.lossLockoutMs) return

        ball.possessedBy = player.id
        this.lastPossessionGainTime.set(player.id, Date.now())
      }
    }
  }

  /**
   * Check for goals
   */
  checkGoals(ball: EngineBallData): Team | null {
    // Left goal (red scores)
    if (
      ball.x + this.config.ballRadius < this.config.fieldMargin &&
      ball.y >= this.config.goalYMin &&
      ball.y <= this.config.goalYMax
    ) {
      ball.inGoal = true
      return 'red'
    }

    // Right goal (blue scores)
    if (
      ball.x - this.config.ballRadius > this.config.fieldWidth - this.config.fieldMargin &&
      ball.y >= this.config.goalYMin &&
      ball.y <= this.config.goalYMax
    ) {
      ball.inGoal = true
      return 'blue'
    }

    return null
  }

  /**
   * Reset ball to center
   */
  resetBall(ball: EngineBallData, fieldWidth: number, fieldHeight: number): void {
    ball.x = fieldWidth / 2
    ball.y = fieldHeight / 2
    ball.velocityX = 0
    ball.velocityY = 0
    ball.possessedBy = ''
    ball.pressureLevel = 0
    ball.lastShotTime = 0
    ball.lastShooter = ''
    ball.inGoal = false

    // Clear lockouts for fresh kickoff
    this.lastPossessionGainTime.clear()
    this.lastPossessionLossTime.clear()
  }

  /**
   * Reset players to formation positions
   */
  resetPlayers(players: Map<string, EnginePlayerData>, fieldWidth: number, fieldHeight: number): void {
    players.forEach((player, sessionId) => {
      if (player.team === 'blue') {
        const forwardX = Math.round(fieldWidth * 0.36)
        const defenderX = Math.round(fieldWidth * 0.19)

        if (sessionId.endsWith('-bot1')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.25)
        } else if (sessionId.endsWith('-bot2')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.75)
        } else {
          player.x = forwardX
          player.y = Math.round(fieldHeight * 0.5)
        }
      } else {
        const forwardX = Math.round(fieldWidth * 0.64)
        const defenderX = Math.round(fieldWidth * 0.81)

        if (sessionId.endsWith('-bot1')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.75)
        } else if (sessionId.endsWith('-bot2')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.25)
        } else {
          player.x = forwardX
          player.y = Math.round(fieldHeight * 0.5)
        }
      }

      player.velocityX = 0
      player.velocityY = 0
      player.state = 'idle'
    })
  }
}
