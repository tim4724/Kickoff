# Week 5-6 Phase 2: State Synchronization Workflow

**Phase**: Week 5-6 Phase 2
**Duration**: Days 28-30 (Estimated 10-13 hours)
**Status**: 📋 READY TO START
**Prerequisites**: Phase 1 Complete ✅

---

## 🎯 Phase 2 Objectives

**Primary Goal**: Enable two players to see each other moving in real-time

**Deliverables**:
- ✅ Remote players rendered from server state
- ✅ Ball synchronized across all clients
- ✅ Score and timer synced from server
- ✅ Two-player match fully playable

**Success Criteria**:
- Both players see each other's movements
- Ball position matches on both clients
- Goals scored appear on both screens
- Match timer counts down synchronously
- No desynchronization issues

---

## 📊 Current Status

### What's Complete ✅
- **Week 1-2**: Foundation & Single Player
- **Week 3-4**: Local Gameplay & Ball Mechanics (Phase 1+2)
- **Week 5-6 Phase 1**: Server Foundation & Client Connection
  - Colyseus server running (30 Hz)
  - NetworkManager created (307 lines)
  - Server-client connection verified (100% test pass rate)
  - Schema aligned between server and client

### What's Next 🎯
- **Phase 2**: State Synchronization (Current)
- **Phase 3**: Client-Side Prediction
- **Phase 4**: Polish & Testing

---

## 🔧 Implementation Plan

### Day 28: Remote Player Rendering

**Objective**: Display other players from server state
**Duration**: 4-5 hours
**Deliverable**: Remote player sprites visible and moving

#### Task 28.1: Add Remote Player Data Structures

**File**: `client/src/scenes/GameScene.ts`

**Code to Add**:
```typescript
// Add after existing player properties
private remotePlayers: Map<string, Phaser.GameObjects.Rectangle> = new Map()
private remotePlayerIndicators: Map<string, Phaser.GameObjects.Circle> = new Map()
private networkManager?: NetworkManager
private mySessionId?: string
private isMultiplayer: boolean = false
```

**Validation**: TypeScript compiles without errors

---

#### Task 28.2: Initialize Network Connection

**File**: `client/src/scenes/GameScene.ts` → `create()` method

**Code to Add** (after device detection):
```typescript
// Connect to multiplayer server
try {
  this.networkManager = new NetworkManager()
  await this.networkManager.connect()
  this.mySessionId = this.networkManager.getMySessionId()
  this.isMultiplayer = true

  console.log('🎮 Multiplayer mode enabled')
  console.log('📡 Session ID:', this.mySessionId)

  this.setupNetworkListeners()
} catch (error) {
  console.warn('⚠️ Multiplayer unavailable, running single-player')
  this.isMultiplayer = false
}
```

**Don't forget to import**:
```typescript
import { NetworkManager } from '../network/NetworkManager'
```

**Validation**: Game loads without errors, console shows connection status

---

#### Task 28.3: Setup Network Event Listeners

**File**: `client/src/scenes/GameScene.ts`

**Method to Add**:
```typescript
private setupNetworkListeners() {
  if (!this.networkManager) return

  // Player joined event
  this.networkManager.on('playerJoin', (player: any) => {
    console.log('👤 Remote player joined:', player.id, player.team)
    if (player.id !== this.mySessionId) {
      this.createRemotePlayer(player.id, player)
    }
  })

  // Player left event
  this.networkManager.on('playerLeave', (playerId: string) => {
    console.log('👋 Remote player left:', playerId)
    this.removeRemotePlayer(playerId)
  })

  // State change event
  this.networkManager.on('stateChange', (state: any) => {
    this.updateFromServerState(state)
  })

  // Goal scored event
  this.networkManager.on('goalScored', (data: any) => {
    console.log('⚽ Goal scored by', data.team)
    if (!this.goalScored) {
      this.onGoalScored(data.team)
    }
  })

  // Match end event
  this.networkManager.on('matchEnd', (data: any) => {
    console.log('🏁 Match ended, winner:', data.winner)
    if (!this.matchEnded) {
      this.onMatchEnd()
    }
  })
}
```

