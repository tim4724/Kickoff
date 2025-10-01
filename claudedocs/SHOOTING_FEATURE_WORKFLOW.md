# Shooting Feature Implementation Workflow

**Date**: 2025-10-01
**Feature**: Player Shooting Mechanics
**Status**: ✅ **Already Implemented** - Enhancement & Test Coverage Phase

---

## Executive Summary

**Current Status**: Shooting mechanics are **fully implemented** in both server and client code.

**Implementation Details**:
- **Server**: `server/src/schema/GameState.ts:276-309` - `handlePlayerAction()` method
- **Client**: `client/src/scenes/GameScene.ts:228-245` - `shootBall()` method
- **Trigger**: Space bar (desktop) or Action button (mobile)
- **Mechanics**: Shoot in player's facing direction with 80% power when in possession

**This Workflow**: Focuses on **comprehensive test coverage** and potential **enhancements**.

---

## Part 1: Existing Implementation Analysis

### Server-Side Shooting (`GameState.ts:276-309`)

```typescript
private handlePlayerAction(player: Player) {
  // Check if this player has possession
  if (this.ball.possessedBy === player.id) {
    // Shoot in the direction player is facing
    const power = 0.8
    const dx = Math.cos(player.direction)
    const dy = Math.sin(player.direction)

    this.ball.velocityX = dx * GAME_CONFIG.SHOOT_SPEED * power
    this.ball.velocityY = dy * GAME_CONFIG.SHOOT_SPEED * power
    this.ball.possessedBy = ''

    player.state = 'kicking'

    // Logs direction, position, and velocity
  } else {
    // Try to gain possession first if close enough
    const dist = Math.sqrt((this.ball.x - player.x)**2 + (this.ball.y - player.y)**2)

    if (dist < GAME_CONFIG.POSSESSION_RADIUS && this.ball.possessedBy === '') {
      this.ball.possessedBy = player.id
    }
  }
}
```

**Key Shooting Parameters**:
- `SHOOT_SPEED`: 400 px/s
- `power`: 0.8 (fixed, 80% of max speed)
- **Direction**: Based on `player.direction` (angle in radians)
- **Result**: Ball velocity = 320 px/s at 80% power

### Client-Side Shooting (`GameScene.ts:228-245`)

```typescript
private shootBall(power: number = 0.8) {
  if (this.isMultiplayer && this.networkManager) {
    // Multiplayer: send action to server
    this.networkManager.sendInput({ x: 0, y: 0 }, true) // true = action button
  } else {
    // Single-player: apply local physics
    const dx = this.ball.x - this.player.x
    const dy = this.ball.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
      this.ballVelocity.x = (dx / dist) * GAME_CONFIG.SHOOT_SPEED * power
      this.ballVelocity.y = (dy / dist) * GAME_CONFIG.SHOOT_SPEED * power
    }
  }
}
```

**Client Features**:
- **Keyboard**: Space bar triggers shoot
- **Mobile**: Action button (bottom-right) with hold-to-power mechanic
- **Variable Power**: Action button supports power variation (0.0-1.0)
- **Network**: In multiplayer, sends action flag to server

### Current Limitations

1. **Fixed Power in Multiplayer**: Server always uses 0.8 power, ignoring client power value
2. **No Shoot Cooldown**: Players can spam shoot button
3. **No Power Variation**: Server doesn't receive or apply variable power from action button
4. **No Animation Feedback**: Only state change to 'kicking', no visual feedback
5. **No Test Coverage**: Zero tests for shooting mechanics

---

## Part 2: Test Strategy

### Test Suite: `tests/shooting-mechanics.spec.ts`

#### Test 1: Basic Shooting When In Possession ✅
**Purpose**: Verify ball launches when player has possession and presses action

**Steps**:
1. Connect single client
2. Move player to gain ball possession
3. Press space/action button
4. Verify ball velocity > 0
5. Verify ball possession released
6. Verify player state = 'kicking'

**Success Criteria**:
- Ball gains velocity immediately after shoot
- `ball.possessedBy` becomes empty string
- Ball moves away from player
- Ball velocity magnitude ≈ 320 px/s (400 * 0.8)

#### Test 2: Shoot Direction Accuracy ✅
**Purpose**: Verify ball travels in player's facing direction

**Steps**:
1. Gain possession
2. Move player in specific direction (e.g., right)
3. Shoot immediately
4. Track ball trajectory for 1 second
5. Calculate angle of ball movement

**Success Criteria**:
- Ball direction matches player direction ±10°
- Ball travels in straight line (no curve)
- Ball velocity remains consistent with friction

#### Test 3: No Shoot Without Possession ✅
**Purpose**: Verify shoot does nothing when player doesn't have ball

