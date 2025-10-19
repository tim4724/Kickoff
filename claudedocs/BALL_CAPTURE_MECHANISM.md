# Ball Capture Mechanism Analysis

**Date:** 2025-10-02
**Files Analyzed:**
- `/server/src/schema/GameState.ts` (lines 271-388)
- `/shared/src/types.ts` (lines 52-81)
- `/client/src/scenes/GameScene.ts` (lines 409-463)

---

## Overview

The ball capture mechanism implements a **proximity-based possession system with pressure dynamics**. Players automatically gain possession when near the ball, can lose possession under opponent pressure, and have a brief immunity period after shooting to prevent immediate re-capture.

---

## Core Components

### 1. **Automatic Possession Gain** (GameState.ts:271-338)

**Trigger:** Player enters possession radius of a free ball

**Logic Flow:**
```typescript
updateBallPossession() {
  // Phase 1: Check current possessor still valid
  if (ball.possessedBy !== '') {
    // Maintain possession if within range
    // Release if too far (>50px)
    // Apply magnetism: ball follows player at 25px offset
  }

  // Phase 2: Check for new possession
  if (ball.possessedBy === '') {
    // Check shoot immunity (300ms)
    players.forEach(player => {
      if (distance < POSSESSION_RADIUS && !hasImmunity) {
        ball.possessedBy = player.id
      }
    })
  }
}
```

**Key Parameters:**
- `POSSESSION_RADIUS: 45px` - Distance to gain possession
- `SHOT_IMMUNITY_MS: 300ms` - Prevents shooter from immediate re-capture
- **Magnetism offset:** 25px in front of player in facing direction

**First-Come-First-Served:** Once a player gains possession in a frame, loop terminates. No simultaneous captures.

---

### 2. **Pressure System** (GameState.ts:210-269)

**Purpose:** Simulate opponents "pressuring" the ball carrier, forcing turnovers

**Calculation Formula:**
```
pressure = opponentsNearby  // Simple count
// Distance measured from opponent to BALL, not to possessor player
```

**Pressure Dynamics:**

| Condition | Rate | Formula |
|-----------|------|---------|
| **Buildup** (opponents near ball) | +2.0/sec per opponent | `pressure += 2.0 × dt × opponentsNearby` |
| **Decay** (no opponents) | -3.0/sec | `pressure -= 3.0 × dt` |

**Release Threshold:**
```typescript
if (pressureLevel >= 1.0) {
  ball.possessedBy = ''  // Force release
  pressureLevel = 0      // Reset
}
```

**Pressure Radius:** 45px from ball position (not from player position)

**Important:** Since the ball is positioned 25px in front of the player (magnetism), opponents can be closer to the ball than to the possessor player. Pressure is based on proximity to the ball itself.

**Examples:**

| Opponents | Time to Release |
|-----------|-----------------|
| 1 | ~0.5 seconds |
| 2 | ~0.25 seconds |
| 3 | ~0.17 seconds |

**Console Logging:**
- Logs pressure changes when delta > 5%
- Format: `📊 [Pressure] Player {id}: {percent}% ({count} opponents nearby)`
- Example: `📊 [Pressure] Player abc123: 45% (1 opponents nearby)`

---

### 3. **Shoot Immunity** (GameState.ts:313-325, 370-387)

**Purpose:** Prevent shooter from immediately re-capturing their own shot

**Implementation:**
```typescript
// Set on shoot
ball.lastShotTime = Date.now()
ball.lastShooter = player.id

// Check on capture attempt
const timeSinceShot = Date.now() - ball.lastShotTime
const hasImmunity = timeSinceShot < 300  // 300ms window

if (hasImmunity && player.id === lastShooter) {
  return  // Block capture
}
```

**Duration:** 300 milliseconds

**Applies to:**
- Automatic possession gain (GameState.ts:323)
- Manual action button possession (GameState.ts:376)

**Does NOT apply to:**
- Other players capturing the ball
- Same player after immunity expires

---

### 4. **Ball Magnetism** (GameState.ts:285-303)

**Purpose:** Keep ball visually attached to player during possession

**Positioning:**
```typescript
const offsetDistance = 25  // pixels
const ballX = player.x + cos(player.direction) × 25
const ballY = player.y + sin(player.direction) × 25
```

**Behavior:**
- Ball positioned **25px in front** of player
- Direction based on `player.direction` (radians)
- Updated every frame while possessed
- Ball velocity zeroed out: `velocityX = 0, velocityY = 0`

**Max Distance Check:**
- If player-ball distance > 45px → Release possession
- Prevents exploits from rapid movement

---

### 5. **Shooting Mechanism** (GameState.ts:340-388)

**Action Button Behavior:**

| Condition | Action |
|-----------|--------|
| **Has possession** | Shoot ball in facing direction |
| **No possession, within radius, no immunity** | Gain possession first |
| **No possession, outside radius** | No effect (logged) |
| **Immunity active** | Blocked (logged) |

**Shooting Physics:**
```typescript
ball.velocityX = cos(direction) × 400 × power
ball.velocityY = sin(direction) × 400 × power
ball.possessedBy = ''  // Release
```

**Power Parameter:**
- Range: 0.0 to 1.0
- Client-provided (hold duration on action button)
- Default: 0.8 if not provided

---

## Visual Debugging (Client-Side)

### Ball Color System (GameScene.ts:409-463)

**Color States:**

| Condition | Color | Hex Value |
|-----------|-------|-----------|
| No possessor | White | `0xffffff` |
| Blue team possession (no pressure) | Pure blue | `0x0066ff` |
| Red team possession (no pressure) | Pure red | `0xff4444` |
| Under pressure | Interpolated | RGB blend |