**Validation**: Event listeners registered, console shows no errors

---

#### Task 28.4: Implement createRemotePlayer()

**File**: `client/src/scenes/GameScene.ts`

**Method to Add**:
```typescript
private createRemotePlayer(sessionId: string, playerState: any) {
  console.log('🎭 Creating remote player:', sessionId, playerState.team)

  // Determine color based on team
  const color = playerState.team === 'blue' ? 0x0066ff : 0xff4444

  // Create player sprite
  const remotePlayer = this.add.rectangle(
    playerState.x,
    playerState.y,
    30,
    40,
    color
  )
  remotePlayer.setStrokeStyle(2, 0xffffff)
  remotePlayer.setDepth(10)

  // Create indicator circle above player
  const indicator = this.add.circle(
    playerState.x,
    playerState.y - 25,
    8,
    0xffff00
  )
  indicator.setDepth(11)

  // Store references
  this.remotePlayers.set(sessionId, remotePlayer)
  this.remotePlayerIndicators.set(sessionId, indicator)

  console.log('✅ Remote player created:', sessionId)
}
```

**Validation**: Remote player sprite created when second player joins

---

#### Task 28.5: Implement removeRemotePlayer()

**File**: `client/src/scenes/GameScene.ts`

**Method to Add**:
```typescript
private removeRemotePlayer(sessionId: string) {
  const sprite = this.remotePlayers.get(sessionId)
  const indicator = this.remotePlayerIndicators.get(sessionId)

  if (sprite) {
    sprite.destroy()
    this.remotePlayers.delete(sessionId)
  }

  if (indicator) {
    indicator.destroy()
    this.remotePlayerIndicators.delete(sessionId)
  }

  console.log('🗑️ Remote player removed:', sessionId)
}
```

**Validation**: Remote player sprite removed when player disconnects

---

#### Task 28.6: Update Remote Players in Game Loop

**File**: `client/src/scenes/GameScene.ts` → `update()` method

**Code to Add** (after existing update logic):
```typescript
// Update remote players from server state (if multiplayer)
if (this.isMultiplayer && this.networkManager) {
  const state = this.networkManager.getState()
  if (state) {
    state.players.forEach((player: any, sessionId: string) => {
      if (sessionId !== this.mySessionId) {
        this.updateRemotePlayer(sessionId, player)
      }
    })
  }
}
```

**Method to Add**:
```typescript
private updateRemotePlayer(sessionId: string, playerState: any) {
  const sprite = this.remotePlayers.get(sessionId)
  const indicator = this.remotePlayerIndicators.get(sessionId)

  if (sprite && indicator) {
    // Direct position update (interpolation in Phase 3)
    sprite.x = playerState.x
    sprite.y = playerState.y
    indicator.x = playerState.x
    indicator.y = playerState.y - 25
  }
}
```

**Validation**: Remote player moves when other client sends input

---

#### Task 28.7: Update Local Player Input

**File**: `client/src/scenes/GameScene.ts` → `updatePlayerMovement()` method

**Code to Modify**:
```typescript
private updatePlayerMovement(dt: number) {
  // Existing movement calculation...

  // Send input to server if multiplayer
  if (this.isMultiplayer && this.networkManager) {
    const movement = {
      x: this.playerVelocity.x / GAME_CONFIG.PLAYER_SPEED,
      y: this.playerVelocity.y / GAME_CONFIG.PLAYER_SPEED
    }
    this.networkManager.sendInput(movement, false) // false = not action button
  }

  // Apply local movement (client-side prediction for now)
  this.player.x += this.playerVelocity.x * dt
  this.player.y += this.playerVelocity.y * dt

  // Existing boundary clamping...
}
```

**Validation**: Local player movement sent to server, remote player sees it

---

#### Day 28 Testing Checkpoint

**Test Protocol**:
1. Start server: `npm run dev:server`
2. Start client: `npm run dev:client`
3. Open http://localhost:5173 in two browser windows
4. Move player in window 1 → verify movement appears in window 2
5. Move player in window 2 → verify movement appears in window 1

