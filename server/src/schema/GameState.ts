import { Schema, type, MapSchema } from '@colyseus/schema'
import { GAME_CONFIG } from '@socca2/shared'

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

  constructor(id: string, team: Team, x: number, y: number) {
    super()
    this.id = id
    this.team = team
    this.x = x
    this.y = y
    this.isControlled = true // For now, each player controls themselves
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

  reset() {
    this.x = GAME_CONFIG.FIELD_WIDTH / 2
    this.y = GAME_CONFIG.FIELD_HEIGHT / 2
    this.velocityX = 0
    this.velocityY = 0
    this.possessedBy = ''
    this.pressureLevel = 0
    this.lastShotTime = 0
    this.lastShooter = ''
  }
}

export class GameState extends Schema {
  @type('number') matchTime: number = GAME_CONFIG.MATCH_DURATION // Countdown timer (matches client)
  @type('number') scoreBlue: number = 0
  @type('number') scoreRed: number = 0
  @type('string') phase: GamePhase = 'waiting'

  @type({ map: Player }) players = new MapSchema<Player>()
  @type(Ball) ball = new Ball()

  private playerCount = 0
  private goalScored: boolean = false // Prevent duplicate goal detection

  addPlayer(sessionId: string) {
    // Assign team (alternate between blue and red)
    const team: Team = this.playerCount % 2 === 0 ? 'blue' : 'red'

    // Starting positions (proportional to 1920x1080)
    const x = team === 'blue' ? 360 : GAME_CONFIG.FIELD_WIDTH - 360
    const y = GAME_CONFIG.FIELD_HEIGHT / 2

    const player = new Player(sessionId, team, x, y)
    this.players.set(sessionId, player)

    this.playerCount++
    console.log(`Added player ${sessionId} to team ${team}`)
  }

  removePlayer(sessionId: string) {
    // Release ball possession if this player had it
    if (this.ball.possessedBy === sessionId) {
      this.ball.possessedBy = ''
      console.log(`⚽ [Server] Ball released (player ${sessionId} left)`)
    }

    this.players.delete(sessionId)
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
          console.log(`🏃 [Server] Player ${player.id} moved: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`)
        }

        // Update state
        const moving = Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1
        player.state = moving ? 'running' : 'idle'

        if (moving) {
          player.direction = Math.atan2(input.movement.y, input.movement.x)
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
        console.log(`⚽ [Server Schema] Ball position mutated: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) → (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`)
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

    // Count opponents and teammates within pressure radius
    let opponentsNearby = 0
    let teammatesNearby = 0

    this.players.forEach((player) => {
      if (player.id === possessor.id) return // Skip possessor

      const dx = player.x - possessor.x
      const dy = player.y - possessor.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < GAME_CONFIG.PRESSURE_RADIUS) {
        if (player.team === possessor.team) {
          teammatesNearby++
        } else {
          opponentsNearby++
        }
      }
    })

    // Calculate effective pressure
    // Each opponent adds pressure, teammates reduce it
    const rawPressure = opponentsNearby - (teammatesNearby * GAME_CONFIG.TEAMMATE_PRESSURE_REDUCTION)
    const effectivePressure = Math.max(0, rawPressure)

    // Update pressure level based on effective pressure
    if (effectivePressure > 0) {
      // Build up pressure
      const pressureIncrease = GAME_CONFIG.PRESSURE_BUILDUP_RATE * dt * effectivePressure
      this.ball.pressureLevel = Math.min(
        GAME_CONFIG.PRESSURE_RELEASE_THRESHOLD,
        this.ball.pressureLevel + pressureIncrease
      )
    } else {
      // Decay pressure when no opponents nearby
      const pressureDecrease = GAME_CONFIG.PRESSURE_DECAY_RATE * dt
      this.ball.pressureLevel = Math.max(0, this.ball.pressureLevel - pressureDecrease)
    }

