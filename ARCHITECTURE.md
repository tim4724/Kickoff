# Kickoff - System Architecture
## Technical Design Document

**Document status:** Contains historical/aspirational sections (e.g., 5v5 scope, database layer, placeholder physics values). Current shipped game is 3v3 (1 human + 2 AI bots per team), unified 1920×1080 coordinates, 30 Hz tick rate, and uses the constants in `shared/src/types.ts`. For latest commands and testing flow, see `AGENTS.md`, `README.md`, and `QUICKSTART.md`.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Mobile Browser (PWA)                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Phaser 3   │  │    Input     │  │   UI Layer   │  │   │
│  │  │   Renderer   │  │   Handler    │  │  (HUD/Menu)  │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │   │
│  │         │                  │                             │   │
│  │         └──────────┬───────┘                             │   │
│  │                    │                                     │   │
│  │         ┌──────────▼────────────┐                        │   │
│  │         │   Game State Manager  │                        │   │
│  │         │  (Client Prediction)  │                        │   │
│  │         └──────────┬────────────┘                        │   │
│  │                    │                                     │   │
│  │         ┌──────────▼────────────┐                        │   │
│  │         │  Colyseus Client SDK  │                        │   │
│  │         │    (WebSocket)        │                        │   │
│  │         └──────────┬────────────┘                        │   │
│  └────────────────────┼─────────────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────────┬─┘
                         │                                       │
                    WebSocket (Binary)                           │
                         │                                       │
┌────────────────────────▼───────────────────────────────────────▼┐
│                      SERVER LAYER                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Colyseus Game Server                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ Match Room 1 │  │ Match Room 2 │  │ Match Room N │    │ │
│  │  │   (10 max)   │  │   (10 max)   │  │   (10 max)   │    │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │ │
│  │         │                  │                  │            │ │
│  │         └──────────┬───────┴──────────────────┘            │ │
│  │                    │                                       │ │
│  │         ┌──────────▼────────────┐                          │ │
│  │         │  Game Logic Engine    │                          │ │
│  │         │  - Physics Sim        │                          │ │
│  │         │  - AI Controller      │                          │ │
│  │         │  - State Authority    │                          │ │
│  │         └──────────┬────────────┘                          │ │
│  └────────────────────┼───────────────────────────────────────┘ │
│                       │                                          │
│         ┌─────────────▼────────────┐                            │
│         │   Matchmaking Service    │                            │
│         └─────────────┬────────────┘                            │
└───────────────────────┼──────────────────────────────────────┬──┘
                        │                                       │
                   HTTP/REST                                    │
                        │                                       │
┌───────────────────────▼───────────────────────────────────────▼─┐
│                     DATABASE LAYER                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   PostgreSQL     │  │   Redis Cache    │  │  File Storage │ │
│  │  (User Data)     │  │  (Sessions)      │  │   (Assets)    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### Client Layer Components

#### 1. Phaser 3 Dual Camera Renderer
**Responsibility:** Visual presentation with unified coordinate system and responsive rendering

**Coordinate System:**
- Unified 1920x1080 coordinate space across client, server, and physics
- Game world uses fixed 1920x1080 coordinates (GAME_CONFIG.FIELD_WIDTH/HEIGHT)
- UI layer adapts to actual screen size with fullscreen rendering

**Rendering Architecture:**
- **Scale Mode:** RESIZE (fullscreen with dynamic viewport)
- **Dual Camera System:**
  - `gameCamera`: Fixed 1920x1080 bounds, centered viewport with letterboxing, dynamic zoom
  - `uiCamera`: Full screen coverage for controls and HUD
- **Letterboxing:** Automatic horizontal/vertical bars for non-16:9 aspect ratios
- **Touch Support:** UI elements (joystick, buttons) work in letterbox areas via uiCamera

