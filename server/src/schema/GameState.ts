import { Schema, type, MapSchema } from '@colyseus/schema'
import { GAME_CONFIG } from '@shared/types'

// Shared types
type Team = 'blue' | 'red'
type PlayerState = 'idle' | 'running' | 'kicking'
type GamePhase = 'waiting' | 'playing' | 'ended'

interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number // 0.0-1.0, power for shooting (optional, defaults to 0.8)
  timestamp: number
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

  // Server-side only
  inputQueue: PlayerInput[] = []
  kickingUntil: number = 0 // Timestamp when kicking state should end

  // AI-specific fields (client-side only, not synced)
  role?: 'defender' | 'forward'
  aiState?: string // Current AI behavior state
  targetPosition?: { x: number; y: number } // Target position for AI movement

  constructor(id: string, team: Team, x: number, y: number, isHuman: boolean = true, role?: 'defender' | 'forward') {
    super()
    this.id = id
    this.team = team
    this.x = x
    this.y = y
    this.isHuman = isHuman
    this.isControlled = isHuman // Human players are controlled by default, AI are not
    this.role = role
  }
}

export class Ball extends Schema {
  @type('number') x: number = GAME_CONFIG.FIELD_WIDTH / 2
  @type('number') y: number = GAME_CONFIG.FIELD_HEIGHT / 2
  @type('number') velocityX: number = 0
  @type('number') velocityY: number = 0
  @type('string') possessedBy: string = ''
  @type('number') pressureLevel: number = 0 // 0.0-1.0, how much pressure on current possessor

  // Server-side only: prevent immediate re-possession after shooting
  lastShotTime: number = 0
  lastShooter: string = ''
  inGoal: boolean = false // Server-side only: ball is frozen in goal net

  reset() {
    this.x = GAME_CONFIG.FIELD_WIDTH / 2
    this.y = GAME_CONFIG.FIELD_HEIGHT / 2
    this.velocityX = 0
    this.velocityY = 0
    this.possessedBy = ''
    this.pressureLevel = 0
    this.lastShotTime = 0
    this.lastShooter = ''
    this.inGoal = false
  }
}

export class GameState extends Schema {
  @type('number') matchTime: number = GAME_CONFIG.MATCH_DURATION // Countdown timer (matches client)
  @type('number') scoreBlue: number = 0
  @type('number') scoreRed: number = 0
  @type('string') phase: GamePhase = 'waiting'

  @type({ map: Player }) players = new MapSchema<Player>()
  @type(Ball) ball = new Ball()

  private goalScored: boolean = false // Prevent duplicate goal detection

  // Possession lockout tracking
  private lastPossessionGainTime = new Map<string, number>() // when each player last gained possession
  private lastPossessionLossTime = new Map<string, number>() // when each player last lost possession

  // AI control flag (disabled for test rooms)
  aiEnabled: boolean = true

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

    if (this.aiEnabled) {
      // AI enabled: spawn with 2 bots per team
      // Formation: human = forward (offensive), 2 bots = defenders (back)
      // Positions calculated relative to field size for symmetry

      if (team === 'blue') {
        // Blue team (left side): vertically symmetric formation
        const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.36)  // Forward closer to center
        const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.19) // Defenders near own goal