**Pressure Interpolation:**
```typescript
// Linear RGB interpolation
startColor = possessorTeamColor      // e.g., 0x0066ff (blue)
endColor = opponentTeamColor         // e.g., 0xff4444 (red)
interpolatedColor = lerp(startColor, endColor, pressureLevel)

// pressureLevel 0.0 → pure blue
// pressureLevel 0.5 → purple (mix)
// pressureLevel 1.0 → pure red (about to lose)
```

**Purpose:** Real-time visual feedback for debugging pressure mechanics

---

## Update Sequence (Server)

**Called from:** `MatchRoom.update()` at 60Hz

```
1. processInputs(dt)
   ↓ Handle player movement and action inputs

2. updatePhysics(dt)
   ├─ updatePossessionPressure(dt)  // Calculate pressure
   ├─ updateBallPossession()         // Handle captures/releases
   ├─ Ball physics (if not possessed)
   │  ├─ Apply friction
   │  ├─ Update position
   │  └─ Boundary bouncing
   └─ checkGoals()

3. updateTimer(dt)
   ↓ Countdown match timer

4. Broadcast state to clients (automatic via Colyseus)
```

**Frame rate:** 60 updates/second (MatchRoom.ts:8)

---

## Edge Cases & Safeguards

### 1. **Player Disconnection**
```typescript
// In updateBallPossession()
if (!possessor) {
  ball.possessedBy = ''  // Release ball
}
```

### 2. **Distance Check**
```typescript
// Prevent possession at extreme distances
if (dist > 45) {
  ball.possessedBy = ''  // Force release
}
```

### 3. **Pressure Reset**
```typescript
// No possessor → reset pressure
if (ball.possessedBy === '') {
  pressureLevel = 0
}
```

### 4. **Race Condition Prevention**
```typescript
// First-come-first-served in forEach loop
if (ball.possessedBy !== '') return  // Already captured
```

### 5. **Immunity Logging**
```typescript
if (hasImmunity && isShooter) {
  console.log(`blocked by shoot immunity (${remaining}ms)`)
}
```

---

## Performance Characteristics

**Computational Complexity:**
- `updateBallPossession()`: O(n) where n = number of players
- `updatePossessionPressure()`: O(n²) worst case (nested loops)
- **Current scale:** 2 players → negligible impact

**Memory Footprint:**
- Minimal: Only stores `possessedBy`, `pressureLevel`, `lastShotTime`, `lastShooter`
- No historical tracking or complex state

**Network Efficiency:**
- State synced automatically via Colyseus schema
- Only changed fields transmitted
- Client interpolates for smoothness

---

## Configuration Constants

From `shared/src/types.ts`:

```typescript
POSSESSION_RADIUS: 45           // Capture distance
PRESSURE_RADIUS: 45             // Pressure application distance (matches possession radius)
PRESSURE_BUILDUP_RATE: 2.0      // Pressure/sec per opponent (~0.5s with 1 opponent)
PRESSURE_DECAY_RATE: 3.0        // Pressure decay/sec when no opponents near
PRESSURE_RELEASE_THRESHOLD: 1.0 // Auto-release level (100%)
CAPTURE_LOCKOUT_MS: 300         // Can't lose possession for 300ms after capturing
LOSS_LOCKOUT_MS: 300            // Can't capture for 300ms after losing possession
```

**Tunable for gameplay balance:**
- Increase `POSSESSION_RADIUS` → Easier captures
- Increase `PRESSURE_BUILDUP_RATE` → Faster turnovers
- Increase `PRESSURE_DECAY_RATE` → Faster pressure relief

---

## Testing Considerations

**Test Coverage Areas:**

1. ✅ **Proximity capture** - Player gains possession within radius
2. ✅ **Pressure buildup** - Opponents cause pressure accumulation
3. ✅ **Pressure release** - Ball released at threshold
4. ✅ **Shoot immunity** - Shooter cannot re-capture immediately
5. ✅ **Magnetism** - Ball follows player correctly
6. ✅ **Distance release** - Possession lost when too far

**Existing Tests:** `tests/ball-capture.spec.ts` (improved 2025-10-02)

---

## Potential Improvements

### Gameplay
1. **Contested possession**: Allow multiple players to "fight" for ball
2. **Skill-based retention**: Button mashing to resist pressure
3. **Directional pressure**: Harder to maintain when facing opponents
4. **Momentum-based captures**: Moving players more likely to capture

### Technical
1. **Spatial partitioning**: Reduce O(n²) pressure calculations
2. **Predictive positioning**: Anticipate ball movement for captures
3. **Replay system**: Record possession events for debugging
4. **Analytics**: Track average possession time, pressure events

### Balance
1. **Dynamic thresholds**: Adjust based on player count
2. **Fatigue system**: Pressure harder to apply over time
3. **Position-based modifiers**: Harder possession in goal areas
4. **Team coordination bonus**: Passing chains reduce pressure

---

## Summary

The ball capture mechanism is a **time-based proximity system** with key features:

1. **Automatic capture** within 45px radius
2. **Pressure dynamics** that force turnovers (~0.5 seconds under single-opponent pressure)
3. **Shoot immunity** preventing immediate re-capture (300ms window)
4. **Lockout periods** preventing rapid possession changes (300ms after capture/loss)

The system prioritizes **responsive gameplay** over simulation realism, using continuous pressure accumulation rather than discrete tackle events. Ball magnetism ensures visual clarity, while the color interpolation system provides real-time debugging feedback.

**Current state:** Production-ready with comprehensive E2E test coverage.
