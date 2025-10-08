# AI Players - Requirements Specification

**Feature Branch:** `feature/ai-players`
**Status:** Requirements Complete - Ready for Implementation
**Date:** 2025-10-07

---

## 📋 Overview

Add AI-controlled players to create 3v3 matches (1 human + 2 AI bots per team), enabling more dynamic gameplay while maintaining focus on multiplayer experience.

---

## 🎯 Core Requirements

### Team Composition
- **Total Players:** 6 (3 per team)
- **Per Team:** 1 human + 2 AI bots
- **Formation:** 2 defenders (back) + 1 forward (front)
- **Positioning:** All players start in their own half

### Control Model
- **Ball Possession → Auto Control:** Player with ball is ALWAYS controlled by human
- **Ball Lost → Keep Control:** Human keeps controlling same player (no auto-switch)
- **Manual Switching:** Tap Action Button to cycle to next teammate closest to ball (excluding current)
- **Visual Indicator:** Thick white border on controlled player (existing feature)

### AI Behavior Location
- **Client-Side AI:** AI logic runs on client, not server
- **Input Submission:** Client sends all inputs (human + AI bots) in single message to server
- **Server Role:** Processes all inputs identically (doesn't distinguish human vs AI)

---

## 🤖 AI State Machine

### State Definitions

Each AI bot operates in one of 4 states with clear goals:

#### 1. **DEFEND_GET_BALL**
- **Goal:** Capture ball from opponnent
- **Trigger:** Opponent team has ball.  Player is best candidate to capture ball.
- **Behavior:** Cut of opponent player between opponent player position and own goal. full speed

#### 2. **DEFEND**
- **Goal:** Reach position between one opponnent (without ball) and own goal to a) prevent opponent to shoot a goal and b) make opponent a bad option to receive pass.
- **Trigger:** Opponent team has ball. Another Team mate is in better position to capture ball.
- **Behavior:** Cut of opponent player between opponent player position and own goal. In own thir, stick close on opponent player.

#### 3. **ATTACK_FIND_SPACE_FORWARD**
- **Goal:** Position in attacking space ahead of ball or in line with ball. Be able to receive pass or steep pass.
- **Trigger:** Teammate has ball, bot is forward
- **Behavior:** Move to open space toward opponent goal, avoid clustering

#### 4. **ATTACK_FIND_SPACE_BACKWARD**
- **Goal:** Provide support option behind ball
- **Trigger:** Teammate has ball, bot is defender/midfielder
- **Behavior:** Position in open space behind ball, passing lane available

### Movement Characteristics
- **Speed:** Up to full player speed (GAME_CONFIG.PLAYER_SPEED)
- **Randomization:** Allowed to prevent robotic feel, but NO jittering
- **Spacing:** Fill available space, avoid clustering with teammates (maintain ~150px minimum distance)

### AI Limitations
- **No Shooting:** AI bots never shoot (player with ball = human controlled)
- **No Manual Passing:** AI doesn't trigger passes (only moves to position)

---

## 🐛 Debug Visualization

### Development Mode Display
Visual debugging aids to understand AI behavior during development:

#### State Display
- **Label Position:** Above each player sprite (y - 40px)
- **Content:** Current AI state name (e.g., "DEFEND_GET_BALL", "ATTACK_FORWARD")
- **Style:** Small white text (14px), centered above player
- **Visibility:** Only shown for AI players (not human-controlled)

#### Target Position Indicator
- **Line:** Draw line from player center to target position
- **Color:** Team color (blue: 0x0066ff, red: 0xff4444), semi-transparent (0.5 alpha)
- **Width:** 2px
- **Arrow:** Optional arrowhead at target position showing direction
- **Visibility:** Only shown for AI players

#### Debug Toggle
- **Enable/Disable:** Keyboard shortcut (e.g., 'D' key) or dev flag
- **Default:** Enabled in development mode (`import.meta.env.DEV`)
- **Production:** Disabled by default, can be enabled via console