**Steps**:
1. Position player far from ball (>50px)
2. Press shoot button
3. Verify ball doesn't move
4. Verify no ball velocity change

**Success Criteria**:
- Ball velocity remains 0
- Ball position unchanged
- No 'kicking' state triggered

#### Test 4: Shoot Power Variation (Action Button) ⚠️
**Purpose**: Verify hold-to-power mechanic works on action button

**Steps**:
1. Gain possession
2. Press and hold action button for 100ms (weak)
3. Measure ball velocity
4. Reset and repeat with 500ms hold (strong)
5. Compare velocities

**Success Criteria**:
- Longer hold = higher velocity
- 100ms hold ≈ 160 px/s (50% power)
- 500ms hold ≈ 320 px/s (100% power)

**Status**: ⚠️ **May not work in multiplayer** (server uses fixed 0.8 power)

#### Test 5: Multiplayer Shooting Synchronization ✅
**Purpose**: Verify both clients see shoot action correctly

**Steps**:
1. Connect two clients
2. Client 1 gains possession
3. Client 1 shoots
4. Verify ball moves on Client 1
5. Verify ball moves on Client 2
6. Compare ball velocities across clients

**Success Criteria**:
- Ball velocity synchronized within 10%
- Ball direction matches across clients
- Possession released on both clients
- No desync or rubber-banding

#### Test 6: Rapid Shooting (No Cooldown) ✅
**Purpose**: Document behavior of rapid shoot spam

**Steps**:
1. Gain possession
2. Spam shoot button 10 times in 1 second
3. Observe ball behavior

**Expected Result** (Current Implementation):
- First shoot releases ball
- Subsequent shoots have no effect (no possession)
- No explicit cooldown mechanism

**Enhancement Needed**: Consider adding cooldown to prevent accidental double-shoots

#### Test 7: Shoot at Goal (Integration Test) ✅
**Purpose**: End-to-end test of shooting to score

**Steps**:
1. Position player near opponent's goal
2. Gain possession
3. Face goal direction
4. Shoot ball
5. Verify goal detection

**Success Criteria**:
- Ball enters goal zone
- Goal event fires
- Score increments
- Ball resets to center

---

## Part 3: Enhancement Opportunities

### Enhancement 1: Variable Power in Multiplayer
**Problem**: Server ignores client's power value from action button

**Solution**:
1. Modify input protocol to include power value
2. Update `PlayerInput` interface:
```typescript
interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number // NEW: 0.0-1.0
  timestamp: number
}
```
3. Update server `handlePlayerAction()` to use `input.actionPower`
4. Update client `NetworkManager.sendInput()` to send power

**Benefit**: Action button hold-to-power works in multiplayer

### Enhancement 2: Shoot Cooldown
**Problem**: No cooldown leads to accidental double-shoots or spam

**Solution**:
1. Add `lastShootTime: number` to Player schema
2. Check cooldown in `handlePlayerAction()`:
```typescript
const SHOOT_COOLDOWN = 300 // 300ms

if (Date.now() - player.lastShootTime < SHOOT_COOLDOWN) {
  return // Ignore shoot during cooldown
}
```
3. Update `lastShootTime` on successful shoot

**Benefit**: Prevents accidental double-shoots, more realistic gameplay

### Enhancement 3: Visual Shoot Feedback
**Problem**: Only state change to 'kicking', no animation or effects

**Solution**:
1. Add shoot animation/tween to player sprite
2. Add kick sound effect
3. Add visual "pow" effect at ball launch
4. Add trail effect to fast-moving ball

**Benefit**: Better player feedback, more satisfying shooting

### Enhancement 4: Direction Prediction
**Problem**: Ball shoots in exact player direction, which may feel stiff

**Solution**:
1. Consider adding slight "aim assist" toward goal
2. Add momentum to direction (ball shoots slightly ahead of movement)
3. Add manual aiming control (optional)

**Benefit**: More forgiving shooting, better game feel

### Enhancement 5: Shoot Charge System
**Problem**: Current power is instant, no skill component

**Solution** (Optional):
1. Add charging mechanic (hold to charge, up to max)
2. Add visual charge indicator
3. Add "perfect timing" mechanic for bonus power

**Benefit**: Adds skill ceiling, more engaging shooting

---

## Part 4: Implementation Plan

### Phase 1: Test Coverage (Priority: **HIGH**)
**Duration**: 2-3 hours

**Tasks**:
1. ✅ Create `tests/shooting-mechanics.spec.ts`
2. ✅ Implement Test 1: Basic shooting
3. ✅ Implement Test 2: Direction accuracy
4. ✅ Implement Test 3: No shoot without possession
5. ✅ Implement Test 5: Multiplayer sync
6. ✅ Implement Test 7: Shoot at goal (integration)
7. ⚠️ Implement Test 4: Power variation (document limitation)
8. ⚠️ Implement Test 6: Rapid shooting (document behavior)

