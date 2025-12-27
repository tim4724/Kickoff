/**
 * Physics Engine
 * Handles all physics calculations for ball and players
 * Shared between client single-player and server multiplayer
 */

import type { EnginePlayerData, EngineBallData, PhysicsConfig, EnginePlayerInput } from './types.js'
import { PHYSICS_DEFAULTS } from './types.js'
import { GeometryUtils } from '../utils/geometry.js'
import type { Team } from '../types.js'
import { GAME_CONFIG } from '../types.js'
import { gameClock } from './GameClock.js'

export class PhysicsEngine {
  private config: PhysicsConfig
  private lastPossessionGainTime = new Map<string, number>()
  private lastPossessionLossTime = new Map<string, number>()

  // Pre-calculated squared values for performance
  private challengeRadiusSq: number
  private releaseThresholdSq: number

  constructor(config: PhysicsConfig) {
    this.config = config
    this.challengeRadiusSq = config.challengeRadius * config.challengeRadius
    this.releaseThresholdSq = (config.challengeRadius + 10) * (config.challengeRadius + 10)
  }

  /**
   * Simulate one physics step for the ball (static helper for AI)
   * Returns new position and velocity after applying friction and bounces
   * Ball uses full field bounds (0 to fieldWidth/fieldHeight)
   */
  static simulateBallStep(
    x: number,
    y: number,
    vx: number,
    vy: number,
    dt: number,
    config: {
      ballFriction: number
      fieldWidth: number
      fieldHeight: number
      goalYMin: number
      goalYMax: number
    },
    out?: { x: number; y: number; vx: number; vy: number }
  ): { x: number; y: number; vx: number; vy: number } {
    const bounceCoef = -0.8

    // Apply friction
    vx *= config.ballFriction
    vy *= config.ballFriction

    // Stop if too slow
    if (Math.abs(vx) < 1 && Math.abs(vy) < 1) {
      if (out) {
        out.x = x
        out.y = y
        out.vx = 0
        out.vy = 0
        return out
      }
      return { x, y, vx: 0, vy: 0 }
    }

    // Update position
    x += vx * dt
    y += vy * dt

    // Bounce off left boundary (exclude goal zone)
    if (x <= 0 && (y < config.goalYMin || y > config.goalYMax)) {
      vx *= bounceCoef
      x = 0
    }
    // Bounce off right boundary (exclude goal zone)
    if (x >= config.fieldWidth && (y < config.goalYMin || y > config.goalYMax)) {
      vx *= bounceCoef
      x = config.fieldWidth
    }

    // Bounce off top/bottom boundaries
    if (y <= 0) {
      vy *= bounceCoef
      y = 0
    }
    if (y >= config.fieldHeight) {
      vy *= bounceCoef
      y = config.fieldHeight
    }

    if (out) {
      out.x = x
      out.y = y
      out.vx = vx
      out.vy = vy
      return out
    }
    return { x, y, vx, vy }
  }