### Implementation Notes
```typescript
// GameScene.ts - Debug rendering
class GameScene {
  private debugEnabled: boolean = import.meta.env.DEV

  private renderAIDebug() {
    if (!this.debugEnabled) return

    this.players.forEach((player, playerId) => {
      if (!player.isHuman && player.aiState && player.targetPosition) {
        // Draw state label
        const stateText = this.add.text(
          player.x,
          player.y - 40,
          player.aiState,
          { fontSize: '14px', color: '#ffffff' }
        ).setOrigin(0.5)

        // Draw target line
        const targetLine = this.add.graphics()
        targetLine.lineStyle(2, player.team === 'blue' ? 0x0066ff : 0xff4444, 0.5)
        targetLine.lineBetween(
          player.x, player.y,
          player.targetPosition.x, player.targetPosition.y
        )
      }
    })
  }

  // Toggle with 'D' key
  setupDebugControls() {
    this.input.keyboard.on('keydown-D', () => {
      this.debugEnabled = !this.debugEnabled
    })
  }
}
```

---

## 🎮 Client-Side Implementation

### Input Generation Flow
```typescript
// Client update loop (60Hz):
1. Generate human input from controls
2. For each AI teammate:
   a. Determine current AI state based on game situation
   b. Calculate target position based on state goal
   c. Generate movement vector toward target
   d. Create PlayerInput for AI bot
3. Batch all inputs (1 human + 2 AI) into single message
4. Send to server via NetworkManager
```

### AI Controller Architecture
```typescript
class AIController {
  // Main entry point
  generateInput(bot: Player, gameState: GameState): PlayerInput

  // State determination
  private determineState(bot: Player, gameState: GameState): AIState

  // State-specific behaviors (4 states)
  private defendGetBall(bot: Player, opponents: Player[], ball: Ball): Vector2
  private defend(bot: Player, opponentToMark: Player, ownGoal: Position): Vector2
  private attackFindSpaceForward(bot: Player, ball: Ball): Vector2
  private attackFindSpaceBackward(bot: Player, ball: Ball): Vector2

  // Utility functions
  private avoidClustering(bot: Player, teammates: Player[]): Vector2
  private addRandomness(target: Vector2, jitterFree: boolean): Vector2

  // Debug support
  getTargetPosition(bot: Player, gameState: GameState): Vector2
  getCurrentState(bot: Player): AIState
}
```

### Input Batching
```typescript
// NetworkManager enhancement:
interface MultiPlayerInput {
  playerId: string
  input: PlayerInput
}

sendBatchInput(inputs: MultiPlayerInput[]) {
  this.room.send('batch_input', inputs)
}
```

---

## 🧪 Testing Strategy

### Test Compatibility
**Goal:** Existing 20 E2E tests must continue passing

**Approach Options (to be decided):**

#### Option A: AI Disable Flag
```typescript
// Test setup:
await page.evaluate(() => window.__disableAI = true)

// Client checks flag before running AI:
if (!window.__disableAI) {
  this.aiController.update()
}
```

#### Option B: Test-Specific Room Metadata
```typescript
// Server checks room name:
if (this.metadata.roomName?.includes('test')) {
  this.aiEnabled = false
}

// Tests join 'test-match' rooms
```

#### Option C: Human Count Detection
```typescript
// Only spawn AI if 2 humans present:
if (this.players.size === 2 && allHuman) {
  this.spawnAIPlayers()
}

// Tests use single player → no AI spawns
```

**Decision Needed:** Choose best approach during Phase 5

### AI-Specific Tests (Future Work)
Complex testing scenarios requiring careful design:
- AI state transitions work correctly
- AI maintains spacing (no clustering)
- AI responds to ball possession changes
- Manual switching cycles through teammates correctly
- Control switches to ball possessor automatically

**Note:** AI testing strategy to be developed during Phase 5

---

## 📐 Technical Architecture

### Schema Updates

#### Player Schema Enhancement
```typescript
export class Player extends Schema {
  @type('string') id: string
  @type('string') team: Team
  @type('boolean') isHuman: boolean  // true = human, false = AI bot
  @type('boolean') isControlled: boolean  // Currently controlled by this client's human

  // NEW: AI-specific fields (client-side only, not synced)
  aiState?: AIState  // Current AI behavior state
  role?: 'defender' | 'forward'  // Formation role

  // Existing fields...
  @type('number') x: number
  @type('number') y: number
  // ... etc
}

type AIState =
  | 'DEFEND_GET_BALL'       // Capture ball from opponent
  | 'DEFEND'                // Mark opponent without ball
  | 'ATTACK_FIND_SPACE_FORWARD'   // Position ahead of ball
  | 'ATTACK_FIND_SPACE_BACKWARD'  // Support behind ball
```

