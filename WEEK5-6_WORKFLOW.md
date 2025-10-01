# Week 5-6 Implementation Workflow: Multiplayer Networking

**Duration**: Days 22-35 (14 days / 2 weeks)
**Goal**: Transform single-player match into real-time 2-player multiplayer experience
**Status**: 📋 READY TO START

---

## 🎯 Overview

Week 5-6 focuses on implementing real-time multiplayer networking using Colyseus, enabling two players to compete against each other in the same match with smooth, low-latency gameplay.

### Success Criteria
- ✅ Two players can join the same match
- ✅ Both players see each other's movements in real-time
- ✅ Ball synchronization works (one authoritative state)
- ✅ Local player feels responsive (client-side prediction)
- ✅ Latency < 100ms for most connections
- ✅ No desynchronization issues

---

## 📋 Phase 1: Server Foundation (Days 22-24)

**Goal**: Set up Colyseus server with basic game state
**Duration**: 3 days (~12-15 hours)
**Deliverable**: Running Colyseus server with game state schema

### Day 22: Server Setup & Dependencies

**Objective**: Initialize Colyseus server infrastructure

#### Tasks

1. **Install Colyseus dependencies**
   ```bash
   cd server
   npm install colyseus @colyseus/schema @colyseus/monitor cors
   npm install -D @types/cors
   ```

2. **Update server/src/index.ts**
   ```typescript
   import { Server } from 'colyseus'
   import { createServer } from 'http'
   import { WebSocketTransport } from '@colyseus/ws-transport'
   import express from 'express'
   import cors from 'cors'
   import { MatchRoom } from './rooms/MatchRoom'

   const app = express()
   app.use(cors())
   app.use(express.json())

   const gameServer = new Server({
     transport: new WebSocketTransport({
       server: createServer(app)
     })
   })

   // Register room handler
   gameServer.define('match', MatchRoom)

   // Optional: Colyseus Monitor (dev only)
   if (process.env.NODE_ENV !== 'production') {
     app.use('/colyseus', monitor())
   }

   gameServer.listen(3000)
   console.log('🚀 Socca2 Multiplayer Server listening on ws://localhost:3000')
   ```

3. **Create server directory structure**
   ```bash
   mkdir -p server/src/rooms
   mkdir -p server/src/schema
   ```

4. **Test server starts**
   ```bash
   npm run dev:server
   ```
   - Verify: "Server listening on ws://localhost:3000" appears in console
   - No errors on startup

**Time**: 2-3 hours

---

### Day 23: Game State Schema

**Objective**: Define shared state structure for synchronization

#### Tasks

1. **Create server/src/schema/Player.ts**
   ```typescript
   import { Schema, type } from '@colyseus/schema'

   export class Player extends Schema {
     @type('string') id: string = ''
     @type('string') team: string = 'blue' // 'blue' or 'red'
     @type('number') x: number = 400
     @type('number') y: number = 300
     @type('number') velocityX: number = 0
     @type('number') velocityY: number = 0
     @type('boolean') isHuman: boolean = true
     @type('boolean') isControlled: boolean = false
   }
   ```

2. **Create server/src/schema/Ball.ts**
   ```typescript
   import { Schema, type } from '@colyseus/schema'

   export class Ball extends Schema {
     @type('number') x: number = 400
     @type('number') y: number = 300
     @type('number') velocityX: number = 0
     @type('number') velocityY: number = 0
   }
   ```

3. **Create server/src/schema/GameState.ts**
   ```typescript
   import { Schema, type, MapSchema } from '@colyseus/schema'
   import { Player } from './Player'
   import { Ball } from './Ball'

   export class GameState extends Schema {
     @type({ map: Player }) players = new MapSchema<Player>()
     @type(Ball) ball = new Ball()

     @type('number') scoreBlue: number = 0
     @type('number') scoreRed: number = 0
     @type('number') timeRemaining: number = 120
     @type('boolean') matchEnded: boolean = false
     @type('string') winner: string = '' // 'blue', 'red', or 'draw'
   }
   ```

4. **Verify schema compilation**
   - Run TypeScript compiler
   - No errors should occur
   - Schema types properly exported

**Time**: 2-3 hours

---

### Day 24: Match Room Implementation

**Objective**: Create room handler with basic game loop