**Expected Results**:
- ✅ Both players see each other
- ✅ Movement is synchronized
- ✅ No console errors
- ✅ Players have correct team colors

---

### Day 29: Ball Synchronization

**Objective**: Sync ball from server state
**Duration**: 3-4 hours
**Deliverable**: Ball position matches on all clients

#### Task 29.1: Create updateBallFromServer()

**File**: `client/src/scenes/GameScene.ts`

**Method to Add**:
```typescript
private updateBallFromServer() {
  if (!this.isMultiplayer || !this.networkManager) return

  const state = this.networkManager.getState()
  if (!state) return

  // Update ball position from server (server-authoritative)
  this.ball.x = state.ball.x
  this.ball.y = state.ball.y

  // Store velocity for visual reference (not physics)
  this.ballVelocity.x = state.ball.velocityX
  this.ballVelocity.y = state.ball.velocityY
}
```

**Validation**: Method compiles without errors

---

#### Task 29.2: Disable Client-Side Ball Physics

**File**: `client/src/scenes/GameScene.ts` → `update()` method

**Code to Modify**:
```typescript
update(time: number, delta: number) {
  const dt = delta / 1000

  // Update from server state first if multiplayer
  if (this.isMultiplayer) {
    this.updateBallFromServer()
  } else {
    // Single-player: run local physics
    this.updateBallPhysics(dt)
  }

  // Rest of update logic...
  this.checkCollisions()

  // Only check goals locally in single-player mode
  if (!this.isMultiplayer) {
    const goalResult = this.checkGoal()
    if (goalResult.scored && goalResult.team) {
      this.onGoalScored(goalResult.team)
    }
  }

  // Existing code...
}
```

**Also modify `updateBallPhysics()`**:
```typescript
private updateBallPhysics(dt: number) {
  // Skip if multiplayer (server handles physics)
  if (this.isMultiplayer) return

  // Existing ball physics code...
}
```

**Validation**: Ball doesn't move locally in multiplayer, only from server

---

#### Task 29.3: Update Shoot Action

**File**: `client/src/scenes/GameScene.ts` → shoot action handler

**Code to Modify**:
```typescript
// In action button handler or shoot method
private shootBall(power: number = 0.8) {
  if (this.isMultiplayer && this.networkManager) {
    // Multiplayer: send action to server
    this.networkManager.sendInput({ x: 0, y: 0 }, true) // true = action button
    console.log('📤 Shoot action sent to server, power:', power)
  } else {
    // Single-player: apply local physics
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
      const shootSpeed = GAME_CONFIG.SHOOT_SPEED
      this.ballVelocity.x = (dx / dist) * shootSpeed * power
      this.ballVelocity.y = (dy / dist) * shootSpeed * power
    }
  }
}
```

**Validation**: Shoot action sent to server, ball moves on both clients

---

#### Task 29.4: Sync Score and Timer

**File**: `client/src/scenes/GameScene.ts`

**Method to Add/Modify**:
```typescript
private updateFromServerState(state: any) {
  if (!state) return

  // Update score display
  this.scoreText.setText(`${state.scoreBlue} - ${state.scoreRed}`)

  // Update timer display
  const minutes = Math.floor(state.matchTime / 60)
  const seconds = Math.floor(state.matchTime % 60)
  this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

  // Update timer color (warning when < 30 seconds)
  if (state.matchTime <= 30 && state.matchTime > 0) {
    this.timerText.setColor('#ff4444')
  } else {
    this.timerText.setColor('#ffffff')
  }

  // Check if match ended
  if (state.matchEnded && !this.matchEnded) {
    this.matchEnded = true
    this.showMatchEndScreen(state.winner)
  }
}
```

**Validation**: Score and timer update from server state

---

#### Task 29.5: Disable Local Timer

**File**: `client/src/scenes/GameScene.ts` → `startMatchTimer()` and `updateTimer()`