#### Server Input Processing
```typescript
// MatchRoom.ts - Accept batch inputs
this.onMessage('batch_input', (client, message: MultiPlayerInput[]) => {
  message.forEach(({ playerId, input }) => {
    this.state.queueInput(playerId, input)
  })
})

// GameState.ts - Process inputs same as before
// (No changes needed - already processes all inputs identically)
```

### Starting Positions

Positions calculated relative to field size (1920x1080) for vertical symmetry:

#### Blue Team (Left Side)
```typescript
// Formation: human = forward, 2 bots = defenders
// Calculated: forwardX = 0.36 * width, defenderX = 0.19 * width
positions = {
  human: { x: 691, y: 540, role: 'forward' },     // Center forward (0.36w, 0.5h)
  bot1:  { x: 365, y: 270, role: 'defender' },    // Top defender (0.19w, 0.25h)
  bot2:  { x: 365, y: 810, role: 'defender' }     // Bottom defender (0.19w, 0.75h)
}
```

#### Red Team (Right Side)
```typescript
// Formation: human = forward, 2 bots = defenders (vertically mirrored)
// Calculated: forwardX = 0.64 * width, defenderX = 0.81 * width
positions = {
  human: { x: 1229, y: 540, role: 'forward' },    // Center forward (0.64w, 0.5h)
  bot1:  { x: 1555, y: 810, role: 'defender' },   // Bottom defender (0.81w, 0.75h - mirrored)
  bot2:  { x: 1555, y: 270, role: 'defender' }    // Top defender (0.81w, 0.25h - mirrored)
}
```

### Performance Considerations

#### Input Volume
- **Current:** 2 players × 60 inputs/sec = 120 inputs/sec
- **With AI:** 6 players × 60 inputs/sec = 360 inputs/sec
- **Impact:** 3× input volume, but server already handles 60Hz tick rate
- **Mitigation:** Batch inputs per client (reduces messages from 6 to 2 per frame)

#### Client CPU Load
- **AI Processing:** ~3-5 calculations per bot per frame (60Hz)
- **Per Client:** 2 AI bots × 60 fps = 120 AI updates/sec
- **Complexity:** Simple state machine + vector math (minimal overhead)

---

## 🚀 Implementation Phases

### Phase 1: AI Entity Infrastructure
**Goal:** Add AI players that render but don't move

**Tasks:**
1. Update GameState to spawn 2 AI bots per team on match start
2. Set isHuman=false and assign formation roles
3. Position bots according to formation (defenders back, forward front)
4. Client renders AI players (standard border, team color)
5. Verify 6 players appear in game

**Validation:**
- All 6 players visible on screen
- Correct team colors
- Proper formation spacing
- Existing tests still pass

---

### Phase 2: Manual Player Switching
**Goal:** Human can manually cycle control between teammates

**Tasks:**
1. Detect Action Button tap (not hold) to trigger switch
2. Calculate distances from all teammates to ball
3. Sort by distance, exclude currently controlled player
4. Switch control to next closest teammate
5. Update visual indicator (thick border) to new controlled player
6. Ensure control switches to ball possessor automatically

**Validation:**
- Tapping Action Button switches to next teammate
- Visual indicator moves to new controlled player
- Gaining possession auto-switches control
- Control switching feels responsive

---

### Phase 3: Client-Side AI Input Generation
**Goal:** AI bots move intelligently based on game state

**Tasks:**
1. Create AIController class on client
2. Implement state determination logic (5 states)
3. Implement movement calculations for each state
4. Add clustering avoidance (maintain spacing)
5. Add movement randomization (smooth, no jitter)
6. Batch AI inputs with human input in single message
7. Update NetworkManager to send batch_input messages
8. Update server to process batch_input messages

**Validation:**
- AI bots move toward ball when loose
- AI spreads out when teammate has ball
- AI maintains spacing (no clustering)
- Movement feels natural (not robotic)
- Server processes all inputs correctly

---

### Phase 4: AI State Machine Refinement
**Goal:** Fine-tune AI behaviors for each state

**Tasks:**
1. Tune DEFEND_GET_BALL: Direct path to ball
2. Tune DEFEND_GUARD_GOAL: Position between ball and goal
3. Tune DEFEND_GUARD_OPPONENT: Apply pressure on ball carrier
4. Tune ATTACK_FIND_SPACE_FORWARD: Open space ahead of ball
5. Tune ATTACK_FIND_SPACE_BACKWARD: Support position behind ball
6. Balance randomness (natural feel without jitter)
7. Adjust AI reaction times if needed