  /**
   * Process player input and update player position/velocity with inertia
   */
  processPlayerInput(player: EnginePlayerData, input: EnginePlayerInput, dt: number): void {
    // Target velocity based on input
    const targetVelocityX = input.movement.x * this.config.playerSpeed
    const targetVelocityY = input.movement.y * this.config.playerSpeed

    // Inertia: smooth acceleration/deceleration (lower = more momentum, higher = faster response)
    const ACCELERATION_FACTOR = 0.15
    player.velocityX += (targetVelocityX - player.velocityX) * ACCELERATION_FACTOR
    player.velocityY += (targetVelocityY - player.velocityY) * ACCELERATION_FACTOR

    // Update position
    player.x += player.velocityX * dt
    player.y += player.velocityY * dt

    // Clamp to field bounds (players can go to edges)
    player.x = Math.max(0, Math.min(this.config.fieldWidth, player.x))
    player.y = Math.max(0, Math.min(this.config.fieldHeight, player.y))

    // Update state (preserve 'kicking' if still active)
    const now = gameClock.now()
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
      // Use static helper for physics simulation
      const result = PhysicsEngine.simulateBallStep(
        ball.x,
        ball.y,
        ball.velocityX,
        ball.velocityY,
        dt,
        this.config
      )

      ball.x = result.x
      ball.y = result.y
      ball.velocityX = result.vx
      ball.velocityY = result.vy
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

    for (const player of players.values()) {
      // Optimization: Skip self and teammates early to avoid distance calculation
      if (player.id === possessor.id || player.team === possessor.team) continue

      const distSq = GeometryUtils.distanceSquaredScalar(player.x, player.y, ball.x, ball.y)

      if (distSq < this.challengeRadiusSq) {
        opponentsNearby++
        if (distSq < nearestOpponentDist) {
          nearestOpponent = player
          nearestOpponentDist = distSq
        }
      }
    }

    // Update pressure level
    if (opponentsNearby > 0) {
      const pressureIncrease = PHYSICS_DEFAULTS.PRESSURE_BUILDUP_RATE * dt * opponentsNearby
      ball.pressureLevel = Math.min(
        PHYSICS_DEFAULTS.PRESSURE_RELEASE_THRESHOLD,
        ball.pressureLevel + pressureIncrease
      )
    } else {
      const pressureDecrease = PHYSICS_DEFAULTS.PRESSURE_DECAY_RATE * dt
      ball.pressureLevel = Math.max(0, ball.pressureLevel - pressureDecrease)
    }

    // Check if pressure threshold reached - transfer possession
    if (ball.pressureLevel >= PHYSICS_DEFAULTS.PRESSURE_RELEASE_THRESHOLD) {
      // Check capture lockout
      const timeSinceCapture =
        gameClock.now() - (this.lastPossessionGainTime.get(possessor.id) || 0)
      if (timeSinceCapture < PHYSICS_DEFAULTS.CAPTURE_LOCKOUT_MS) {
        return
      }

      // Transfer to nearest opponent
      if (nearestOpponent) {
        const opponent = nearestOpponent as EnginePlayerData
        this.lastPossessionLossTime.set(possessor.id, gameClock.now())
        ball.possessedBy = opponent.id
        this.lastPossessionGainTime.set(opponent.id, gameClock.now())
        ball.pressureLevel = 0
      } else {
        // Release if no opponent nearby
        ball.possessedBy = ''
        ball.pressureLevel = 0
        this.lastPossessionLossTime.set(possessor.id, gameClock.now())
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
        const distSq = GeometryUtils.distanceSquaredScalar(ball.x, ball.y, possessor.x, possessor.y)

        if (distSq > this.releaseThresholdSq) {
          ball.possessedBy = ''
          this.lastPossessionLossTime.set(possessor.id, gameClock.now())
        } else {
          // Apply magnetism - ball sticks in front of player
          ball.x = possessor.x + Math.cos(possessor.direction) * GAME_CONFIG.POSSESSION_BALL_OFFSET
          ball.y = possessor.y + Math.sin(possessor.direction) * GAME_CONFIG.POSSESSION_BALL_OFFSET
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
      const timeSinceShot = gameClock.now() - (ball.lastShotTime || 0)
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS

      for (const player of players.values()) {
        if (ball.possessedBy !== '') break

        // Skip shooter during immunity
        if (hasImmunity && player.id === ball.lastShooter) continue

        const distSq = GeometryUtils.distanceSquaredScalar(ball.x, ball.y, player.x, player.y)

        if (distSq < this.challengeRadiusSq) {
          // Check loss lockout
          const timeSinceLoss = gameClock.now() - (this.lastPossessionLossTime.get(player.id) || 0)
          if (timeSinceLoss < PHYSICS_DEFAULTS.LOSS_LOCKOUT_MS) continue

          ball.possessedBy = player.id
          this.lastPossessionGainTime.set(player.id, gameClock.now())
        }
      }
    }
  }

  /**
   * Handle player action (shoot/pass)
   */
  handlePlayerAction(
    player: EnginePlayerData,
    ball: EngineBallData,
    actionPower: number = 0.8,
    onShootCallback?: (playerId: string, power: number) => void
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

      ball.lastShotTime = gameClock.now()
      ball.lastShooter = player.id

      this.lastPossessionLossTime.set(player.id, gameClock.now())

      player.state = 'kicking'
      player.kickingUntil = gameClock.now() + 300

      // Trigger shoot callback
      if (onShootCallback) {
        onShootCallback(player.id, actionPower)
      }
    } else {
      // Try to gain possession
      const distSq = GeometryUtils.distanceSquaredScalar(ball.x, ball.y, player.x, player.y)

      const SHOT_IMMUNITY_MS = 300
      const timeSinceShot = gameClock.now() - (ball.lastShotTime || 0)
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS
      const isShooter = player.id === ball.lastShooter

      if (
        distSq < this.challengeRadiusSq &&
        ball.possessedBy === '' &&
        !(hasImmunity && isShooter)
      ) {
        const timeSinceLoss = gameClock.now() - (this.lastPossessionLossTime.get(player.id) || 0)
        if (timeSinceLoss < PHYSICS_DEFAULTS.LOSS_LOCKOUT_MS) return

        ball.possessedBy = player.id
        this.lastPossessionGainTime.set(player.id, gameClock.now())
      }
    }
  }

  /**
   * Check for goals
   * Goals are at x < 0 (left/red scores) and x > fieldWidth (right/blue scores)
   */
  checkGoals(ball: EngineBallData): Team | null {
    // Left goal (red scores) - ball fully past left edge
    if (
      ball.x + this.config.ballRadius < 0 &&
      ball.y >= this.config.goalYMin &&
      ball.y <= this.config.goalYMax
    ) {
      ball.inGoal = true
      return 'red'
    }

    // Right goal (blue scores) - ball fully past right edge
    if (
      ball.x - this.config.ballRadius > this.config.fieldWidth &&
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
    for (const [playerId, player] of players) {
      if (player.team === 'blue') {
        const forwardX = Math.round(fieldWidth * 0.36)
        const defenderX = Math.round(fieldWidth * 0.19)

        // New ID format: sessionId-p1 (forward), sessionId-p2 (defender top), sessionId-p3 (defender bottom)
        if (playerId.endsWith('-p2')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.25)
        } else if (playerId.endsWith('-p3')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.75)
        } else {
          // -p1 or any other ID gets forward position
          player.x = forwardX
          player.y = Math.round(fieldHeight * 0.5)
        }
      } else {
        const forwardX = Math.round(fieldWidth * 0.64)
        const defenderX = Math.round(fieldWidth * 0.81)

        // New ID format: sessionId-p1 (forward), sessionId-p2 (defender top), sessionId-p3 (defender bottom)
        if (playerId.endsWith('-p2')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.75)
        } else if (playerId.endsWith('-p3')) {
          player.x = defenderX
          player.y = Math.round(fieldHeight * 0.25)
        } else {
          // -p1 or any other ID gets forward position
          player.x = forwardX
          player.y = Math.round(fieldHeight * 0.5)
        }
      }

      player.velocityX = 0
      player.velocityY = 0
      player.state = 'idle'
    }
  }
}