        const humanPlayer = new Player(
          sessionId,
          team,
          forwardX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5), // Center
          true,
          'forward'
        )
        const bot1 = new Player(
          `${sessionId}-bot1`,
          team,
          defenderX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25), // Top quarter
          false,
          'defender'
        )
        const bot2 = new Player(
          `${sessionId}-bot2`,
          team,
          defenderX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75), // Bottom quarter
          false,
          'defender'
        )

        this.players.set(sessionId, humanPlayer)
        this.players.set(`${sessionId}-bot1`, bot1)
        this.players.set(`${sessionId}-bot2`, bot2)

        console.log(`Added player ${sessionId} to team ${team} with 2 AI bots (current players: ${this.players.size})`)
      } else {
        // Red team (right side): vertically mirrored formation
        const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.64)  // Forward closer to center
        const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.81) // Defenders near own goal

        const humanPlayer = new Player(
          sessionId,
          team,
          forwardX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5), // Center
          true,
          'forward'
        )
        const bot1 = new Player(
          `${sessionId}-bot1`,
          team,
          defenderX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75), // Bottom quarter (mirrored)
          false,
          'defender'
        )
        const bot2 = new Player(
          `${sessionId}-bot2`,
          team,
          defenderX,
          Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25), // Top quarter (mirrored)
          false,
          'defender'
        )

        this.players.set(sessionId, humanPlayer)
        this.players.set(`${sessionId}-bot1`, bot1)
        this.players.set(`${sessionId}-bot2`, bot2)

        console.log(`Added player ${sessionId} to team ${team} with 2 AI bots (current players: ${this.players.size})`)
      }
    } else {
      // AI disabled (test mode): spawn human player only
      const x = team === 'blue' ? 360 : GAME_CONFIG.FIELD_WIDTH - 360
      const y = GAME_CONFIG.FIELD_HEIGHT / 2

      const humanPlayer = new Player(sessionId, team, x, y, true)
      this.players.set(sessionId, humanPlayer)

      console.log(`Added player ${sessionId} to team ${team} (AI disabled, current players: ${this.players.size})`)
    }
  }

  removePlayer(sessionId: string) {
    // Release ball possession if this player or their bots had it
    if (this.ball.possessedBy === sessionId ||
        this.ball.possessedBy === `${sessionId}-bot1` ||
        this.ball.possessedBy === `${sessionId}-bot2`) {
      this.ball.possessedBy = ''
      console.log(`⚽ [Server] Ball released (player ${sessionId} or bot left)`)
    }

    // Remove human player
    this.players.delete(sessionId)

    // Remove AI bots if AI is enabled
    if (this.aiEnabled) {
      this.players.delete(`${sessionId}-bot1`)
      this.players.delete(`${sessionId}-bot2`)
      console.log(`Removed player ${sessionId} and their AI bots (remaining players: ${this.players.size})`)
    } else {
      console.log(`Removed player ${sessionId} (remaining players: ${this.players.size})`)
    }
  }

  queueInput(sessionId: string, input: PlayerInput) {
    const player = this.players.get(sessionId)
    if (player) {
      player.inputQueue.push(input)
    }
  }

  processInputs(dt: number) {
    this.players.forEach((player) => {
      if (player.inputQueue.length > 0) {
        // Process latest input (discard old ones for now)
        const input = player.inputQueue[player.inputQueue.length - 1]
        player.inputQueue = []

        // Update velocity based on input
        player.velocityX = input.movement.x * GAME_CONFIG.PLAYER_SPEED
        player.velocityY = input.movement.y * GAME_CONFIG.PLAYER_SPEED

        const oldX = player.x
        const oldY = player.y

        // Update position
        player.x += player.velocityX * dt
        player.y += player.velocityY * dt

        // Clamp to field bounds
        player.x = Math.max(GAME_CONFIG.PLAYER_MARGIN, Math.min(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_MARGIN, player.x))
        player.y = Math.max(GAME_CONFIG.PLAYER_MARGIN, Math.min(GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_MARGIN, player.y))

        // DEBUG: Log significant movement (moved >1 pixel)
        const moved = Math.abs(player.x - oldX) > 1 || Math.abs(player.y - oldY) > 1
        if (moved) {
//           console.log(`🏃 [Server] Player ${player.id} moved: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`)
        }

        // Update state (but preserve 'kicking' state if still active)
        const now = Date.now()
        if (now < player.kickingUntil) {
          // Keep kicking state until timer expires
          // Still update direction for movement
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

        // Handle action (shoot/pass)
        if (input.action) {
          this.handlePlayerAction(player, input.actionPower)
        }
      }
    })
  }

  updatePhysics(dt: number) {
    // Handle ball possession first (before physics)
    this.updatePossessionPressure(dt)
    this.updateBallPossession()

    // Skip ball physics if in goal net (frozen until reset)
    if (this.ball.inGoal) {
      this.ball.velocityX = 0
      this.ball.velocityY = 0
      return
    }

    // Only update ball physics if NOT possessed
    if (this.ball.possessedBy === '') {
      // Update ball physics
      this.ball.velocityX *= GAME_CONFIG.BALL_FRICTION
      this.ball.velocityY *= GAME_CONFIG.BALL_FRICTION

      // Stop if too slow
      if (Math.abs(this.ball.velocityX) < 1 && Math.abs(this.ball.velocityY) < 1) {
        this.ball.velocityX = 0
        this.ball.velocityY = 0
      }

      // Store old position for delta logging
      const oldX = this.ball.x
      const oldY = this.ball.y

      // Update position
      this.ball.x += this.ball.velocityX * dt
      this.ball.y += this.ball.velocityY * dt

      // DEBUG: Log ball state mutations
      const moved = Math.abs(this.ball.x - oldX) > 0.5 || Math.abs(this.ball.y - oldY) > 0.5
      if (moved) {
//         console.log(`⚽ [Server Schema] Ball position mutated: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`)
      }

      // Bounce off boundaries (exclude goal zones)
      const margin = GAME_CONFIG.FIELD_MARGIN

      // Left/right boundaries (exclude goal zones where y is in goal range)
      if (this.ball.x <= margin && (this.ball.y < GAME_CONFIG.GOAL_Y_MIN || this.ball.y > GAME_CONFIG.GOAL_Y_MAX)) {
        this.ball.velocityX *= -0.8
        this.ball.x = margin
      }
      if (this.ball.x >= GAME_CONFIG.FIELD_WIDTH - margin && (this.ball.y < GAME_CONFIG.GOAL_Y_MIN || this.ball.y > GAME_CONFIG.GOAL_Y_MAX)) {
        this.ball.velocityX *= -0.8
        this.ball.x = GAME_CONFIG.FIELD_WIDTH - margin
      }

      // Top/bottom boundaries (always bounce)
      if (this.ball.y <= margin || this.ball.y >= GAME_CONFIG.FIELD_HEIGHT - margin) {
        this.ball.velocityY *= -0.8
        this.ball.y = Math.max(margin, Math.min(GAME_CONFIG.FIELD_HEIGHT - margin, this.ball.y))
      }
    }

    // Check goals (even when possessed)
    this.checkGoals()
  }

  private updatePossessionPressure(dt: number) {
    // Only apply pressure if someone has possession
    if (this.ball.possessedBy === '') {
      // No possession - reset pressure
      this.ball.pressureLevel = 0
      return
    }

    const possessor = this.players.get(this.ball.possessedBy)
    if (!possessor) {
      this.ball.pressureLevel = 0
      return
    }

    // Count opponents within pressure radius of the BALL (not the player)
    let opponentsNearby = 0
    let nearestOpponent: Player | null = null
    let nearestOpponentDist = Infinity

    this.players.forEach((player) => {
      if (player.id === possessor.id) return // Skip possessor

      // Calculate distance from opponent to BALL
      const dx = player.x - this.ball.x
      const dy = player.y - this.ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < GAME_CONFIG.PRESSURE_RADIUS && player.team !== possessor.team) {
        opponentsNearby++
        // Track nearest pressuring opponent for ball transfer
        if (dist < nearestOpponentDist) {
          nearestOpponent = player
          nearestOpponentDist = dist
        }
      }
    })

    // Store previous pressure for change detection
    const previousPressure = this.ball.pressureLevel

    // Update pressure level based on opponents nearby
    if (opponentsNearby > 0) {
      // Build up pressure
      const pressureIncrease = GAME_CONFIG.PRESSURE_BUILDUP_RATE * dt * opponentsNearby
      const newPressure = Math.min(
        GAME_CONFIG.PRESSURE_RELEASE_THRESHOLD,
        this.ball.pressureLevel + pressureIncrease
      )

//       console.log(`📈 [Pressure] Building:`)
//       console.log(`   Previous: ${previousPressure.toFixed(4)} | New: ${newPressure.toFixed(4)} | Increase: ${pressureIncrease.toFixed(4)}`)
//       console.log(`   Buildup Rate: ${GAME_CONFIG.PRESSURE_BUILDUP_RATE} | dt: ${dt.toFixed(4)}s | Opponents: ${opponentsNearby}`)
//       console.log(`   Calculation: ${GAME_CONFIG.PRESSURE_BUILDUP_RATE} × ${dt.toFixed(4)} × ${opponentsNearby} = ${pressureIncrease.toFixed(4)}`)

      this.ball.pressureLevel = newPressure
    } else {
      // Decay pressure when no opponents nearby
      const pressureDecrease = GAME_CONFIG.PRESSURE_DECAY_RATE * dt
      const newPressure = Math.max(0, this.ball.pressureLevel - pressureDecrease)

      if (previousPressure > 0) {
//         console.log(`📉 [Pressure] Decaying:`)
//         console.log(`   Previous: ${previousPressure.toFixed(4)} | New: ${newPressure.toFixed(4)} | Decrease: ${pressureDecrease.toFixed(4)}`)
//         console.log(`   Decay Rate: ${GAME_CONFIG.PRESSURE_DECAY_RATE} | dt: ${dt.toFixed(4)}s`)
      }

      this.ball.pressureLevel = newPressure
    }

    // Check if pressure threshold reached - transfer possession
    if (this.ball.pressureLevel >= GAME_CONFIG.PRESSURE_RELEASE_THRESHOLD) {
      // Check capture lockout - can't lose possession within 300ms of gaining it
      const timeSinceCapture = Date.now() - (this.lastPossessionGainTime.get(possessor.id) || 0)
      if (timeSinceCapture < GAME_CONFIG.CAPTURE_LOCKOUT_MS) {
//         console.log(`🛡️ [Lockout] Player ${possessor.id} protected by capture lockout (${(GAME_CONFIG.CAPTURE_LOCKOUT_MS - timeSinceCapture).toFixed(0)}ms remaining)`)
        return // Don't release possession during lockout
      }

      // Transfer possession to nearest pressuring opponent
      if (nearestOpponent !== null) {
        const opponent: Player = nearestOpponent
//         console.log(`⚡ [Pressure] Ball transferred from ${possessor.id} to ${opponent.id} (dist: ${nearestOpponentDist.toFixed(1)}px, ${opponentsNearby} opponents nearby)`)

        // Record loss time for old possessor
        this.lastPossessionLossTime.set(possessor.id, Date.now())

        // Transfer to new possessor
        this.ball.possessedBy = opponent.id
        this.lastPossessionGainTime.set(opponent.id, Date.now())
        this.ball.pressureLevel = 0
      } else {
        // Fallback: release if no opponent nearby (shouldn't happen)
//         console.log(`⚡ [Pressure] Ball released from ${possessor.id} (no opponent to transfer to)`)
        this.ball.possessedBy = ''
        this.ball.pressureLevel = 0
        this.lastPossessionLossTime.set(possessor.id, Date.now())
      }
    }
  }

  private updateBallPossession() {
    // First, check if current possessor is still close enough
    if (this.ball.possessedBy !== '') {
      const possessor = this.players.get(this.ball.possessedBy)
      if (possessor) {
        const dx = this.ball.x - possessor.x
        const dy = this.ball.y - possessor.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Release possession if player moves too far from ball
        // Use slightly larger threshold than capture radius to prevent oscillation
        const releaseThreshold = GAME_CONFIG.POSSESSION_RADIUS + 10
        if (dist > releaseThreshold) {
//           console.log(`⚠️ [Server] Possession released - too far (${dist.toFixed(1)}px > ${releaseThreshold}px)`)
          this.ball.possessedBy = ''
          // Record loss time for loss lockout
          this.lastPossessionLossTime.set(possessor.id, Date.now())
        } else {
          // Apply continuous magnetism - ball sticks in front of player
          // Position ball 25px in front of player in the direction they're facing
          const offsetDistance = 25
          const ballX = possessor.x + Math.cos(possessor.direction) * offsetDistance
          const ballY = possessor.y + Math.sin(possessor.direction) * offsetDistance

          // Only log if ball actually moved (reduce spam)
          const moved = Math.abs(this.ball.x - ballX) > 0.1 || Math.abs(this.ball.y - ballY) > 0.1
          if (moved) {
//             console.log(`🧲 [Server] Magnetism: ball follows player ${possessor.id} at (${ballX.toFixed(1)}, ${ballY.toFixed(1)})`)
          }

          this.ball.x = ballX
          this.ball.y = ballY

          // Clear ball velocity while possessed (moves with player)
          this.ball.velocityX = 0
          this.ball.velocityY = 0
        }
      } else {
        // Possessor no longer exists, release ball
        console.log(`⚠️ [Server] Possession released - player disconnected`)
        this.ball.possessedBy = ''
      }
    }

    // Check for new possession if ball is free
    if (this.ball.possessedBy === '') {
      // Immunity period after shooting (300ms)
      const SHOT_IMMUNITY_MS = 300
      const timeSinceShot = Date.now() - this.ball.lastShotTime
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS

      this.players.forEach((player) => {
        // Skip if ball already possessed (first-come-first-served)
        if (this.ball.possessedBy !== '') return

        // Skip shooter during immunity period to prevent immediate re-possession
        if (hasImmunity && player.id === this.ball.lastShooter) {
          return
        }

        const dx = this.ball.x - player.x
        const dy = this.ball.y - player.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
          // Check loss lockout - can't capture within 300ms of losing possession
          const timeSinceLoss = Date.now() - (this.lastPossessionLossTime.get(player.id) || 0)
          if (timeSinceLoss < GAME_CONFIG.LOSS_LOCKOUT_MS) {
//             console.log(`🚫 [Lockout] Player ${player.id} blocked by loss lockout (${(GAME_CONFIG.LOSS_LOCKOUT_MS - timeSinceLoss).toFixed(0)}ms remaining)`)
            return
          }

          // Player gains possession
          this.ball.possessedBy = player.id
          this.lastPossessionGainTime.set(player.id, Date.now())
//           console.log(`✅ [Server] Player ${player.id} GAINED possession at dist=${dist.toFixed(1)}px`)
        }
      })
    }
  }

  private handlePlayerAction(player: Player, actionPower?: number) {
    // Check if this player has possession
    if (this.ball.possessedBy === player.id) {
      // Shoot in the direction player is facing
      // Use client-provided power if available, otherwise default to 0.8
      const power = actionPower !== undefined ? actionPower : 0.8
      const dx = Math.cos(player.direction)
      const dy = Math.sin(player.direction)

      // Interpolate between min and max shoot speed based on power
      const speed = GAME_CONFIG.MIN_SHOOT_SPEED + (GAME_CONFIG.SHOOT_SPEED - GAME_CONFIG.MIN_SHOOT_SPEED) * power

      this.ball.velocityX = dx * speed
      this.ball.velocityY = dy * speed
      this.ball.possessedBy = ''

      // Set shoot immunity to prevent immediate re-possession
      this.ball.lastShotTime = Date.now()
      this.ball.lastShooter = player.id

      // Record loss time for loss lockout (shooting counts as losing possession)
      this.lastPossessionLossTime.set(player.id, Date.now())

      // Set kicking state for 300ms
      player.state = 'kicking'
      player.kickingUntil = Date.now() + 300

      // DEBUG: Log ball physics update
//       console.log(`⚽ [Server] Ball kicked by ${player.id}!`)
//       console.log(`   Direction: ${player.direction.toFixed(2)} rad (${(player.direction * 180 / Math.PI).toFixed(1)}°)`)
//       console.log(`   Position: (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`)
//       console.log(`   Velocity: (${this.ball.velocityX.toFixed(1)}, ${this.ball.velocityY.toFixed(1)})`)
    } else {
      // Try to gain possession first if close enough
      const dx = this.ball.x - player.x
      const dy = this.ball.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Check immunity period (same as updateBallPossession)
      const SHOT_IMMUNITY_MS = 300
      const timeSinceShot = Date.now() - this.ball.lastShotTime
      const hasImmunity = timeSinceShot < SHOT_IMMUNITY_MS
      const isShooter = player.id === this.ball.lastShooter

      if (dist < GAME_CONFIG.POSSESSION_RADIUS && this.ball.possessedBy === '' && !(hasImmunity && isShooter)) {
        // Check loss lockout - can't capture within 300ms of losing possession
        const timeSinceLoss = Date.now() - (this.lastPossessionLossTime.get(player.id) || 0)
        if (timeSinceLoss < GAME_CONFIG.LOSS_LOCKOUT_MS) {
//           console.log(`🚫 [Lockout] Player ${player.id} blocked by loss lockout via action (${(GAME_CONFIG.LOSS_LOCKOUT_MS - timeSinceLoss).toFixed(0)}ms remaining)`)
          return
        }

        // Gain possession
        this.ball.possessedBy = player.id
        this.lastPossessionGainTime.set(player.id, Date.now())
//         console.log(`🏀 [Server] Player ${player.id} gained possession via action (dist: ${dist.toFixed(1)}px)`)
      } else {
        if (hasImmunity && isShooter) {
//           console.log(`⚠️ [Server] Player ${player.id} blocked by shoot immunity (${(SHOT_IMMUNITY_MS - timeSinceShot).toFixed(0)}ms remaining)`)
        } else {
//           console.log(`⚠️ [Server] Player ${player.id} tried to shoot but doesn't have possession (dist: ${dist.toFixed(1)}px, possessed by: ${this.ball.possessedBy || 'none'})`)
        }
      }
    }
  }

  private checkGoals() {
    // Skip if goal already scored this frame
    if (this.goalScored) {
      return
    }

    // Left goal (red scores when ENTIRE ball crosses left field boundary)
    // Ball must be completely past the line: ball.x + radius < FIELD_MARGIN
    if (
      this.ball.x + GAME_CONFIG.BALL_RADIUS < GAME_CONFIG.FIELD_MARGIN &&
      this.ball.y >= GAME_CONFIG.GOAL_Y_MIN &&
      this.ball.y <= GAME_CONFIG.GOAL_Y_MAX
    ) {
      this.ball.inGoal = true // Freeze ball in net
      this.onGoalScored('red')
      return
    }

    // Right goal (blue scores when ENTIRE ball crosses right field boundary)
    // Ball must be completely past the line: ball.x - radius > FIELD_WIDTH - FIELD_MARGIN
    if (
      this.ball.x - GAME_CONFIG.BALL_RADIUS > GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.FIELD_MARGIN &&
      this.ball.y >= GAME_CONFIG.GOAL_Y_MIN &&
      this.ball.y <= GAME_CONFIG.GOAL_Y_MAX
    ) {
      this.ball.inGoal = true // Freeze ball in net
      this.onGoalScored('blue')
    }
  }

  private resetPlayers() {
    this.players.forEach((player, sessionId) => {
      // Reset to formation positions based on team and player type (relative to field size)
      if (player.team === 'blue') {
        const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.36)
        const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.19)

        if (sessionId.endsWith('-bot1')) {
          // Blue defender bot (top)
          player.x = defenderX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25)
        } else if (sessionId.endsWith('-bot2')) {
          // Blue defender bot (bottom)
          player.x = defenderX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75)
        } else {
          // Blue human forward (center)
          player.x = forwardX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5)
        }
      } else {
        const forwardX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.64)
        const defenderX = Math.round(GAME_CONFIG.FIELD_WIDTH * 0.81)

        if (sessionId.endsWith('-bot1')) {
          // Red defender bot (bottom - mirrored)
          player.x = defenderX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.75)
        } else if (sessionId.endsWith('-bot2')) {
          // Red defender bot (top - mirrored)
          player.x = defenderX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.25)
        } else {
          // Red human forward (center)
          player.x = forwardX
          player.y = Math.round(GAME_CONFIG.FIELD_HEIGHT * 0.5)
        }
      }

      // Reset velocity and state
      player.velocityX = 0
      player.velocityY = 0
      player.state = 'idle'

      console.log(`🔄 Reset player ${sessionId} (${player.team}) to starting position (${player.x}, ${player.y})`)
    })
  }

  private onGoalScored(team: Team) {
    console.log(`⚽ GOAL! Team ${team} scores!`)

    // Set flag to prevent duplicate detection
    this.goalScored = true

    if (team === 'blue') {
      this.scoreBlue++
    } else {
      this.scoreRed++
    }

    // Reset players immediately
    this.resetPlayers()

    // Reset ball to center after 1 second delay (ball stays in net until then)
    setTimeout(() => {
      this.ball.reset() // This also sets inGoal = false
      this.goalScored = false
      // Clear possession lockout timers for fresh kickoff
      this.lastPossessionGainTime.clear()
      this.lastPossessionLossTime.clear()
      console.log('🔄 Ball reset to center, possession lockouts cleared for kickoff')
    }, 1000)
  }

  updateTimer(dt: number) {
    // Countdown timer (matches client implementation)
    this.matchTime -= dt
    if (this.matchTime < 0) {
      this.matchTime = 0
    }
  }
}