**Validation:**
- Each AI state achieves its goal
- Transitions between states are smooth
- AI behavior enhances gameplay (not frustrating)
- Defenders protect goal effectively
- Forwards create attacking opportunities

---

### Phase 5: Testing & Compatibility
**Goal:** Ensure all tests pass and AI is properly tested

**Tasks:**
1. Choose AI disable strategy (flag, room metadata, or human count)
2. Implement chosen strategy
3. Run full test suite, verify 20 tests pass
4. Design AI-specific test scenarios
5. Implement AI behavior tests (if feasible)
6. Document testing approach and limitations

**Validation:**
- All existing 20 E2E tests pass
- Tests run without AI interference
- AI behavior is validated (manually or automated)
- Edge cases documented (e.g., AI in goal zone)

---

## 🔧 Configuration

### Constants to Add
```typescript
// GAME_CONFIG additions:
export const GAME_CONFIG = {
  // ... existing constants

  // AI Configuration
  AI_ENABLED: true,  // Global AI toggle
  AI_PER_TEAM: 2,    // Number of AI bots per team
  AI_SPACING_MIN: 150,  // Minimum distance between bots (px)

  // AI Movement
  AI_RANDOMNESS: 20,  // Random offset range (px) for natural feel
  AI_UPDATE_INTERVAL: 1000/60,  // AI decision frequency (60Hz)

  // Formation Positions (calculated relative to field size)
  FORMATION: {
    // Blue team (left): human = forward, bots = defenders
    BLUE_FORWARD_X: 0.36,    // 36% of field width
    BLUE_DEFENDER_X: 0.19,   // 19% of field width
    // Red team (right): human = forward, bots = defenders
    RED_FORWARD_X: 0.64,     // 64% of field width
    RED_DEFENDER_X: 0.81,    // 81% of field width
    // Vertical positions (same for both teams)
    DEFENDER_TOP_Y: 0.25,    // 25% of field height
    DEFENDER_BOTTOM_Y: 0.75, // 75% of field height
    FORWARD_Y: 0.5,          // 50% of field height (center)
  }
} as const
```

---

## 📊 Success Criteria

### MVP Success (Phase 3 Complete)
- ✅ 6 players render correctly (3 per team)
- ✅ Manual switching works via Action Button
- ✅ Auto-control on ball possession
- ✅ AI bots move intelligently (chase ball, find space)
- ✅ AI maintains spacing (no clustering)
- ✅ All existing tests pass

### Full Success (Phase 5 Complete)
- ✅ AI state machine fully implemented (5 states)
- ✅ AI behavior feels natural (smooth, not robotic)
- ✅ Defenders protect goal effectively
- ✅ Forwards create attacking space
- ✅ AI-specific tests validate behavior
- ✅ Performance acceptable (60 FPS maintained)

---

## 🚧 Known Limitations & Future Work

### Current Scope Limitations
- AI does not shoot (always human-controlled when has ball)
- AI does not manually pass (only moves to position)
- No AI difficulty levels (fixed behavior)
- No role-specific advanced tactics (e.g., offside trap)

### Future Enhancements (Post-MVP)
- AI passing decisions (when to pass to human)
- AI difficulty levels (Easy, Medium, Hard)
- More nuanced state machine (e.g., INTERCEPT_PASS state)
- AI formations (4-4-2, 3-5-2, etc.)
- AI learning from human play patterns
- Advanced defensive AI (zonal marking, man-to-man)

---

## 📝 Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Location | Client-side | Reduces server load, user preference |
| Control Model | Auto on possession, manual via button | Keeps human engaged with ball action |
| Visual Indicator | Thick white border (existing) | Already implemented, familiar |
| Formation | 2 defenders + 1 forward | Simple, balanced for 3v3 |
| AI States | 5 goal-based states | Clear behaviors, extensible |
| Input Batching | Single message per client | Reduces network messages |
| Test Strategy | TBD in Phase 5 | Evaluate options during implementation |

---

## ✅ Requirements Sign-Off

**Status:** ✅ Requirements Complete
**Next Step:** Begin Phase 1 - AI Entity Infrastructure
**Branch:** `feature/ai-players`
**Estimated Total Effort:** 5 phases, iterative development

---

*This requirements document will be updated as implementation progresses and new insights emerge.*