**Success Criteria**:
- All basic tests passing
- Shooting mechanics validated
- Coverage documented

### Phase 2: Variable Power (Priority: **MEDIUM**)
**Duration**: 1-2 hours

**Tasks**:
1. Update `PlayerInput` interface with `actionPower`
2. Modify `NetworkManager.sendInput()` to send power
3. Update server `handlePlayerAction()` to use power
4. Update Test 4 to verify power variation works

**Success Criteria**:
- Action button hold-to-power works in multiplayer
- Test 4 passes
- No regression in existing tests

### Phase 3: Shoot Cooldown (Priority: **LOW**)
**Duration**: 1 hour

**Tasks**:
1. Add `lastShootTime` to Player schema
2. Implement cooldown check in `handlePlayerAction()`
3. Add test for cooldown enforcement
4. Document cooldown value (300ms recommended)

**Success Criteria**:
- Cannot shoot within 300ms of last shoot
- Prevents accidental double-shoots
- Test passes

### Phase 4: Visual Feedback (Priority: **LOW**)
**Duration**: 2-3 hours

**Tasks**:
1. Add kick animation to player sprite
2. Add shoot sound effect
3. Add visual "pow" effect at launch
4. Add ball trail for fast shots

**Success Criteria**:
- Shooting feels satisfying
- Clear visual/audio feedback
- No performance impact

---

## Part 5: Testing Execution Plan

### Setup

```bash
# Ensure dev servers running
npm run dev

# Run shooting test suite
npx playwright test tests/shooting-mechanics.spec.ts --headed
```

### Test Execution Order

1. **Single Client Tests** (Tests 1-4, 6)
   - Fastest execution
   - No network complexity
   - Validates core mechanics

2. **Multiplayer Tests** (Test 5)
   - Requires two clients
   - Validates synchronization
   - Tests network protocol

3. **Integration Tests** (Test 7)
   - End-to-end validation
   - Tests complete game flow
   - Validates goal detection

### Expected Results

**Current Implementation**:
- Tests 1, 2, 3, 5, 7: ✅ **Should Pass**
- Test 4 (Power variation): ⚠️ **May fail in multiplayer** (fixed 0.8 power)
- Test 6 (Cooldown): ✅ **Will pass** (documents no-cooldown behavior)

**After Enhancements**:
- All tests: ✅ **Should pass**

---

## Part 6: Code References

### Server Code

**File**: `server/src/schema/GameState.ts`

**Key Methods**:
- `handlePlayerAction(player: Player)` (lines 276-309): Shoot logic
- `updateBallPossession()` (lines 217-274): Possession management
- `processInputs(dt: number)` (lines 118-160): Input processing

**Key Config**:
```typescript
const GAME_CONFIG = {
  SHOOT_SPEED: 400,    // px/s
  PASS_SPEED: 300,     // px/s (not currently used)
  POSSESSION_RADIUS: 50, // px
}
```

### Client Code

**File**: `client/src/scenes/GameScene.ts`

**Key Methods**:
- `shootBall(power: number)` (lines 228-245): Client shoot handler
- `setupInput()` (lines 203-211): Keyboard setup
- `createMobileControls()` (lines 213-226): Action button setup

**Key Components**:
- `ActionButton` (lines 220-225): Mobile shoot button with hold-to-power
- `VirtualJoystick` (line 217): Movement control

### Network Protocol

**File**: `server/src/schema/GameState.ts`

**Input Interface** (lines 8-12):
```typescript
interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean // true = shoot button pressed
  timestamp: number
}
```

**Enhancement Needed**:
```typescript
interface PlayerInput {
  movement: { x: number; y: number }
  action: boolean
  actionPower?: number // NEW: 0.0-1.0 for variable power
  timestamp: number
}
```

---

## Part 7: Acceptance Criteria

### Test Coverage Acceptance
- [ ] All 7 tests implemented in `tests/shooting-mechanics.spec.ts`
- [ ] At least 6/7 tests passing (Test 4 may document limitation)
- [ ] Test execution time < 2 minutes for full suite
- [ ] Clear console logging for debugging
- [ ] Screenshots captured on failure

### Feature Completeness (Current Implementation)
- [x] Players can shoot when in possession
- [x] Ball launches in player's facing direction
- [x] Possession released after shoot
- [x] Space bar triggers shoot (desktop)
- [x] Action button triggers shoot (mobile)
- [x] Multiplayer shooting synchronized
- [ ] Variable power works in multiplayer (Enhancement needed)
- [ ] Shoot cooldown prevents spam (Enhancement needed)
- [ ] Visual feedback for shooting (Enhancement needed)