#### Tasks

1. **Create server/src/rooms/MatchRoom.ts**
   ```typescript
   import { Room, Client } from 'colyseus'
   import { GameState } from '../schema/GameState'
   import { Player } from '../schema/Player'

   export class MatchRoom extends Room<GameState> {
     maxClients = 2
     private tickRate = 30 // 30 Hz (33ms per tick)

     onCreate(options: any) {
       console.log('🎮 Match room created:', this.roomId)

       this.setState(new GameState())

       // Initialize ball at center
       this.state.ball.x = 400
       this.state.ball.y = 300

       // Set simulation interval (game loop)
       this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / this.tickRate)

       // Handle player input
       this.onMessage('input', (client, message) => {
         this.handlePlayerInput(client, message)
       })

       // Handle action (shoot/pass)
       this.onMessage('action', (client, message) => {
         this.handlePlayerAction(client, message)
       })
     }

     onJoin(client: Client, options: any) {
       console.log('👤 Player joined:', client.sessionId)

       const player = new Player()
       player.id = client.sessionId

       // Assign team based on player count
       const playerCount = this.state.players.size
       player.team = playerCount === 0 ? 'blue' : 'red'

       // Set starting position
       player.x = player.team === 'blue' ? 200 : 600
       player.y = 300

       this.state.players.set(client.sessionId, player)

       // Start match when 2 players joined
       if (this.state.players.size === 2) {
         this.startMatch()
       }
     }

     onLeave(client: Client, consented: boolean) {
       console.log('👋 Player left:', client.sessionId)

       this.state.players.delete(client.sessionId)

       // End match if player leaves
       if (this.state.players.size < 2) {
         this.state.matchEnded = true
       }
     }

     onDispose() {
       console.log('🛑 Match room disposed:', this.roomId)
     }

     private startMatch() {
       console.log('⚽ Match started!')
       this.state.timeRemaining = 120
       this.state.matchEnded = false
     }

     private handlePlayerInput(client: Client, message: any) {
       const player = this.state.players.get(client.sessionId)
       if (!player) return

       // Update player velocity based on input
       const speed = 200 // pixels per second
       player.velocityX = message.movement.x * speed
       player.velocityY = message.movement.y * speed
     }

     private handlePlayerAction(client: Client, message: any) {
       const player = this.state.players.get(client.sessionId)
       if (!player) return

       if (message.type === 'shoot') {
         this.handleShoot(player, message.power)
       }
     }

     private handleShoot(player: Player, power: number) {
       // Check if player is close to ball
       const dx = this.state.ball.x - player.x
       const dy = this.state.ball.y - player.y
       const dist = Math.sqrt(dx * dx + dy * dy)

       if (dist < 30) { // POSSESSION_RADIUS
         const shootSpeed = 400
         this.state.ball.velocityX = (dx / dist) * shootSpeed * power
         this.state.ball.velocityY = (dy / dist) * shootSpeed * power
       }
     }

     private update(deltaTime: number) {
       const dt = deltaTime / 1000 // Convert to seconds

       // Update player positions
       this.state.players.forEach((player) => {
         player.x += player.velocityX * dt
         player.y += player.velocityY * dt

         // Clamp to field boundaries
         player.x = Math.max(20, Math.min(780, player.x))
         player.y = Math.max(20, Math.min(580, player.y))
       })

       // Update ball physics
       this.updateBallPhysics(dt)

       // Update match timer (every second)
       // TODO: Implement timer decrement
     }

     private updateBallPhysics(dt: number) {
       // Apply friction
       this.state.ball.velocityX *= 0.98
       this.state.ball.velocityY *= 0.98

       // Stop if very slow
       if (Math.abs(this.state.ball.velocityX) < 1) this.state.ball.velocityX = 0
       if (Math.abs(this.state.ball.velocityY) < 1) this.state.ball.velocityY = 0

       // Update position
       this.state.ball.x += this.state.ball.velocityX * dt
       this.state.ball.y += this.state.ball.velocityY * dt

       // Bounce off boundaries (simplified)
       const margin = 20
       if (this.state.ball.x <= margin || this.state.ball.x >= 780) {
         this.state.ball.velocityX *= -0.8
         this.state.ball.x = Math.max(margin, Math.min(780, this.state.ball.x))
       }
       if (this.state.ball.y <= margin || this.state.ball.y >= 580) {
         this.state.ball.velocityY *= -0.8
         this.state.ball.y = Math.max(margin, Math.min(580, this.state.ball.y))
       }
     }
   }
   ```