**Code to Modify**:
```typescript
private startMatchTimer() {
  // Skip if multiplayer (server handles timer)
  if (this.isMultiplayer) return

  // Single-player timer code...
}

private updateTimer() {
  // Skip if multiplayer
  if (this.isMultiplayer) return

  // Single-player timer code...
}
```

**Validation**: Timer only runs on server, clients display server time

---

#### Day 29 Testing Checkpoint

**Test Protocol**:
1. Open two browser windows
2. Player 1 shoots ball → verify ball moves in both windows
3. Player 2 shoots ball → verify ball moves in both windows
4. Player 1 scores goal → verify score updates in both windows
5. Verify timer counts down identically in both windows

**Expected Results**:
- ✅ Ball movement synchronized
- ✅ Goals detected and scored correctly
- ✅ Score matches on both clients
- ✅ Timer matches on both clients

---

### Day 30: Testing & Validation

**Objective**: Comprehensive testing and issue documentation
**Duration**: 3-4 hours
**Deliverable**: Phase 2 completion report

#### Task 30.1: Two-Player Movement Testing

**Test Scenarios**:
1. **Basic Movement**
   - Player 1 moves left → verify in window 2
   - Player 1 moves right → verify in window 2
   - Player 2 moves up → verify in window 1
   - Player 2 moves down → verify in window 1

2. **Simultaneous Movement**
   - Both players move at same time
   - Verify no collision issues
   - Verify smooth rendering

3. **Edge Cases**
   - Player moves to field boundary
   - Rapid direction changes
   - Quick start/stop movements

**Document**: Record any jitter, lag, or desync issues

---

#### Task 30.2: Ball Synchronization Testing

**Test Scenarios**:
1. **Basic Shooting**
   - Player 1 shoots → ball moves in both windows
   - Player 2 shoots → ball moves in both windows
   - Verify ball trajectory matches

2. **Possession**
   - Verify possession indicator shows for correct player
   - Test possession transfer between players

3. **Ball Physics**
   - Verify ball bounces off boundaries correctly
   - Verify friction/deceleration matches

**Document**: Any ball position mismatches or physics issues

---

#### Task 30.3: Score & Timer Testing

**Test Scenarios**:
1. **Goal Scoring**
   - Player 1 scores in left goal → verify score update
   - Player 2 scores in right goal → verify score update
   - Verify celebration effects appear on both clients

2. **Timer Synchronization**
   - Verify timer starts at 2:00 on both clients
   - Verify countdown is synchronized
   - Verify warning color appears at 30 seconds on both

3. **Match End**
   - Let timer reach 0:00
   - Verify match end screen appears on both clients
   - Verify correct winner displayed

**Document**: Any timing mismatches or UI issues

---

#### Task 30.4: Latency Measurement

**Measurement Method**:
```typescript
// Add to GameScene for testing
private measureLatency() {
  const startTime = Date.now()

  // Send timestamp to server
  this.networkManager?.sendInput({ x: 0, y: 0 }, false)

  // Measure time until state update returns
  this.networkManager?.once('stateChange', () => {
    const latency = Date.now() - startTime
    console.log(`📊 Round-trip latency: ${latency}ms`)
  })
}
```

**Test Protocol**:
1. Call `measureLatency()` 10 times
2. Record all values
3. Calculate average latency

**Target**: < 100ms on local network

**Document**: Average, min, max latency values

---

#### Task 30.5: Create Phase 2 Completion Report

**File to Create**: `WEEK5-6_PHASE2_COMPLETE.md`

**Content Structure**:
```markdown
# Week 5-6 Phase 2 Completion Report

## Executive Summary
- Completion date
- Actual time vs estimated
- Overall status

## What Was Accomplished
- Remote player rendering
- Ball synchronization
- Score/timer sync
- Testing results

## Test Results
- Movement testing: Pass/Fail + notes
- Ball sync testing: Pass/Fail + notes
- Score/timer testing: Pass/Fail + notes
- Latency measurements

## Known Issues
- List any bugs or limitations

## Performance Metrics
- Average latency
- Frame rate impact
- Network bandwidth usage

## Next Steps
- Phase 3 preview
- Remaining tasks
```

