import { Schema, type, MapSchema } from '@colyseus/schema'

// Shared types
type Team = 'blue' | 'red'
type PlayerState = 'idle' | 'running' | 'kicking'
type GamePhase = 'waiting' | 'playing' | 'ended'

interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  timestamp: number
}

const GAME_CONFIG = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PLAYER_SPEED: 200,
  BALL_FRICTION: 0.98,
  SHOOT_SPEED: 400,
  PASS_SPEED: 300,
  POSSESSION_RADIUS: 30,
  TICK_RATE: 30,
  MATCH_DURATION: 120,
} as const

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

  reset() {
    this.x = GAME_CONFIG.FIELD_WIDTH / 2
    this.y = GAME_CONFIG.FIELD_HEIGHT / 2
    this.velocityX = 0
    this.velocityY = 0
    this.possessedBy = ''
  }
}

export class GameState extends Schema {
  @type('number') matchTime: number = 0
  @type('number') scoreBlue: number = 0
  @type('number') scoreRed: number = 0
  @type('string') phase: GamePhase = 'waiting'

  @type({ map: Player }) players = new MapSchema<Player>()
  @type(Ball) ball = new Ball()

  private playerCount = 0

  addPlayer(sessionId: string) {
    // Assign team (alternate between blue and red)
    const team: Team = this.playerCount % 2 === 0 ? 'blue' : 'red'

    // Starting positions
    const x = team === 'blue' ? 150 : GAME_CONFIG.FIELD_WIDTH - 150
    const y = GAME_CONFIG.FIELD_HEIGHT / 2

    const player = new Player(sessionId, team, x, y)
    this.players.set(sessionId, player)

    this.playerCount++
    console.log(`Added player ${sessionId} to team ${team}`)
  }

  removePlayer(sessionId: string) {
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

        // Update position
        player.x += player.velocityX * dt
        player.y += player.velocityY * dt

        // Clamp to field bounds
        player.x = Math.max(30, Math.min(GAME_CONFIG.FIELD_WIDTH - 30, player.x))
        player.y = Math.max(30, Math.min(GAME_CONFIG.FIELD_HEIGHT - 30, player.y))

        // Update state
        const moving = Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1
        player.state = moving ? 'running' : 'idle'

        if (moving) {
          player.direction = Math.atan2(input.movement.y, input.movement.x)
        }

        // Handle action (shoot/pass)
        if (input.action) {
          this.handlePlayerAction(player)
        }
      }
    })
  }

  updatePhysics(dt: number) {
    // Update ball physics
    this.ball.velocityX *= GAME_CONFIG.BALL_FRICTION
    this.ball.velocityY *= GAME_CONFIG.BALL_FRICTION

    // Stop if too slow
    if (Math.abs(this.ball.velocityX) < 1 && Math.abs(this.ball.velocityY) < 1) {
      this.ball.velocityX = 0
      this.ball.velocityY = 0
    }

    // Update position
    this.ball.x += this.ball.velocityX * dt
    this.ball.y += this.ball.velocityY * dt

    // Bounce off boundaries
    const margin = 20
    if (this.ball.x <= margin || this.ball.x >= GAME_CONFIG.FIELD_WIDTH - margin) {
      this.ball.velocityX *= -0.8
      this.ball.x = Math.max(margin, Math.min(GAME_CONFIG.FIELD_WIDTH - margin, this.ball.x))
    }

    if (this.ball.y <= margin || this.ball.y >= GAME_CONFIG.FIELD_HEIGHT - margin) {
      this.ball.velocityY *= -0.8
      this.ball.y = Math.max(margin, Math.min(GAME_CONFIG.FIELD_HEIGHT - margin, this.ball.y))
    }

    // Check ball possession
    this.updateBallPossession()

    // Check goals
    this.checkGoals()
  }

  private updateBallPossession() {
    this.players.forEach((player) => {
      const dx = this.ball.x - player.x
      const dy = this.ball.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
        // Player is close to ball
        if (this.ball.possessedBy === '') {
          this.ball.possessedBy = player.id
        }

        // Ball magnetism (stick to player)
        if (this.ball.velocityX === 0 && this.ball.velocityY === 0) {
          this.ball.x = player.x + (dx / dist) * 25
          this.ball.y = player.y + (dy / dist) * 25
        }
      }
    })
  }

  private handlePlayerAction(player: Player) {
    const dx = this.ball.x - player.x
    const dy = this.ball.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Only shoot if close to ball
    if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
      const power = 0.8
      this.ball.velocityX = (dx / dist) * GAME_CONFIG.SHOOT_SPEED * power
      this.ball.velocityY = (dy / dist) * GAME_CONFIG.SHOOT_SPEED * power
      this.ball.possessedBy = ''

      player.state = 'kicking'

      console.log(`Player ${player.id} kicked the ball!`)
    }
  }

  private checkGoals() {
    const goalY = { min: 200, max: 400 }

    // Left goal (blue defends)
    if (this.ball.x <= 30 && this.ball.y >= goalY.min && this.ball.y <= goalY.max) {
      this.onGoalScored('red')
    }

    // Right goal (red defends)
    if (this.ball.x >= GAME_CONFIG.FIELD_WIDTH - 30 && this.ball.y >= goalY.min && this.ball.y <= goalY.max) {
      this.onGoalScored('blue')
    }
  }

  private onGoalScored(team: Team) {
    console.log(`⚽ GOAL! Team ${team} scores!`)

    if (team === 'blue') {
      this.scoreBlue++
    } else {
      this.scoreRed++
    }

    // Reset ball to center
    this.ball.reset()
  }

  updateTimer(dt: number) {
    this.matchTime += dt
  }
}