2. **Test server with room**
   ```bash
   npm run dev:server
   ```
   - Verify room registers: "Registered room: match"
   - No TypeScript errors

3. **Test with Colyseus Monitor** (optional)
   - Navigate to http://localhost:3000/colyseus
   - View registered rooms
   - Inspect available matches

**Time**: 4-6 hours

**Testing Gate**: ✅ Server runs without errors, room can be created

---

## 📋 Phase 2: Client-Server Connection (Days 25-27)

**Goal**: Connect Phaser client to Colyseus server
**Duration**: 3 days (~12-15 hours)
**Deliverable**: Client can join match and see debug info

### Day 25: Network Manager Setup

**Objective**: Create client-side networking layer

#### Tasks

1. **Install Colyseus client SDK**
   ```bash
   cd client
   npm install colyseus.js
   ```

2. **Create client/src/network/NetworkManager.ts**
   ```typescript
   import { Client, Room } from 'colyseus.js'
   import { GameState } from '../../../server/src/schema/GameState'

   export class NetworkManager {
     private client: Client
     private room?: Room<GameState>
     private connected: boolean = false

     constructor() {
       this.client = new Client('ws://localhost:3000')
     }

     async connect(): Promise<Room<GameState>> {
       try {
         this.room = await this.client.joinOrCreate<GameState>('match')
         this.connected = true

         console.log('✅ Connected to match:', this.room.roomId)
         console.log('👤 Session ID:', this.room.sessionId)

         this.setupListeners()

         return this.room
       } catch (error) {
         console.error('❌ Connection failed:', error)
         throw error
       }
     }

     private setupListeners() {
       if (!this.room) return

       // State change listener
       this.room.onStateChange((state) => {
         console.log('📊 State updated:', state)
       })

       // Player added
       this.room.state.players.onAdd = (player, sessionId) => {
         console.log('➕ Player added:', sessionId, player.team)
       }

       // Player removed
       this.room.state.players.onRemove = (player, sessionId) => {
         console.log('➖ Player removed:', sessionId)
       }

       // Error handling
       this.room.onError((code, message) => {
         console.error('🚨 Room error:', code, message)
       })

       // Leave handling
       this.room.onLeave((code) => {
         console.log('👋 Left room:', code)
         this.connected = false
       })
     }

     sendInput(movement: { x: number; y: number }) {
       if (!this.room || !this.connected) return

       this.room.send('input', { movement })
     }

     sendAction(type: string, power: number = 1.0) {
       if (!this.room || !this.connected) return

       this.room.send('action', { type, power })
     }

     getMySessionId(): string | undefined {
       return this.room?.sessionId
     }

     getState(): GameState | undefined {
       return this.room?.state
     }

     disconnect() {
       if (this.room) {
         this.room.leave()
         this.connected = false
       }
     }

     isConnected(): boolean {
       return this.connected
     }
   }
   ```

3. **Update shared types** (create client/src/types/network.ts)
   ```typescript
   export interface PlayerInput {
     movement: {
       x: number // -1 to 1
       y: number // -1 to 1
     }
     timestamp: number
   }

   export interface PlayerAction {
     type: 'shoot' | 'pass'
     power: number // 0 to 1
     timestamp: number
   }
   ```

**Time**: 3-4 hours

---

### Day 26: Integrate Network Manager into GameScene

**Objective**: Connect GameScene to multiplayer server

#### Tasks