**Key Classes:**
```typescript
class GameScene extends Phaser.Scene {
  // Dual camera properties
  private gameCamera: Phaser.Cameras.Scene2D.Camera  // Game world (1920x1080)
  private uiCamera: Phaser.Cameras.Scene2D.Camera    // UI layer (fullscreen)
  private gameObjects: Phaser.GameObjects.GameObject[] = []
  private uiObjects: Phaser.GameObjects.GameObject[] = []

  // Game entities
  players: Map<string, PlayerSprite>
  ball: BallSprite
  field: FieldBackground

  private setupCameras() {
    // Reuse main camera as game camera
    this.gameCamera = this.cameras.main
    this.gameCamera.setBounds(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT)

    // Create UI camera for fullscreen
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)

    // Configure camera ignore lists
    this.gameCamera.ignore(this.uiObjects)
    this.uiCamera.ignore(this.gameObjects)

    this.updateGameCameraViewport()
    this.scale.on('resize', this.onResize, this)
  }

  private updateGameCameraViewport() {
    const screenWidth = this.scale.width
    const screenHeight = this.scale.height
    const targetAspect = GAME_CONFIG.FIELD_WIDTH / GAME_CONFIG.FIELD_HEIGHT // 16:9

    let viewportX = 0, viewportY = 0
    let viewportWidth = screenWidth, viewportHeight = screenHeight

    if (screenWidth / screenHeight > targetAspect) {
      // Screen wider than 16:9 → vertical letterboxing
      viewportHeight = screenHeight
      viewportWidth = screenHeight * targetAspect
      viewportX = (screenWidth - viewportWidth) / 2
    } else {
      // Screen taller than 16:9 → horizontal letterboxing
      viewportWidth = screenWidth
      viewportHeight = screenWidth / targetAspect
      viewportY = (screenHeight - viewportHeight) / 2
    }

    this.gameCamera.setViewport(viewportX, viewportY, viewportWidth, viewportHeight)

    // Calculate zoom to fit game world into viewport
    const zoomX = viewportWidth / GAME_CONFIG.FIELD_WIDTH
    const zoomY = viewportHeight / GAME_CONFIG.FIELD_HEIGHT
    const zoom = Math.min(zoomX, zoomY)
    this.gameCamera.setZoom(zoom)
  }

  update(delta: number) {
    // Interpolate positions from network state
    // Render sprites at interpolated positions (in 1920x1080 coordinates)
  }
}

class PlayerSprite extends Phaser.GameObjects.Sprite {
  // Visual representation of player
  playerId: string
  teamId: 'blue' | 'red'
  isControlled: boolean // Highlight if currently controlled

  setControlled(controlled: boolean) {
    // Visual feedback for cursor switching
  }
}
```

**Rendering Pipeline:**
1. Receive state update from network layer
2. Store in interpolation buffer (2-3 past states)
3. Interpolate between states for smooth motion
4. Render sprites at calculated positions
5. Apply animations based on player state (idle/run/kick)