### Code Quality
- [ ] No console errors during shooting
- [ ] No network desync on shoot
- [ ] No rubber-banding or glitches
- [ ] Ball trajectory smooth and predictable
- [ ] Consistent behavior across clients

---

## Part 8: Risk Assessment

### Low Risk
- **Test Implementation**: Adding tests has no impact on existing code
- **Variable Power Enhancement**: Backward compatible (defaults to 0.8 if not provided)
- **Cooldown Enhancement**: Server-side only, minimal impact

### Medium Risk
- **Network Protocol Change**: Requires client and server update together
- **Visual Effects**: May impact performance on low-end devices

### Mitigation Strategies
1. **Feature Flags**: Use environment variables to enable enhancements
2. **Gradual Rollout**: Implement tests first, enhancements second
3. **Performance Testing**: Benchmark visual effects before deploying
4. **Backward Compatibility**: Ensure old clients can still connect

---

## Part 9: Success Metrics

### Test Coverage Metrics
- **Target**: 100% test coverage for shooting mechanics
- **Minimum**: 6/7 tests passing
- **Execution Time**: < 2 minutes for full suite

### Feature Enhancement Metrics
- **Variable Power**: Power variation ±10% accuracy
- **Cooldown**: Zero double-shoots in 100 rapid shoots
- **Visual Feedback**: No frame drops during shoot animation

### Player Experience Metrics
- **Shooting Feels Responsive**: <100ms input-to-visual lag
- **Direction Accuracy**: Ball travels within ±10° of intended direction
- **Satisfaction**: Shooting feels "good" (subjective, validated through playtesting)

---

## Next Steps

### Immediate (Do Now)
1. ✅ Create this workflow document
2. ⏭️ Create `tests/shooting-mechanics.spec.ts`
3. ⏭️ Implement Tests 1-7
4. ⏭️ Run tests and document results
5. ⏭️ Update TEST_SUMMARY.md with shooting test results

### Short-Term (This Week)
1. Implement Enhancement 1 (Variable Power) if Test 4 fails
2. Implement Enhancement 2 (Cooldown) if spam is problematic
3. Add documentation to README about shooting mechanics

### Long-Term (Next Sprint)
1. Implement Enhancement 3 (Visual Feedback)
2. Consider Enhancement 4 (Direction Prediction)
3. Evaluate Enhancement 5 (Charge System) based on playtesting feedback

---

## Appendix A: Helper Functions for Tests

### Get Ball State
```typescript
async function getBallState(page: Page) {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    return {
      x: state?.ball?.x || 0,
      y: state?.ball?.y || 0,
      velocityX: state?.ball?.velocityX || 0,
      velocityY: state?.ball?.velocityY || 0,
      possessedBy: state?.ball?.possessedBy || ''
    }
  })
}
```

### Shoot Ball
```typescript
async function shootBall(page: Page) {
  await page.keyboard.press('Space')
  await page.waitForTimeout(100) // Wait for server response
}
```

### Gain Possession
```typescript
async function gainPossession(page: Page) {
  // Move player to ball position
  const ballPos = await getBallState(page)
  const playerPos = await getPlayerState(page)

  // Move towards ball
  await movePlayerTowards(page, ballPos, 2000)

  // Wait for possession
  await page.waitForTimeout(500)

  // Verify possession
  const ball = await getBallState(page)
  return ball.possessedBy !== ''
}
```

### Calculate Angle
```typescript
function calculateAngle(dx: number, dy: number): number {
  return Math.atan2(dy, dx) * 180 / Math.PI
}
```

---

## Appendix B: Configuration Values

| Parameter | Value | Location | Notes |
|-----------|-------|----------|-------|
| SHOOT_SPEED | 400 px/s | `server/src/schema/GameState.ts:20` | Maximum shoot velocity |
| PASS_SPEED | 300 px/s | `server/src/schema/GameState.ts:21` | Not currently used |
| POSSESSION_RADIUS | 50 px | `server/src/schema/GameState.ts:22` | Distance to gain possession |
| Default Power | 0.8 | `server/src/schema/GameState.ts:280` | 80% of max speed |
| Action Power | 0.8 | `client/src/scenes/GameScene.ts:228` | Default on client |
| BALL_FRICTION | 0.98 | `server/src/schema/GameState.ts:19` | Slowdown per frame |

---

## Document Metadata

**Created**: 2025-10-01
**Author**: Claude (SuperClaude Framework)
**Workflow Type**: Feature Test & Enhancement
**Priority**: HIGH (Test Coverage), MEDIUM (Enhancements)
**Estimated Total Time**: 4-8 hours (depending on enhancements)