1. **Update GameScene.ts - Add network manager**
   ```typescript
   import { NetworkManager } from '../network/NetworkManager'

   export class GameScene extends Phaser.Scene {
     // Existing properties...
     private networkManager?: NetworkManager
     private mySessionId?: string
     private isMultiplayer: boolean = false

     async create() {
       // Detect mobile device...

       // Connect to multiplayer server
       try {
         this.networkManager = new NetworkManager()
         await this.networkManager.connect()
         this.mySessionId = this.networkManager.getMySessionId()
         this.isMultiplayer = true

         console.log('🎮 Multiplayer mode enabled')

         this.setupNetworkListeners()
       } catch (error) {
         console.warn('⚠️ Multiplayer unavailable, running single-player')
         this.isMultiplayer = false
       }

       // Existing create() code...
     }

     private setupNetworkListeners() {
       if (!this.networkManager) return

       const state = this.networkManager.getState()
       if (!state) return

       // Listen for player additions
       state.players.onAdd = (player, sessionId) => {
         if (sessionId !== this.mySessionId) {
           this.createRemotePlayer(sessionId, player)
         }
       }

       // Listen for player removals
       state.players.onRemove = (player, sessionId) => {
         if (sessionId !== this.mySessionId) {
           this.removeRemotePlayer(sessionId)
         }
       }
     }

     private createRemotePlayer(sessionId: string, playerState: any) {
       // TODO: Create sprite for remote player
       console.log('🎭 Creating remote player:', sessionId, playerState.team)
     }

     private removeRemotePlayer(sessionId: string) {
       // TODO: Remove sprite for remote player
       console.log('🗑️ Removing remote player:', sessionId)
     }
   }
   ```

2. **Update input handling to send to server**
   ```typescript
   private updatePlayerMovement(dt: number) {
     // Existing movement code...

     // Send input to server if multiplayer
     if (this.isMultiplayer && this.networkManager) {
       const movement = {
         x: this.playerVelocity.x / GAME_CONFIG.PLAYER_SPEED,
         y: this.playerVelocity.y / GAME_CONFIG.PLAYER_SPEED
       }
       this.networkManager.sendInput(movement)
     }

     // Update local player (client-side prediction for now)
     this.player.x += this.playerVelocity.x * dt
     this.player.y += this.playerVelocity.y * dt
   }
   ```

3. **Update shoot action to send to server**
   ```typescript
   private shootBall(power: number = 0.8) {
     // Existing shoot logic...

     // Send action to server if multiplayer
     if (this.isMultiplayer && this.networkManager) {
       this.networkManager.sendAction('shoot', power)
     }
   }
   ```

**Time**: 3-4 hours

---

### Day 27: Connection Testing & Debug UI

**Objective**: Verify connection works and add debug visualization

#### Tasks

1. **Add debug UI for network state**
   ```typescript
   private createDebugUI() {
     if (!import.meta.env.DEV) return

     // Connection status
     this.debugText = this.add.text(10, 10, '', {
       fontSize: '14px',
       color: '#00ff00',
       backgroundColor: '#000000',
       padding: { x: 5, y: 5 }
     })
     this.debugText.setDepth(3000)

     this.updateDebugUI()
   }

   private updateDebugUI() {
     if (!this.debugText) return

     const state = this.networkManager?.getState()
     const lines = [
       `Mode: ${this.isMultiplayer ? 'MULTIPLAYER' : 'SINGLE-PLAYER'}`,
       `Session: ${this.mySessionId || 'N/A'}`,
       `Players: ${state?.players.size || 0}/2`,
       `Ball: (${state?.ball.x.toFixed(0)}, ${state?.ball.y.toFixed(0)})`,
       `Score: ${state?.scoreBlue || 0} - ${state?.scoreRed || 0}`
     ]

     this.debugText.setText(lines.join('\n'))
   }

   update(time: number, delta: number) {
     // Existing update code...

     // Update debug UI
     if (this.debugText) {
       this.updateDebugUI()
     }
   }
   ```

2. **Test connection with two browser windows**
   - Start server: `npm run dev:server`
   - Start client: `npm run dev:client`
   - Open http://localhost:5173 in two browser windows
   - Verify:
     - Both show "Mode: MULTIPLAYER"
     - Both show "Players: 2/2"
     - Different session IDs
     - No connection errors in console

3. **Verify console logs**
   - Server shows: "Player joined" (x2)
   - Client shows: "Connected to match"
   - Client shows: "Player added" for other player

**Time**: 3-4 hours

**Testing Gate**: ✅ Two clients can connect to same match, see debug info

---

## 📋 Phase 3: State Synchronization (Days 28-30)

**Goal**: Render remote players and ball from server state
**Duration**: 3 days (~12-15 hours)
**Deliverable**: Both players see each other moving