    // Check if pressure threshold reached - release possession
    if (this.ball.pressureLevel >= GAME_CONFIG.PRESSURE_RELEASE_THRESHOLD) {
      console.log(`⚡ [Pressure] Ball released from ${possessor.id} due to pressure (${opponentsNearby} opponents nearby)`)
      this.ball.possessedBy = ''
      this.ball.pressureLevel = 0
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
        if (dist > 50) {
          console.log(`⚠️ [Server] Possession released - too far (${dist.toFixed(1)}px)`)
          this.ball.possessedBy = ''
        } else {
          // Apply continuous magnetism - ball sticks in front of player
          // Position ball 25px in front of player in the direction they're facing
          const offsetDistance = 25
          const ballX = possessor.x + Math.cos(possessor.direction) * offsetDistance
          const ballY = possessor.y + Math.sin(possessor.direction) * offsetDistance

          // Only log if ball actually moved (reduce spam)
          const moved = Math.abs(this.ball.x - ballX) > 0.1 || Math.abs(this.ball.y - ballY) > 0.1
          if (moved) {
            console.log(`🧲 [Server] Magnetism: ball follows player ${possessor.id} at (${ballX.toFixed(1)}, ${ballY.toFixed(1)})`)
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
          // Player gains possession
          this.ball.possessedBy = player.id
          console.log(`✅ [Server] Player ${player.id} GAINED possession at dist=${dist.toFixed(1)}px`)
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

      this.ball.velocityX = dx * GAME_CONFIG.SHOOT_SPEED * power
      this.ball.velocityY = dy * GAME_CONFIG.SHOOT_SPEED * power
      this.ball.possessedBy = ''

      // Set shoot immunity to prevent immediate re-possession
      this.ball.lastShotTime = Date.now()
      this.ball.lastShooter = player.id

      player.state = 'kicking'

      // DEBUG: Log ball physics update
      console.log(`⚽ [Server] Ball kicked by ${player.id}!`)
      console.log(`   Direction: ${player.direction.toFixed(2)} rad (${(player.direction * 180 / Math.PI).toFixed(1)}°)`)
      console.log(`   Position: (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`)
      console.log(`   Velocity: (${this.ball.velocityX.toFixed(1)}, ${this.ball.velocityY.toFixed(1)})`)
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
        // Gain possession
        this.ball.possessedBy = player.id
        console.log(`🏀 [Server] Player ${player.id} gained possession via action (dist: ${dist.toFixed(1)}px)`)
      } else {
        if (hasImmunity && isShooter) {
          console.log(`⚠️ [Server] Player ${player.id} blocked by shoot immunity (${(SHOT_IMMUNITY_MS - timeSinceShot).toFixed(0)}ms remaining)`)
        } else {
          console.log(`⚠️ [Server] Player ${player.id} tried to shoot but doesn't have possession (dist: ${dist.toFixed(1)}px, possessed by: ${this.ball.possessedBy || 'none'})`)
        }
      }
    }
  }

  private checkGoals() {
    // Skip if goal already scored this frame
    if (this.goalScored) {
      return
    }

    // Left goal (red scores when ball enters left goal)
    if (
      this.ball.x <= GAME_CONFIG.FIELD_MARGIN + GAME_CONFIG.GOAL_WIDTH &&
      this.ball.y >= GAME_CONFIG.GOAL_Y_MIN &&
      this.ball.y <= GAME_CONFIG.GOAL_Y_MAX
    ) {
      this.onGoalScored('red')
      return
    }

    // Right goal (blue scores when ball enters right goal)
    if (
      this.ball.x >= GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.FIELD_MARGIN - GAME_CONFIG.GOAL_WIDTH &&
      this.ball.y >= GAME_CONFIG.GOAL_Y_MIN &&
      this.ball.y <= GAME_CONFIG.GOAL_Y_MAX
    ) {
      this.onGoalScored('blue')
    }
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

    // Reset ball to center after 1 second delay
    setTimeout(() => {
      this.ball.reset()
      this.goalScored = false
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