---

## ✅ Success Criteria

### Technical Requirements
- [ ] Remote players render correctly
- [ ] Player positions synchronized
- [ ] Ball synchronized from server
- [ ] Goals detected on all clients
- [ ] Score matches on all clients
- [ ] Timer matches on all clients
- [ ] Match end flow works

### Performance Targets
- [ ] 60 FPS maintained on client
- [ ] < 100ms latency on local network
- [ ] No memory leaks after 10-minute session
- [ ] No console errors during normal gameplay

### Quality Metrics
- [ ] No visual glitches or artifacts
- [ ] Smooth player movement (no jitter)
- [ ] Ball trajectory matches expectations
- [ ] UI updates properly synchronized

---

## 🚨 Common Issues & Solutions

### Issue: Remote player not appearing
**Diagnosis**: Check network event listeners setup
**Solution**:
- Verify `setupNetworkListeners()` called after connection
- Check `createRemotePlayer()` is called for remote players only
- Verify sessionId comparison logic

### Issue: Ball position desyncs
**Diagnosis**: Client-side physics still running
**Solution**:
- Ensure `updateBallPhysics()` returns early in multiplayer
- Verify `updateBallFromServer()` is called every frame
- Check server is updating ball state

### Issue: Jittery remote players
**Diagnosis**: No interpolation between updates
**Solution** (Phase 3):
- Implement entity interpolation
- Add smoothing to position updates
- Increase server tick rate if needed

### Issue: Score doesn't update
**Diagnosis**: Goal events not triggering
**Solution**:
- Verify `goalScored` event listener setup
- Check server is emitting goal events
- Verify `updateFromServerState()` updates score text

---

## 📚 Code Integration Checklist

### GameScene.ts Modifications
- [ ] Import NetworkManager
- [ ] Add remote player data structures
- [ ] Initialize network connection in create()
- [ ] Setup network event listeners
- [ ] Implement createRemotePlayer()
- [ ] Implement removeRemotePlayer()
- [ ] Implement updateRemotePlayer()
- [ ] Implement updateBallFromServer()
- [ ] Implement updateFromServerState()
- [ ] Modify update() to use server state
- [ ] Disable local physics in multiplayer
- [ ] Disable local timer in multiplayer
- [ ] Update input sending logic

### Testing Files
- [ ] Create manual test protocol document
- [ ] Run two-player movement tests
- [ ] Run ball synchronization tests
- [ ] Run score/timer tests
- [ ] Measure latency
- [ ] Document results

---

## 📊 Estimated Timeline

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| Day 28: Remote Player Rendering | 4-5 hours | Medium |
| Day 29: Ball Synchronization | 3-4 hours | Medium |
| Day 30: Testing & Validation | 3-4 hours | Low |
| **Total Phase 2** | **10-13 hours** | **Medium** |

**Efficiency Projection**: Based on Phase 1 performance (4-5x faster), Phase 2 could complete in **2-3 hours**.

---

## 🎯 Next Phase Preview

### Phase 3: Client-Side Prediction (Days 31-33)
**Goal**: Make local player feel responsive despite latency

**Key Features**:
- Input buffering and sequence numbers
- Client-side prediction for local player
- Server reconciliation
- Smooth interpolation for remote players

**Estimated Time**: 10-12 hours (or 2-3 hours at current efficiency)

---

## 📝 Notes

### Development Best Practices
- Commit after each major task completion
- Test frequently (after every 30-60 minutes of work)
- Use console.log liberally for debugging
- Keep server and client logs visible

### Debugging Tips
- Use Chrome DevTools Network tab to inspect WebSocket messages
- Use Colyseus Monitor (http://localhost:3000/colyseus) to view room state
- Add visual debug overlays for network state
- Test on local network first before remote testing

---

**Document Status**: ✅ Ready for Implementation
**Created**: 2025-10-01
**Prerequisites**: Phase 1 Complete ✅
**Next**: Phase 3 (Client-Side Prediction)