### Day 28: Remote Player Rendering

**Objective**: Display other player's position from server

#### Tasks

1. **Add remote player sprites map**
   ```typescript
   private remotePlayers: Map<string, Phaser.GameObjects.Rectangle> = new Map()
   private remotePlayerIndicators: Map<string, Phaser.GameObjects.Circle> = new Map()
   ```

2. **Implement createRemotePlayer()**
   ```typescript
   private createRemotePlayer(sessionId: string, playerState: any) {
     // Create remote player sprite (red team)
     const color = playerState.team === 'blue' ? 0x0066ff : 0xff4444
     const remotePlayer = this.add.rectangle(
       playerState.x,
       playerState.y,
       30,
       40,
       color
     )
     remotePlayer.setStrokeStyle(2, 0xffffff)

     // Create indicator
     const indicator = this.add.circle(remotePlayer.x, remotePlayer.y - 25, 8, 0xffff00)

     this.remotePlayers.set(sessionId, remotePlayer)
     this.remotePlayerIndicators.set(sessionId, indicator)

     console.log('✅ Remote player created:', sessionId)
   }
   ```

3. **Implement removeRemotePlayer()**
   ```typescript
   private removeRemotePlayer(sessionId: string) {
     const sprite = this.remotePlayers.get(sessionId)
     const indicator = this.remotePlayerIndicators.get(sessionId)

     if (sprite) sprite.destroy()
     if (indicator) indicator.destroy()

     this.remotePlayers.delete(sessionId)
     this.remotePlayerIndicators.delete(sessionId)

     console.log('🗑️ Remote player removed:', sessionId)
   }
   ```

4. **Update remote player positions in update loop**
   ```typescript
   update(time: number, delta: number) {
     // Existing code...

     // Update remote players from server state
     if (this.isMultiplayer && this.networkManager) {
       const state = this.networkManager.getState()
       if (state) {
         state.players.forEach((player, sessionId) => {
           if (sessionId !== this.mySessionId) {
             this.updateRemotePlayer(sessionId, player)
           }
         })
       }
     }
   }

   private updateRemotePlayer(sessionId: string, playerState: any) {
     const sprite = this.remotePlayers.get(sessionId)
     const indicator = this.remotePlayerIndicators.get(sessionId)

     if (sprite && indicator) {
       sprite.x = playerState.x
       sprite.y = playerState.y
       indicator.x = playerState.x
       indicator.y = playerState.y - 25
     }
   }
   ```

**Time**: 4-5 hours

---

### Day 29: Ball Synchronization

**Objective**: Render ball from server state

#### Tasks

1. **Sync ball position from server**
   ```typescript
   private updateBallFromServer() {
     if (!this.isMultiplayer || !this.networkManager) return

     const state = this.networkManager.getState()
     if (!state) return

     // Update ball position from server
     this.ball.x = state.ball.x
     this.ball.y = state.ball.y

     // Store server velocity (for interpolation later)
     this.ballVelocity.x = state.ball.velocityX
     this.ballVelocity.y = state.ball.velocityY
   }

   update(time: number, delta: number) {
     // Update from server first
     if (this.isMultiplayer) {
       this.updateBallFromServer()
     } else {
       // Single-player physics
       this.updateBallPhysics(dt)
     }

     // Rest of update logic...
   }
   ```

2. **Disable client-side ball physics in multiplayer**
   ```typescript
   private updateBallPhysics(dt: number) {
     // Skip if multiplayer (server handles physics)
     if (this.isMultiplayer) return

     // Existing ball physics code...
   }
   ```

3. **Update goal detection to use server state**
   ```typescript
   private checkGoal() {
     // Skip if multiplayer (server handles goals)
     if (this.isMultiplayer) {
       const state = this.networkManager?.getState()
       if (state) {
         // Update UI from server state
         this.scoreText.setText(`${state.scoreBlue} - ${state.scoreRed}`)

         // Check if match ended
         if (state.matchEnded && !this.matchEnded) {
           this.matchEnded = true
           this.onMatchEnd()
         }
       }
       return { scored: false }
     }

     // Single-player goal detection...
   }
   ```

**Time**: 3-4 hours

---

### Day 30: Synchronization Testing

**Objective**: Verify state sync works correctly

#### Tasks