**Performance Optimizations:**
- Sprite pooling (reuse objects instead of create/destroy)
- Texture atlases (single sprite sheet for all players)
- Frustum culling (don't render off-screen entities)
- Fixed time step for physics (decouple from render FPS)

---

#### 2. Input Handler
**Responsibility:** Capture and process user input

**Implementation:**
```typescript
class InputController {
  joystick: VirtualJoystick
  actionButton: ActionButton

  getInput(): PlayerInput {
    return {
      movement: this.joystick.getVector(), // {x, y} normalized
      action: this.actionButton.isPressed(),
      timestamp: Date.now()
    }
  }
}

interface PlayerInput {
  movement: { x: number, y: number } // -1 to 1 range
  action: boolean // pass/shoot button state
  timestamp: number // client timestamp for lag compensation
}
```

**Virtual Joystick Design:**
- Touch zone: 150×150px in bottom-left corner
- Deadzone: 20% center (prevent drift)
- Max range: 60px from center
- Visual feedback: Transparent overlay + stick sprite

**Action Button:**
- Touch zone: 100×100px in bottom-right corner
- Hold detection: Charge shot power (0-1.5s)
- Visual feedback: Pulse effect on press

---

#### 3. Game State Manager (Client)
**Responsibility:** Maintain local game state and predict future state

**State Adapter Pattern:**
The client uses a unified state interface to work with game state from different sources (GameEngine for SinglePlayer/AIOnly, NetworkManager for Multiplayer). This eliminates code duplication and simplifies scene implementation.

```typescript
// Unified state interface - used by all scenes
interface UnifiedGameState {
  players: Map<string, UnifiedPlayerData>
  ball: UnifiedBallData
  scoreBlue: number
  scoreRed: number
  matchTime: number
  phase: 'waiting' | 'kickoff' | 'playing' | 'goal' | 'ended'
}

interface UnifiedPlayerData {
  id: string
  team: Team
  isHuman: boolean
  isControlled: boolean
  x: number              // Flat structure (not nested)
  y: number
  velocityX: number
  velocityY: number
  state: 'idle' | 'running' | 'kicking'
  direction: number
  role?: 'defender' | 'forward'
}

// StateAdapter converts between formats
class StateAdapter {
  // Convert GameEngine state (flat: player.x, ball.x)
  static fromGameEngine(state: GameEngineState): UnifiedGameState {
    const unifiedPlayers = new Map<string, UnifiedPlayerData>()
    state.players.forEach((player, id) => {
      unifiedPlayers.set(id, {
        id: player.id,
        team: player.team,
        x: player.x,           // Already flat
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        // ... other fields
      })
    })
    return { players: unifiedPlayers, ball: {...}, ... }
  }

  // Convert NetworkManager state (nested: player.position.x, ball.position.x)
  static fromNetwork(state: GameStateData): UnifiedGameState {
    const unifiedPlayers = new Map<string, UnifiedPlayerData>()
    state.players.forEach((player, id) => {
      unifiedPlayers.set(id, {
        id: player.id,
        team: player.team,
        x: player.position.x,  // Flatten nested structure
        y: player.position.y,
        velocityX: player.velocity.x,
        velocityY: player.velocity.y,
        // ... other fields
      })
    })
    return { players: unifiedPlayers, ball: {...}, ... }
  }

  // Helper methods for common operations
  static getPlayerTeam(state: UnifiedGameState, playerId: string): Team | null
  static getTeammateIds(state: UnifiedGameState, myPlayerId: string): string[]
  static findBestInterceptor(state: UnifiedGameState, teammateIds: string[]): string | null
}

// Scenes implement a single abstract method
abstract class BaseGameScene {
  protected abstract getUnifiedState(): UnifiedGameState | null

  // Common logic uses unified state (no duplication)
  protected checkAutoSwitchOnPossession() {
    const state = this.getUnifiedState()
    if (!state) return

    const myTeam = StateAdapter.getPlayerTeam(state, this.myPlayerId)
    // ... auto-switching logic works for all scenes
  }
}

// SinglePlayerScene - simple conversion
class SinglePlayerScene extends BaseGameScene {
  protected getUnifiedState() {
    return StateAdapter.fromGameEngine(this.gameEngine.getState())
  }
}

// GameScene - simple conversion
class GameScene extends BaseGameScene {
  protected getUnifiedState() {
    const networkState = this.networkManager?.getState()
    return networkState ? StateAdapter.fromNetwork(networkState) : null
  }
}
```

**Benefits:**
- Eliminates ~145 lines of duplicate code across scenes
- Single source of truth for state access patterns
- Type-safe conversion between state formats
- Simplified scene implementations (4 abstract methods → 1)
- Team-agnostic auto-switching (works for any team color)

**Client-Side Prediction:**
```typescript
class ClientStateManager {
  serverState: GameState // Last confirmed state from server
  predictedState: GameState // Client's prediction
  inputBuffer: PlayerInput[] // Pending inputs not yet confirmed

  applyInput(input: PlayerInput) {
    // 1. Apply input immediately to predicted state
    this.predictedState.applyInput(this.myPlayerId, input)

    // 2. Send input to server
    this.networkClient.sendInput(input)

    // 3. Store in buffer for reconciliation
    this.inputBuffer.push(input)
  }

  onServerUpdate(state: GameState, lastProcessedInput: number) {
    // 1. Update server state
    this.serverState = state

    // 2. Remove confirmed inputs from buffer
    this.inputBuffer = this.inputBuffer.filter(
      input => input.timestamp > lastProcessedInput
    )

    // 3. Reconcile prediction
    this.predictedState = state.clone()
    this.inputBuffer.forEach(input => {
      this.predictedState.applyInput(this.myPlayerId, input)
    })
  }
}
```

**State Interpolation (Other Players):**
```typescript
class StateInterpolator {
  stateBuffer: GameState[] // Last 3 states (150ms history)

  getInterpolatedState(renderTime: number): GameState {
    // Render 100ms in the past for smooth interpolation
    const targetTime = renderTime - 100

    // Find two states to interpolate between
    const [older, newer] = this.findBracketingStates(targetTime)

    // Linear interpolation
    const t = (targetTime - older.timestamp) / (newer.timestamp - older.timestamp)
    return this.lerp(older, newer, t)
  }
}
```

---

#### 4. Colyseus Client SDK
**Responsibility:** Network communication with server

**Connection Flow:**
```typescript
import { Client, Room } from 'colyseus.js'

class NetworkClient {
  client: Client
  room: Room<GameState>

  async joinMatch() {
    this.client = new Client('wss://your-server.com')

    // Join or create match room
    this.room = await this.client.joinOrCreate<GameState>('match')

    // Listen for state updates
    this.room.onStateChange((state) => {
      this.gameStateManager.onServerUpdate(state)
    })

    // Listen for individual player updates (delta compression)
    this.room.state.players.onAdd = (player, key) => {
      console.log('Player joined:', key)
    }

    this.room.state.players.onChange = (player, key) => {
      // Delta update for specific player
      this.gameStateManager.updatePlayer(key, player)
    }
  }

  sendInput(input: PlayerInput) {
    this.room.send('input', input)
  }
}
```

**Message Types:**

| Client → Server | Server → Client |
|-----------------|-----------------|
| `input` (PlayerInput) | `state` (full GameState snapshot) |
| `ready` (match start) | `player_joined` |
| `chat` (optional) | `player_left` |
|  | `goal_scored` (event) |
|  | `match_end` (final score) |

---

### Server Layer Components

#### 1. Colyseus Match Room
**Responsibility:** Manage individual match instance

**Room Lifecycle:**
```typescript
import { Room, Client } from 'colyseus'

class MatchRoom extends Room<GameState> {
  maxClients = 10 // 2 humans + 8 AI bots

  onCreate(options: any) {
    this.setState(new GameState())

    // Initialize match
    this.state.createTeams()
    this.state.spawnPlayers()
    this.state.spawnBall()

    // Start game loop (30 ticks per second)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 30)
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, 'joined')

    // Assign player to team (balance teams)
    const team = this.state.getTeamWithFewerPlayers()
    this.state.assignPlayerToTeam(client.sessionId, team)

    // If both human players joined, start match
    if (this.state.humanPlayerCount === 2) {
      this.startMatch()
    }
  }

  onMessage(client: Client, type: string, message: any) {
    if (type === 'input') {
      // Store input for next simulation step
      this.state.queueInput(client.sessionId, message)
    }
  }

  update(deltaTime: number) {
    // 1. Process queued inputs
    this.state.processInputs()

    // 2. Update AI decisions
    this.state.updateAI(deltaTime)

    // 3. Simulate physics
    this.state.simulatePhysics(deltaTime)

    // 4. Check game events (goals, out of bounds)
    this.state.checkEvents()

    // 5. Update match timer
    this.state.updateTimer(deltaTime)

    // 6. Check for match end
    if (this.state.isMatchOver()) {
      this.endMatch()
    }

    // State automatically broadcasts to clients (Colyseus handles this)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, 'left')

    // Replace human with AI bot
    this.state.replaceWithBot(client.sessionId)

    // If match is empty, dispose room
    if (this.state.humanPlayerCount === 0) {
      this.disconnect()
    }
  }
}
```

---

#### 2. Game State (Shared Schema)
**Responsibility:** Authoritative game state synchronized to clients

**State Schema:**
```typescript
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema'

class GameState extends Schema {
  @type('number') matchTime: number = 0 // seconds elapsed
  @type('number') scoreBlue: number = 0
  @type('number') scoreRed: number = 0
  @type('string') phase: 'waiting' | 'playing' | 'ended' = 'waiting'

  @type({ map: Player }) players = new MapSchema<Player>()
  @type(Ball) ball: Ball = new Ball()

  // Methods for game logic
  processInputs() { /* ... */ }
  simulatePhysics(dt: number) { /* ... */ }
  updateAI(dt: number) { /* ... */ }
  checkEvents() { /* ... */ }
}

class Player extends Schema {
  @type('string') id: string
  @type('string') team: 'blue' | 'red'
  @type('boolean') isHuman: boolean
  @type('boolean') isControlled: boolean // Currently controlled by human

  @type('number') x: number
  @type('number') y: number
  @type('number') velocityX: number = 0
  @type('number') velocityY: number = 0

  @type('string') state: 'idle' | 'running' | 'kicking' = 'idle'
  @type('number') direction: number = 0 // Angle in radians
}

class Ball extends Schema {
  @type('number') x: number
  @type('number') y: number
  @type('number') velocityX: number = 0
  @type('number') velocityY: number = 0
  @type('string') possessedBy: string = '' // Player ID or empty
}
```

**Delta Compression:**
Colyseus automatically sends only changed properties, reducing bandwidth:
- Full state: ~5KB
- Delta update: ~200-500 bytes (only changed positions)
- Frequency: 30 updates/second = ~15 KB/s per client

---

#### 3. Game Logic Engine
**Responsibility:** Simulate game mechanics server-side

**Physics Simulation (Arcade):**
```typescript
class PhysicsEngine {
  fieldWidth = 800
  fieldHeight = 600

  updatePlayerMovement(player: Player, input: PlayerInput, dt: number) {
    // Arcade physics: Direct velocity control
    const speed = 200 // pixels per second

    player.velocityX = input.movement.x * speed
    player.velocityY = input.movement.y * speed

    // Update position
    player.x += player.velocityX * dt
    player.y += player.velocityY * dt

    // Clamp to field bounds
    player.x = clamp(player.x, 0, this.fieldWidth)
    player.y = clamp(player.y, 0, this.fieldHeight)

    // Update animation state
    player.state = (player.velocityX !== 0 || player.velocityY !== 0) ? 'running' : 'idle'
    player.direction = Math.atan2(player.velocityY, player.velocityX)
  }

  updateBallPhysics(ball: Ball, dt: number) {
    // Apply friction (ball slows down)
    const friction = 0.98
    ball.velocityX *= friction
    ball.velocityY *= friction

    // Update position
    ball.x += ball.velocityX * dt
    ball.y += ball.velocityY * dt

    // Bounce off field boundaries
    if (ball.x <= 0 || ball.x >= this.fieldWidth) {
      ball.velocityX *= -0.8 // Energy loss on bounce
      ball.x = clamp(ball.x, 0, this.fieldWidth)
    }
    if (ball.y <= 0 || ball.y >= this.fieldHeight) {
      ball.velocityY *= -0.8
      ball.y = clamp(ball.y, 0, this.fieldHeight)
    }

    // Stop if velocity too low
    if (Math.abs(ball.velocityX) < 1 && Math.abs(ball.velocityY) < 1) {
      ball.velocityX = 0
      ball.velocityY = 0
    }
  }

  checkBallPossession(state: GameState) {
    const possessionRadius = 30 // pixels

    state.players.forEach((player) => {
      const dist = distance(player.x, player.y, state.ball.x, state.ball.y)

      if (dist < possessionRadius) {
        // Player is close to ball
        if (state.ball.possessedBy === '') {
          // Ball is loose, claim it
          state.ball.possessedBy = player.id
          // Stick ball to player
          state.ball.velocityX = 0
          state.ball.velocityY = 0
        }
      }
    })
  }

  shootBall(player: Player, ball: Ball, power: number) {
    const shootSpeed = 400 * power // power: 0-1

    ball.velocityX = Math.cos(player.direction) * shootSpeed
    ball.velocityY = Math.sin(player.direction) * shootSpeed
    ball.possessedBy = ''

    player.state = 'kicking'
  }

  passBall(player: Player, ball: Ball, targetPlayer: Player) {
    const passSpeed = 300
    const dx = targetPlayer.x - ball.x
    const dy = targetPlayer.y - ball.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    ball.velocityX = (dx / dist) * passSpeed
    ball.velocityY = (dy / dist) * passSpeed
    ball.possessedBy = ''

    player.state = 'kicking'
  }
}
```

**Goal Detection:**
```typescript
checkGoal(state: GameState): 'blue' | 'red' | null {
  const goalY = { min: 200, max: 400 } // Goal width
  const goalBlue = { x: 0 }
  const goalRed = { x: 800 }

  // Check if ball is in goal zone
  if (state.ball.y >= goalY.min && state.ball.y <= goalY.max) {
    if (state.ball.x <= goalBlue.x + 10) {
      return 'red' // Red team scores
    }
    if (state.ball.x >= goalRed.x - 10) {
      return 'blue' // Blue team scores
    }
  }

  return null
}
```

---

#### 4. AI Controller
**Responsibility:** Control non-human players

**AI State Machine:**
```typescript
class AIController {
  update(player: Player, state: GameState, dt: number): PlayerInput {
    // Determine AI behavior based on role and game state
    const behavior = this.selectBehavior(player, state)

    switch (behavior) {
      case 'chase_ball':
        return this.chaseBall(player, state.ball)
      case 'defend':
        return this.defend(player, state)
      case 'support_attack':
        return this.supportAttack(player, state)
      case 'position':
        return this.maintainPosition(player, state)
    }
  }

  selectBehavior(player: Player, state: GameState): AIBehavior {
    // If this AI player is controlled (nearest to ball), chase it
    if (player.isControlled) {
      return 'chase_ball'
    }

    // Otherwise, position based on role
    const ballInOurHalf = this.isBallInHalf(state.ball, player.team)

    if (ballInOurHalf) {
      return player.role === 'defender' ? 'defend' : 'position'
    } else {
      return player.role === 'forward' ? 'support_attack' : 'position'
    }
  }

  chaseBall(player: Player, ball: Ball): PlayerInput {
    // Simple: Move toward ball
    const dx = ball.x - player.x
    const dy = ball.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    return {
      movement: {
        x: dx / dist,
        y: dy / dist
      },
      action: dist < 40, // Kick if close enough
      timestamp: Date.now()
    }
  }

  defend(player: Player, state: GameState): PlayerInput {
    // Move toward own goal while staying between ball and goal
    const ownGoal = player.team === 'blue' ? { x: 0, y: 300 } : { x: 800, y: 300 }
    const ball = state.ball

    // Target position: Midpoint between ball and goal
    const targetX = (ball.x + ownGoal.x) / 2
    const targetY = (ball.y + ownGoal.y) / 2

    const dx = targetX - player.x
    const dy = targetY - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    return {
      movement: {
        x: dx / dist,
        y: dy / dist
      },
      action: false,
      timestamp: Date.now()
    }
  }

  supportAttack(player: Player, state: GameState): PlayerInput {
    // Move to open space ahead of ball
    const ball = state.ball
    const enemyGoal = player.team === 'blue' ? { x: 800, y: 300 } : { x: 0, y: 300 }

    // Target: Between ball and enemy goal, offset to side
    const targetX = ball.x + (enemyGoal.x - ball.x) * 0.7
    const targetY = ball.y + (Math.random() - 0.5) * 200 // Random offset

    const dx = targetX - player.x
    const dy = targetY - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    return {
      movement: {
        x: dx / dist,
        y: dy / dist
      },
      action: false,
      timestamp: Date.now()
    }
  }

  maintainPosition(player: Player, state: GameState): PlayerInput {
    // Stay in formation position
    const formationPos = this.getFormationPosition(player, state)

    const dx = formationPos.x - player.x
    const dy = formationPos.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Only move if far from position
    if (dist < 20) {
      return { movement: { x: 0, y: 0 }, action: false, timestamp: Date.now() }
    }

    return {
      movement: {
        x: dx / dist,
        y: dy / dist
      },
      action: false,
      timestamp: Date.now()
    }
  }

  getFormationPosition(player: Player, state: GameState): { x: number, y: number } {
    // Simple 4-4-2 formation positions
    // (Positions calculated based on team side and player role)
    // This is simplified; real implementation would be more complex
    return { x: 400, y: 300 } // Placeholder
  }
}
```

**Cursor Switching Logic:**
```typescript
updateControlledPlayers(state: GameState) {
  // For each human player, determine which AI teammate they control

  state.players.forEach((player) => {
    if (player.isHuman) {
      // Find nearest teammate to ball
      const teammates = this.getTeammates(player, state)
      const nearest = this.findNearestToBall(teammates, state.ball)

      // Update controlled status
      teammates.forEach(teammate => {
        teammate.isControlled = (teammate.id === nearest.id)
      })

      // Human player always controls themselves if they have the ball
      if (state.ball.possessedBy === player.id) {
        player.isControlled = true
        teammates.forEach(t => t.isControlled = false)
      }
    }
  })
}
```

---

#### 5. Matchmaking Service
**Responsibility:** Pair players for matches

**Simple Queue System:**
```typescript
class MatchmakingQueue {
  waitingPlayers: Map<string, Client> = new Map()

  async addPlayer(client: Client) {
    this.waitingPlayers.set(client.sessionId, client)

    // If 2+ players waiting, create match
    if (this.waitingPlayers.size >= 2) {
      const [player1, player2] = Array.from(this.waitingPlayers.values()).slice(0, 2)

      // Remove from queue
      this.waitingPlayers.delete(player1.sessionId)
      this.waitingPlayers.delete(player2.sessionId)

      // Create match room
      const room = await this.createMatchRoom([player1, player2])

      return room
    }

    // Otherwise, wait
    return null
  }

  removePlayer(sessionId: string) {
    this.waitingPlayers.delete(sessionId)
  }
}
```

**Advanced Matchmaking (Phase 2):**
- Skill-based matching (ELO rating)
- Region-based matching (reduce latency)
- Party support (invite friends)
- Timeout fallback (match vs AI if no players found)

---

### Database Layer

#### PostgreSQL Schema
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User stats table
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  goals_scored INT DEFAULT 0,
  goals_conceded INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  elo_rating INT DEFAULT 1000,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Match history table (optional for MVP)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  player1_score INT NOT NULL,
  player2_score INT NOT NULL,
  winner_id UUID REFERENCES users(id),
  duration_seconds INT NOT NULL,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT
  u.username,
  s.wins,
  s.losses,
  s.elo_rating,
  (s.wins::FLOAT / NULLIF(s.matches_played, 0)) AS win_rate
FROM users u
JOIN user_stats s ON u.id = s.user_id
ORDER BY s.elo_rating DESC
LIMIT 100;
```

#### Redis Cache (Optional Phase 2)
```
Key Pattern: session:{sessionId} → User session data
Key Pattern: queue:{region} → Matchmaking queue (sorted set by join time)
Key Pattern: match:{matchId} → Active match metadata
TTL: 1 hour for sessions, 5 minutes for queue entries
```

---

## 🔄 Data Flow Examples

### Example 1: Player Movement

```
1. [Client] User tilts joystick
   ├─ InputController captures: { movement: {x: 0.8, y: 0.2}, action: false }
   └─ Timestamp: 1234567890

2. [Client] ClientStateManager applies prediction
   ├─ Immediately update local player position
   ├─ Render at predicted position (no lag)
   └─ Buffer input for reconciliation

3. [Client → Server] Send input via WebSocket
   └─ Message: { type: 'input', data: { movement, action, timestamp } }

4. [Server] MatchRoom receives input
   ├─ Queue input for next simulation tick
   └─ Process at 30 Hz fixed timestep

5. [Server] PhysicsEngine.updatePlayerMovement()
   ├─ Calculate velocity: velocity = input.movement * speed
   ├─ Update position: pos += velocity * deltaTime
   └─ Update GameState schema

6. [Server → Client] Broadcast state update (delta)
   └─ Delta: { players: { 'abc123': { x: 456, y: 234, velocityX: 160, velocityY: 40 } } }

7. [Client] Receive state update
   ├─ Update serverState
   ├─ Reconcile prediction (remove confirmed inputs from buffer)
   └─ Re-apply unconfirmed inputs to catch up

8. [Client] StateInterpolator smooths rendering
   ├─ Buffer last 3 states
   ├─ Render 100ms in past
   └─ Interpolate between states for smooth motion

9. [Client] Phaser renders
   └─ Sprite.x = interpolatedState.players['abc123'].x
```

**Latency Breakdown:**
- Input → Local prediction: **0ms** (immediate)
- Input → Server processes: **30-50ms** (network RTT)
- Server → Client receives update: **30-50ms** (network RTT)
- **Total:** 60-100ms server confirmation, but feels instant due to prediction

---

### Example 2: Shooting the Ball

```
1. [Client] User presses action button
   ├─ Hold for 0.8 seconds → power = 0.53 (0-1 range)
   └─ Release detected

2. [Client] ClientStateManager determines action
   ├─ Check context: Near goal (distance < 150px) → SHOOT
   ├─ Predict ball trajectory locally (immediate feedback)
   └─ Send input: { action: 'shoot', power: 0.53, timestamp }

3. [Server] MatchRoom.onMessage('input')
   ├─ Validate action (anti-cheat: is player near ball?)
   └─ Queue for next tick

4. [Server] GameLogicEngine.processShoot()
   ├─ Calculate ball velocity: v = shootDirection * (400 * power)
   ├─ Set ball.velocityX, ball.velocityY
   ├─ Release ball: ball.possessedBy = ''
   └─ Set player.state = 'kicking' (animation trigger)

5. [Server] PhysicsEngine.updateBallPhysics()
   ├─ Every tick (30 Hz): Update ball position
   ├─ Check boundaries, apply friction
   └─ Detect goal collision

6. [Server] GoalDetector.checkGoal()
   ├─ Ball entered goal zone?
   ├─ If YES: Increment score, emit 'goal_scored' event
   └─ Reset ball to center

7. [Server → Clients] Broadcast goal event
   └─ Message: { type: 'goal_scored', team: 'blue', scorerID: 'abc123' }

8. [Client] Receive goal event
   ├─ Trigger celebration animation (particles, sound effect)
   ├─ Update UI (score display)
   └─ Wait for ball reset
```

---

### Example 3: AI Teammate Pass Decision

```
1. [Server] AIController.update() runs for AI player 'bot_4'
   ├─ Current state: bot_4 has ball possession
   └─ Behavior: 'support_attack'

2. [Server] AI Decision Tree
   ├─ Check: Am I near enemy goal? → NO (distance > 200px)
   ├─ Check: Are teammates in better position? → YES
   └─ Decision: PASS to nearest open teammate

3. [Server] AIController.selectPassTarget()
   ├─ Get all teammates
   ├─ Filter: Not marked by defenders, closer to goal
   ├─ Calculate pass safety score for each
   └─ Select best target: 'bot_2' (forward position)

4. [Server] PhysicsEngine.passBall(bot_4, ball, bot_2)
   ├─ Calculate trajectory: ballVelocity = normalize(bot_2.pos - ball.pos) * 300
   ├─ Set ball.velocityX, ball.velocityY
   └─ Release ball

5. [Server] BallPhysics simulation
   ├─ Ball travels toward bot_2
   ├─ Every tick: Check proximity to bot_2
   └─ When dist < 30px: bot_2 claims possession

6. [Server → Clients] State updates throughout
   ├─ Clients see ball trajectory
   ├─ bot_4 plays 'kick' animation
   └─ bot_2 receives ball, continues attack

7. [Client] Render smooth ball movement
   └─ Interpolate ball position between server ticks
```

---

### Example 4: Cursor Switching

```
1. [Server] Every tick: updateControlledPlayers()

2. [Server] For each human player:
   ├─ Get all AI teammates (4 bots)
   ├─ Calculate distance from each bot to ball
   └─ Find nearest: bot_3 (distance: 45px)

3. [Server] Update control flags
   ├─ bot_1.isControlled = false
   ├─ bot_2.isControlled = false
   ├─ bot_3.isControlled = TRUE ← New controlled player
   └─ bot_4.isControlled = false

4. [Server → Client] State update includes isControlled flags
   └─ Delta: { players: { 'bot_3': { isControlled: true }, 'bot_2': { isControlled: false } } }

5. [Client] Receive control switch
   ├─ ClientStateManager updates local control reference
   ├─ Input now applies to bot_3 instead of bot_2
   └─ Trigger visual feedback

6. [Client] Phaser renders control indicator
   ├─ Remove highlight from bot_2 sprite
   ├─ Add highlight to bot_3 sprite (pulsing circle, arrow above head)
   ├─ Optional: Brief screen flash or haptic feedback
   └─ Camera smoothly pans to bot_3 (if off-screen)

7. [Client] Next input from user
   └─ Joystick now controls bot_3 movement
```

**Edge Case Handling:**
- Rapid switching (ball bouncing): Add 200ms cooldown between switches
- Human has ball: Lock control to human player, ignore AI proximity
- Two bots equidistant: Tiebreaker by role (prioritize attackers)

---

## 🔧 Technology Choices Rationale

### Why Phaser 3?
✅ **Pros:**
- Mature framework (10+ years, v3 since 2018)
- Excellent documentation and community
- Built-in support for mobile touch controls
- Optimized WebGL renderer with Canvas fallback
- Free and open-source (MIT)

❌ **Cons:**
- 2D-focused (limited 3D support)
- Larger bundle size (~1MB minified)

**Alternatives Considered:**
- **PixiJS:** Lower-level, more control, but steeper learning curve
- **Three.js:** 3D-focused, overkill for 2D top-down
- **Custom Canvas:** Too much boilerplate, slow MVP

**Verdict:** Phaser 3 is optimal for 2D arcade game with fast development needs.

---

### Why Colyseus?
✅ **Pros:**
- Purpose-built for multiplayer web games
- State synchronization with delta compression (bandwidth efficient)
- Room-based architecture (perfect for match instances)
- TypeScript support (type-safe shared state)
- Built-in matchmaking primitives
- Excellent performance (handles thousands of CCU)

❌ **Cons:**
- Smaller ecosystem than Socket.IO
- Opinionated architecture (less flexibility)

**Alternatives Considered:**
- **Socket.IO:** More flexible but requires manual state sync implementation
- **Photon/PUN:** Unity-focused, not ideal for web
- **Nakama:** More features but steeper learning curve, overkill for MVP

**Verdict:** Colyseus reduces development time by 30-40% vs custom Socket.IO solution.

---

### Why PostgreSQL + Prisma?
✅ **Pros:**
- Relational data (users, stats, matches) fits well
- ACID guarantees (important for stats integrity)
- Mature ecosystem with great tooling
- Prisma ORM: Type-safe queries, migrations, excellent DX

❌ **Cons:**
- More setup than NoSQL solutions (Firebase, MongoDB)
- Vertical scaling limits (less relevant for MVP scale)

**Alternatives Considered:**
- **Firebase/Firestore:** Easier setup but vendor lock-in, less control
- **MongoDB:** Schema flexibility not needed here
- **Supabase:** Managed Postgres + auth, excellent for MVP (recommended)

**Verdict:** Postgres for reliability, Prisma for developer experience. Use Supabase for managed hosting.

---

### Why PWA over Native App?
✅ **Pros:**
- Single codebase for iOS + Android + Web
- No app store approval delays (ship instantly)
- Easier updates (no resubmission)
- Lower development cost (no native SDKs needed)
- Can wrap in Capacitor later if needed

❌ **Cons:**
- Slightly lower performance than native
- Limited API access (notifications, haptics)
- Less discoverability (no app store search)

**Alternatives Considered:**
- **React Native:** Cross-platform native, but more complexity
- **Flutter:** Good performance but new language (Dart)
- **Native (Swift/Kotlin):** Best performance but 2× development time

**Verdict:** PWA for MVP speed, Capacitor wrapper in Phase 2 if app store needed.

---

## 📊 Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Acceptable | Critical |
|--------|--------|-----------|----------|
| **Frame Rate** | 60 FPS | 30 FPS | 20 FPS |
| **Network Latency** | <50ms RTT | <100ms RTT | >150ms RTT |
| **Tick Rate** | 30 Hz | 20 Hz | <15 Hz |
| **Bandwidth (per client)** | 5 KB/s | 10 KB/s | >20 KB/s |
| **Initial Load Time** | <3s | <5s | >8s |
| **Match Join Time** | <2s | <5s | >10s |

### Optimization Strategies

**Client-Side:**
- Sprite atlases (reduce draw calls)
- Object pooling (avoid GC pauses)
- Lazy asset loading (load only needed sprites)
- Adaptive quality (reduce particles on low-end devices)

**Server-Side:**
- Fixed timestep simulation (30 Hz, not variable)
- Spatial partitioning (only check nearby entities for collisions)
- Prune inactive rooms (clean up empty matches)
- Load balancing (distribute rooms across server instances)

**Network:**
- Delta compression (Colyseus built-in)
- Binary serialization (not JSON)
- Client-side interpolation (smooth 20 Hz updates to 60 FPS)
- Prioritize critical data (player positions > cosmetic effects)

---

## 🔒 Security Considerations

### Anti-Cheat Measures
1. **Server Authority:** All game logic runs server-side
   - Client inputs are requests, not commands
   - Server validates every action (e.g., can player shoot from here?)

2. **Input Validation:**
   - Clamp joystick values (-1 to 1 range)
   - Rate limit actions (max 60 inputs/second)
   - Detect impossible movements (teleportation)

3. **Obfuscation:**
   - Minify and obfuscate client code
   - Don't expose internal state schema to client

4. **Monitoring:**
   - Log suspicious behavior (impossible scores, rapid wins)
   - Manual review system for reported players

### Data Privacy
- Password hashing: bcrypt with cost factor 12
- HTTPS everywhere (TLS 1.3)
- GDPR compliance: User data deletion on request
- Minimal data collection (username, email, stats only)

---

## 📈 Scalability Path

### MVP Scale (Phase 1)
- **Users:** 100-1000 concurrent
- **Matches:** 50-500 concurrent rooms
- **Infrastructure:** Single server instance
- **Cost:** ~$50/month

### Growth Scale (Phase 2)
- **Users:** 10K-100K concurrent
- **Matches:** 5K-50K concurrent rooms
- **Infrastructure:** Multi-region servers, load balancer, CDN
- **Cost:** ~$500-2000/month

### Scaling Strategies
1. **Horizontal Scaling:** Add more game server instances
2. **Regional Deployment:** Edge locations for lower latency
3. **Database Sharding:** Partition users by region
4. **Redis Caching:** Session data, leaderboards
5. **CDN:** Static assets (sprites, sounds)

---

## ✅ Architecture Decision Log

**Decision 1:** Use Colyseus over custom Socket.IO
**Rationale:** 30-40% faster development, built-in state sync
**Trade-off:** Less flexibility, smaller community

**Decision 2:** Client-side prediction for local player only
**Rationale:** Balance responsiveness and implementation complexity
**Trade-off:** Remote players have 100ms lag (acceptable for arcade game)

**Decision 3:** Rule-based AI over ML
**Rationale:** Faster to implement, more predictable behavior, deterministic
**Trade-off:** Less dynamic AI, but good enough for arcade gameplay

**Decision 4:** 2D sprites for MVP, 3D for Phase 2
**Rationale:** 2D faster to develop and cheaper to create assets
**Trade-off:** Less visual fidelity, but proven arcade aesthetic

**Decision 5:** PWA deployment first, native wrapper later
**Rationale:** Faster iteration, no app store delays
**Trade-off:** Slightly lower performance, less discoverability

**Decision 6:** StateAdapter pattern for unified state interface
**Rationale:** Eliminate code duplication (~145 lines), single source of truth for state access
**Trade-off:** Additional abstraction layer, but dramatically simplifies scene implementations
**Impact:** Reduced abstract methods from 4 to 1, enabled team-agnostic auto-switching

---

**Document Status:** ✅ Ready for Development
**Last Updated:** 2025-10-26