1. **Test two-player movement**
   - Open two browser windows
   - Move player in window 1
   - Verify player moves in window 2
   - Move player in window 2
   - Verify player moves in window 1

2. **Test ball synchronization**
   - Player 1 shoots ball
   - Verify ball moves in both windows
   - Player 2 shoots ball
   - Verify ball moves in both windows

3. **Test score synchronization**
   - Player 1 scores goal
   - Verify score updates in both windows
   - Player 2 scores goal
   - Verify score updates in both windows

4. **Measure and log latency**
   ```typescript
   private measureLatency() {
     const startTime = Date.now()

     this.networkManager?.room.send('ping', { timestamp: startTime })

     this.networkManager?.room.onMessage('pong', (message) => {
       const latency = Date.now() - message.timestamp
       console.log(`📊 Latency: ${latency}ms`)
     })
   }
   ```

5. **Document observed issues**
   - Jittery movement?
   - Delayed ball updates?
   - Desynchronization?
   - Connection drops?

**Time**: 3-4 hours

**Testing Gate**: ✅ Both players see synchronized game state

---

## 📋 Phase 4: Client-Side Prediction (Days 31-33)

**Goal**: Make local player feel responsive despite network latency
**Duration**: 3 days (~12-15 hours)
**Deliverable**: Local player movement feels instant

### Day 31: Prediction Architecture

**Objective**: Implement input buffering and prediction

#### Tasks

1. **Create client/src/network/ClientPrediction.ts**
   ```typescript
   export class ClientPrediction {
     private inputSequenceNumber: number = 0
     private pendingInputs: Array<{
       sequenceNumber: number
       movement: { x: number; y: number }
       timestamp: number
     }> = []

     private serverPosition = { x: 0, y: 0 }
     private predictedPosition = { x: 0, y: 0 }

     addInput(movement: { x: number; y: number }): number {
       const sequenceNumber = ++this.inputSequenceNumber

       this.pendingInputs.push({
         sequenceNumber,
         movement,
         timestamp: Date.now()
       })

       return sequenceNumber
     }

     applyInput(position: { x: number; y: number }, movement: { x: number; y: number }, dt: number, speed: number) {
       position.x += movement.x * speed * dt
       position.y += movement.y * speed * dt

       // Clamp to boundaries
       position.x = Math.max(20, Math.min(780, position.x))
       position.y = Math.max(20, Math.min(580, position.y))

       return position
     }

     reconcile(serverPosition: { x: number; y: number }, lastProcessedInput: number) {
       this.serverPosition = { ...serverPosition }

       // Remove acknowledged inputs
       this.pendingInputs = this.pendingInputs.filter(
         input => input.sequenceNumber > lastProcessedInput
       )

       // Start from server position
       this.predictedPosition = { ...serverPosition }

       // Replay pending inputs
       this.pendingInputs.forEach(input => {
         this.applyInput(this.predictedPosition, input.movement, 0.016, 200)
       })

       return this.predictedPosition
     }

     getPredictedPosition(): { x: number; y: number } {
       return { ...this.predictedPosition }
     }

     getServerPosition(): { x: number; y: number } {
       return { ...this.serverPosition }
     }

     clearOldInputs() {
       // Remove inputs older than 1 second (safety cleanup)
       const now = Date.now()
       this.pendingInputs = this.pendingInputs.filter(
         input => now - input.timestamp < 1000
       )
     }
   }
   ```

**Time**: 4-5 hours

---

### Day 32: Integrate Prediction

**Objective**: Use prediction for local player

#### Tasks

1. **Add prediction to GameScene**
   ```typescript
   import { ClientPrediction } from '../network/ClientPrediction'

   private clientPrediction?: ClientPrediction

   create() {
     // After network connection...
     if (this.isMultiplayer) {
       this.clientPrediction = new ClientPrediction()
     }
   }
   ```

2. **Update movement with prediction**
   ```typescript
   private updatePlayerMovement(dt: number) {
     // Calculate movement input
     const movement = {
       x: this.playerVelocity.x / GAME_CONFIG.PLAYER_SPEED,
       y: this.playerVelocity.y / GAME_CONFIG.PLAYER_SPEED
     }

     if (this.isMultiplayer && this.networkManager && this.clientPrediction) {
       // Add input to prediction buffer
       const sequenceNumber = this.clientPrediction.addInput(movement)

       // Send to server with sequence number
       this.networkManager.sendInput(movement, sequenceNumber)

       // Apply prediction locally (instant response)
       this.clientPrediction.applyInput(this.player, movement, dt, GAME_CONFIG.PLAYER_SPEED)

     } else {
       // Single-player movement
       this.player.x += this.playerVelocity.x * dt
       this.player.y += this.playerVelocity.y * dt
     }

     // Existing boundary clamping...
   }
   ```

3. **Add reconciliation on server update**
   ```typescript
   private setupNetworkListeners() {
     // Existing listeners...

     // Listen for state changes (server position updates)
     state.onChange = () => {
       if (this.clientPrediction && this.mySessionId) {
         const myPlayer = state.players.get(this.mySessionId)
         if (myPlayer) {
           // Reconcile predicted position with server position
           const correctedPosition = this.clientPrediction.reconcile(
             { x: myPlayer.x, y: myPlayer.y },
             myPlayer.lastProcessedInput || 0
           )

           // Update local player to corrected position
           this.player.x = correctedPosition.x
           this.player.y = correctedPosition.y
         }
       }
     }
   }
   ```

**Time**: 4-5 hours

---

### Day 33: Server-Side Input Processing

**Objective**: Update server to acknowledge processed inputs

#### Tasks

1. **Update Player schema to track last input**
   ```typescript
   export class Player extends Schema {
     // Existing fields...
     @type('number') lastProcessedInput: number = 0
   }
   ```

2. **Update MatchRoom input handling**
   ```typescript
   private handlePlayerInput(client: Client, message: any) {
     const player = this.state.players.get(client.sessionId)
     if (!player) return

     // Store sequence number
     if (message.sequenceNumber) {
       player.lastProcessedInput = message.sequenceNumber
     }

     // Update velocity
     const speed = 200
     player.velocityX = message.movement.x * speed
     player.velocityY = message.movement.y * speed
   }
   ```

3. **Test prediction**
   - Open two windows
   - Add artificial latency (Chrome DevTools Network throttling: Fast 3G)
   - Move local player
   - Verify:
     - Local player feels instant
     - Remote player has slight delay (expected)
     - No rubber-banding or jitter

**Time**: 3-4 hours

**Testing Gate**: ✅ Local player feels responsive even with 100ms+ latency

---

## 📋 Phase 5: Polish & Testing (Days 34-35)

**Goal**: Final integration and bug fixing
**Duration**: 2 days (~8-10 hours)
**Deliverable**: Stable 2-player multiplayer experience

### Day 34: Integration & Bug Fixes

**Objective**: Fix issues and improve reliability

#### Tasks

1. **Add entity interpolation for smooth remote players**
   ```typescript
   private interpolateRemotePlayer(sprite: any, targetX: number, targetY: number, alpha: number = 0.3) {
     // Smooth interpolation instead of instant snap
     sprite.x += (targetX - sprite.x) * alpha
     sprite.y += (targetY - sprite.y) * alpha
   }

   private updateRemotePlayer(sessionId: string, playerState: any) {
     const sprite = this.remotePlayers.get(sessionId)

     if (sprite) {
       // Use interpolation for smoother movement
       this.interpolateRemotePlayer(sprite, playerState.x, playerState.y)
     }
   }
   ```

2. **Add connection state handling**
   ```typescript
   private showConnectionLost() {
     const overlay = this.add.rectangle(
       this.scale.width / 2,
       this.scale.height / 2,
       this.scale.width,
       this.scale.height,
       0x000000,
       0.7
     )

     const text = this.add.text(
       this.scale.width / 2,
       this.scale.height / 2,
       'Connection Lost\nReconnecting...',
       { fontSize: '32px', color: '#ffffff', align: 'center' }
     )
     text.setOrigin(0.5)
   }
   ```

3. **Fix common issues**
   - Player not appearing for second client
   - Ball position desync
   - Score not updating
   - Match timer not syncing

**Time**: 4-5 hours

---

### Day 35: Final Testing & Documentation

**Objective**: Comprehensive testing and documentation

#### Tasks

1. **Test all multiplayer features**
   - [ ] Two players can join match
   - [ ] Both see each other moving smoothly
   - [ ] Ball shoots work from both clients
   - [ ] Goals detected and scored correctly
   - [ ] Timer counts down in sync
   - [ ] Match ends correctly
   - [ ] Restart works for both players
   - [ ] Player disconnect handled gracefully

2. **Performance testing**
   - Test on WiFi (low latency)
   - Test on 4G (medium latency)
   - Test on throttled connection (high latency)
   - Measure FPS impact (should still maintain 60 FPS)

3. **Create WEEK5-6_SUMMARY.md**
   - Document all implemented features
   - List known issues and limitations
   - Performance metrics
   - Next steps for Week 7-8

**Time**: 3-4 hours

**Testing Gate**: ✅ Two players can complete a full match together

---

## 🎯 Success Metrics

### Technical Requirements
- ✅ Server tick rate: 30 Hz minimum
- ✅ Client frame rate: 60 FPS maintained
- ✅ Network latency: < 100ms on good connection
- ✅ Prediction accuracy: < 5px error on reconciliation
- ✅ No memory leaks after 10-minute session

### Feature Completeness
- ✅ Two players can join same match
- ✅ Real-time state synchronization working
- ✅ Client-side prediction implemented
- ✅ Ball synchronization accurate
- ✅ Goals and scoring synced
- ✅ Match timer synced
- ✅ Disconnect handling functional

### Quality Metrics
- ✅ No critical bugs
- ✅ Smooth gameplay on good connection
- ✅ Graceful degradation on poor connection
- ✅ Clear error messages for connection issues

---

## 🚨 Risk Mitigation

### Common Issues & Solutions

**Issue**: Players don't see each other
- **Check**: Schema registered correctly
- **Check**: onAdd listeners set up before players join
- **Check**: Sprites created with correct positions

**Issue**: Ball position desyncs
- **Solution**: Disable client-side ball physics in multiplayer
- **Solution**: Ensure server is authoritative for ball state

**Issue**: Jittery remote players
- **Solution**: Add interpolation (lerp) for smooth movement
- **Solution**: Increase server tick rate to 60 Hz

**Issue**: High latency causes rubber-banding
- **Solution**: Tune prediction reconciliation threshold
- **Solution**: Add dead reckoning for remote entities

**Issue**: Connection drops during match
- **Solution**: Implement reconnection logic
- **Solution**: Show clear error message to user

---

## 📚 Resources

### Documentation
- [Colyseus Docs](https://docs.colyseus.io/)
- [Client-Side Prediction Guide](https://gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [Entity Interpolation](https://gabrielgambetta.com/entity-interpolation.html)

### Code Examples
- [Colyseus Examples](https://github.com/colyseus/colyseus-examples)
- [Phaser + Colyseus Template](https://github.com/colyseus/phaser-colyseus)

### Testing Tools
- Chrome DevTools Network Throttling (simulate latency)
- Colyseus Monitor (view room state)
- WebSocket debugging in browser DevTools

---

## 📋 Checklist Summary

### Phase 1: Server Foundation
- [ ] Install Colyseus dependencies
- [ ] Create game state schema (Player, Ball, GameState)
- [ ] Implement MatchRoom with game loop
- [ ] Test server starts without errors

### Phase 2: Client Connection
- [ ] Install Colyseus client SDK
- [ ] Create NetworkManager class
- [ ] Integrate into GameScene
- [ ] Add debug UI
- [ ] Test two clients connecting

### Phase 3: State Synchronization
- [ ] Render remote players from server state
- [ ] Sync ball position from server
- [ ] Sync scores and timer
- [ ] Test full match flow

### Phase 4: Client Prediction
- [ ] Implement ClientPrediction class
- [ ] Add input buffering
- [ ] Implement reconciliation
- [ ] Update server to acknowledge inputs
- [ ] Test with artificial latency

### Phase 5: Polish & Testing
- [ ] Add entity interpolation
- [ ] Handle connection issues
- [ ] Fix bugs
- [ ] Comprehensive testing
- [ ] Document results

---

**Status**: 📋 READY TO IMPLEMENT
**Estimated Time**: 50-60 hours (2 weeks)
**Prerequisites**: Week 3-4 complete ✅
**Next**: Week 7-8 (AI Teammates)
