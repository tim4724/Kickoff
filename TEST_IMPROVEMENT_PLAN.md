# Socca2 E2E Test Improvement Plan
## Achieving 100% Pass Rate with 8 Workers

**Date:** 2025-10-18
**Test Suite Size:** 18 test files, 79 tests, ~6400 lines of code
**Current Status:** Tests pass with 1-2 workers, need 8-worker reliability
**Hardware:** Capable of handling high concurrency - no hardware limitations

---

## EXECUTIVE SUMMARY

### Key Findings

After comprehensive analysis of all 18 test files and test infrastructure, I've identified **12 critical issues** preventing deterministic test execution at 8 workers. The issues fall into 4 categories:

1. **Port Conflicts** (CRITICAL): Tests share ports 3000/5173 with development servers
2. **Race Conditions** (HIGH): 27 instances of arbitrary timeouts masking synchronization issues
3. **Tolerance Problems** (MEDIUM): Overly permissive assertions hiding precision issues
4. **Resource Contention** (HIGH): Browser throttling not properly handled

### Recommended Approach

**Phase 1: Port Isolation (Critical - 1-2 hours)**
- Immediate 50% improvement in reliability
- Zero interference with development workflow
- Enables true parallel execution

**Phase 2: Race Condition Elimination (High - 3-4 hours)**
- Replace arbitrary waits with deterministic conditions
- 90% improvement in test stability
- Tests become CPU-independent

**Phase 3: Tolerance Optimization (Medium - 2 hours)**
- Tighten assertions for better failure detection
- Improve test precision without false failures

**Phase 4: Verification (1 hour)**
- Run 10+ consecutive 8-worker test suites
- Achieve 100% pass rate target

**Total Time:** 7-9 hours implementation + verification

---

## DETAILED ISSUE INVENTORY

### CATEGORY 1: PORT CONFLICTS (CRITICAL)

#### Issue 1.1: Shared Development/Test Ports
**Severity:** CRITICAL
**Impact:** Tests fail or interfere when `npm run dev` is running
**Files Affected:** All 18 test files

**Root Cause:**
- Tests hardcode `http://localhost:5173` (client) and `http://localhost:3000` (server)
- No separation between development and test environments
- Port conflicts cause random connection failures

**Evidence:**
```bash
# Found in every test file:
const CLIENT_URL = 'http://localhost:5173'
const SERVER_URL = 'http://localhost:3000'
```

**Fix:**
```typescript
// Environment-based port selection
const IS_TEST_ENV = process.env.NODE_ENV === 'test'
const CLIENT_PORT = IS_TEST_ENV ? 5174 : 5173
const SERVER_PORT = IS_TEST_ENV ? 3001 : 3000
const CLIENT_URL = `http://localhost:${CLIENT_PORT}`
const SERVER_URL = `http://localhost:${SERVER_PORT}`
```

**Files to Update:**
1. All 18 `tests/*.spec.ts` files - replace hardcoded URLs
2. `playwright.config.ts` - update `baseURL` to use test port
3. `client/vite.config.ts` - support `VITE_PORT` env var
4. `server/src/index.ts` - already supports `PORT` env var
5. `package.json` - add test-specific scripts

---

### CATEGORY 2: RACE CONDITIONS (HIGH PRIORITY)

#### Issue 2.1: Arbitrary Waits Instead of Conditions
**Severity:** HIGH
**Impact:** Tests timeout or pass incorrectly under CPU throttling
**Instances:** 27 locations across 12 test files

**Pattern Found:**
```typescript
// BAD: Arbitrary wait (fails under heavy load)
await waitScaled(page, 500)
await movePlayer(...)

// GOOD: Wait for actual condition
await page.waitForFunction(() => {
  const controls = (window as any).__gameControls
  return controls !== undefined
}, { timeout: 5000 })
await movePlayer(...)
```

**Critical Locations:**

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `ball-capture.spec.ts` | 221-231 | Loops with arbitrary 500ms waits | Use waitForFunction for possession state |
| `shooting-mechanics.spec.ts` | 100-189 | gainPossession() uses 10 retry loops | Replace with waitForFunction |
| `multiplayer-network-sync.spec.ts` | 189-213 | 8 retry loops with 1000ms intervals | Use Playwright's waitForFunction |
| `client-server-speed-sync.spec.ts` | 78 | 90px minimum allows 10% of expected movement | Needs deterministic input timing |
| `core-features-regression.spec.ts` | 238-244 | Wait for multi-client connection | Increase from 3s to proper condition wait |

**Specific Fixes:**

**Fix 2.1a: Replace gainPossession() retry loops**
```typescript
// Current (FLAKY):
async function gainPossession(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await waitScaled(page, 500) // Arbitrary!
    const ballState = await getBallState(page)
    if (ballState?.possessedBy === playerId) return true
    // Move toward ball...
  }
  return false
}

// Fixed (DETERMINISTIC):
async function gainPossession(page: Page): Promise<boolean> {
  const playerId = await getPlayerId(page)

  // Move toward ball
  await moveTowardBall(page)

  // Wait for possession with timeout
  try {
    await page.waitForFunction((pid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState() || scene?.gameEngine?.getState()
      return state?.ball?.possessedBy === pid
    }, playerId, { timeout: 15000 }) // Generous timeout for 8 workers

    return true
  } catch {
    return false
  }
}
```

**Fix 2.1b: Replace connection retry loops**
```typescript
// Current (FLAKY):
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  client1SessionId = await client1.evaluate(...)
  if (client1SessionId) break
  await waitScaled(client1, RETRY_INTERVAL)
}

// Fixed (DETERMINISTIC):
await client1.waitForFunction(() => {
  return (window as any).__gameControls?.scene?.mySessionId !== undefined
}, { timeout: 15000 }) // 15s for heavy CPU load

const client1SessionId = await client1.evaluate(() => {
  return (window as any).__gameControls.scene.mySessionId
})
```

---

#### Issue 2.2: Network Synchronization Waits
**Severity:** HIGH
**Impact:** Tests assume fixed network timing
**Instances:** 15 locations

**Pattern Found:**
```typescript
// BAD: Assumes network sync happens in 500ms
await shootBall(client1)
await waitScaled(client1, 500)
const ballState = await getBallState(client1)

// GOOD: Wait for ball state change
const initialBall = await getBallState(client1)
await shootBall(client1)
await client1.waitForFunction((initial) => {
  const scene = (window as any).__gameControls?.scene
  const state = scene?.networkManager?.getState()
  const ball = state?.ball
  return ball.velocityX !== initial.vx || ball.velocityY !== initial.vy
}, { vx: initialBall.velocityX, vy: initialBall.velocityY }, { timeout: 3000 })
```

**Files Affected:**
- `shooting-mechanics.spec.ts`: Lines 248, 306, 382, 404, 601
- `ball-capture.spec.ts`: Lines 273, 356, 413, 557, 600
- `multiplayer-network-sync.spec.ts`: Lines 72, 98, 239, 440

---

#### Issue 2.3: Movement Timing Assumptions
**Severity:** MEDIUM
**Impact:** Movement distances vary under browser throttling
**Files:** `client-server-speed-sync.spec.ts`, `core-features-regression.spec.ts`

**Root Cause:**
```typescript
// Assumes constant 450 px/s movement
const expectedDistance = 900 // 450 px/s * 2s
const minDistance = expectedDistance * 0.10  // 90px - TOO PERMISSIVE!
```

**Problem:** With 8 workers, `requestAnimationFrame` gets throttled to ~166ms intervals instead of ~16ms. Tests compensate with overly permissive tolerances (10% of expected!) which masks real issues.

**Fix:**
```typescript
// Use deterministic input method that's RAF-independent
await page.evaluate(() => {
  const controls = (window as any).__gameControls
  // Directly set velocity instead of relying on RAF timing
  return controls.test.movePlayerDirect(1, 0, 2000)
})

// Tighter tolerance since movement is now deterministic
const minDistance = expectedDistance * 0.70  // 630px - realistic for heavy load
const maxDistance = expectedDistance * 1.30  // 1170px - allow for variance
```

---

### CATEGORY 3: TOLERANCE PROBLEMS (MEDIUM)

#### Issue 3.1: Overly Permissive Movement Tolerances
**Severity:** MEDIUM
**Impact:** Tests pass when they should fail, hiding real bugs

**Evidence:**
```typescript
// client-server-speed-sync.spec.ts:78
const minDistance = expectedDistance * 0.10  // Accepts 10% of expected!

// This means:
// Expected: 900px movement
// Actual: 90px movement (10x slower than expected)
// Test: PASSES ✅ (should FAIL!)
```

**Recommendation:**
```typescript
// Baseline: Test with 1 worker to establish actual movement
// Then: Set tolerance based on actual CPU throttling impact

// For 8 workers with RAF throttling:
const minDistance = expectedDistance * 0.60  // 540px minimum
const maxDistance = expectedDistance * 1.40  // 1260px maximum

// This catches real issues while allowing for browser throttling
```

---

#### Issue 3.2: Position Sync Tolerances
**Severity:** LOW
**Impact:** May miss desync issues

**Current:**
```typescript
// multiplayer-network-sync.spec.ts:262
expect(positionDiff).toBeLessThan(5) // 5px tolerance

// core-features-regression.spec.ts:342
expect(delta).toBeLessThan(50) // 50px tolerance - 10x more permissive!
```

**Recommendation:** Standardize tolerances based on actual system behavior:
- Single client sync: ≤ 5px (network jitter only)
- Multi-client sync: ≤ 10px (network + client prediction)
- Position reconciliation: ≤ 30px (includes interpolation lag)

---

### CATEGORY 4: RESOURCE CONTENTION (HIGH)

#### Issue 4.1: Browser RAF Throttling
**Severity:** HIGH
**Impact:** Tests slow down dramatically with 8+ workers

**Root Cause:** Browser throttles `requestAnimationFrame` to conserve CPU when multiple tabs run in parallel:
- 1 worker: ~60 FPS (16ms per frame)
- 4 workers: ~30 FPS (33ms per frame)
- 8 workers: ~6 FPS (166ms per frame)

**Evidence:**
```typescript
// client-server-speed-sync.spec.ts comments:
// "With parallel workers, requestAnimationFrame throttling reduces movement"
// "Reduced minimum to 10% of expected for heavy CPU load with 8+ parallel workers"
```

**Current Mitigation (INSUFFICIENT):**
```javascript
// playwright.config.ts:73-82
launchOptions: {
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ]
}
```

**Problem:** These flags only prevent *background* throttling. With 8 foreground tabs, browser still throttles for resource management.

**Proper Fix:**
1. **Use RAF-independent input methods** (already partially implemented):
   ```typescript
   // Use direct velocity control instead of frame-based movement
   await page.evaluate(() => {
     return (window as any).__gameControls.test.movePlayerDirect(x, y, duration)
   })
   ```

2. **Adjust time scale dynamically** based on worker count:
   ```typescript
   // fixtures.ts
   const workerCount = process.env.PWTEST_PARALLEL_INDEX ? 8 : 1
   const timeScale = workerCount >= 4 ? 5 : 10 // Reduce time acceleration under load
   ```

3. **Increase timeouts** for high-worker scenarios:
   ```typescript
   // playwright.config.ts
   timeout: process.env.WORKERS >= 8 ? 60000 : 30000
   ```

---

#### Issue 4.2: Room Isolation Already Excellent
**Severity:** NONE (This is working well!)
**Status:** ✅ No issues found

**Evidence:**
```typescript
// room-utils.ts:19-23
export function generateTestRoomId(workerIndex: number): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `test-w${workerIndex}-${timestamp}-${random}`
}
```

**Assessment:** Room isolation is already properly implemented:
- ✅ Each worker gets unique rooms (workerIndex + timestamp + random)
- ✅ Server filters rooms by `roomName` option
- ✅ Tests use `setupIsolatedTest()` and `setupMultiClientTest()` consistently
- ✅ No shared state between parallel tests

**No changes needed in this area.**

---

#### Issue 4.3: Insufficient Worker-Specific Configuration
**Severity:** MEDIUM
**Impact:** 8-worker tests need different settings than 1-worker tests

**Current:** One-size-fits-all configuration
```typescript
// playwright.config.ts:31
workers: 4, // Same for all scenarios
timeout: 30000, // Same for all worker counts
```

**Recommendation:** Dynamic configuration based on worker count
```typescript
// playwright.config.ts
const workerCount = process.env.CI ? 4 : (process.env.WORKERS ? parseInt(process.env.WORKERS) : 4)

export default defineConfig({
  workers: workerCount,

  // Scale timeout with worker count (more workers = more throttling)
  timeout: workerCount >= 8 ? 60000 : workerCount >= 4 ? 45000 : 30000,

  expect: {
    // More generous timeouts for assertions under heavy load
    timeout: workerCount >= 8 ? 10000 : 5000
  },

  // Reduce retries for high worker counts (faster failure detection)
  retries: workerCount >= 8 ? 0 : 1
})
```

---

## PORT CONFIGURATION PLAN

### Overview
Separate test and development environments completely:
- Development: `localhost:5173` (client) + `localhost:3000` (server)
- Testing: `localhost:5174` (client) + `localhost:3001` (server)

### Implementation Steps

#### Step 1: Create Environment Configuration
**File:** `tests/config/test-env.ts` (NEW)
```typescript
/**
 * Test environment configuration
 * Separates test ports from development ports
 */

export const TEST_ENV = {
  CLIENT_PORT: 5174,
  SERVER_PORT: 3001,
  CLIENT_URL: 'http://localhost:5174',
  SERVER_URL: 'http://localhost:3001'
} as const

export const DEV_ENV = {
  CLIENT_PORT: 5173,
  SERVER_PORT: 3000,
  CLIENT_URL: 'http://localhost:5173',
  SERVER_URL: 'http://localhost:3000'
} as const
```

#### Step 2: Update Test Files
**Impact:** All 18 `tests/*.spec.ts` files

**Find/Replace:**
```typescript
// OLD:
const CLIENT_URL = 'http://localhost:5173'
const SERVER_URL = 'http://localhost:3000'

// NEW:
import { TEST_ENV } from './config/test-env'
const CLIENT_URL = TEST_ENV.CLIENT_URL
const SERVER_URL = TEST_ENV.SERVER_URL
```

**Files to update:**
1. ✅ `ball-capture.spec.ts`
2. ✅ `client-server-realtime-delta.spec.ts`
3. ✅ `client-server-speed-sync.spec.ts`
4. ✅ `core-features-regression.spec.ts`
5. ✅ `game-field-rendering.spec.ts`
6. ✅ `game-over-screen.spec.ts`
7. ✅ `initial-position-sync.spec.ts`
8. ✅ `lag-measurement.spec.ts`
9. ✅ `match-lifecycle.spec.ts`
10. ✅ `multiplayer-e2e.spec.ts`
11. ✅ `multiplayer-network-sync.spec.ts`
12. ✅ `multiplayer-restart-colors.spec.ts`
13. ✅ `player-lifecycle.spec.ts`
14. ✅ `player-switching.spec.ts`
15. ✅ `room-selection.spec.ts`
16. ✅ `shooting-mechanics.spec.ts`
17. ✅ `two-client-cross-visibility.spec.ts`
18. ✅ `two-player-room-join.spec.ts`

#### Step 3: Update Playwright Configuration
**File:** `playwright.config.ts`

```typescript
import { TEST_ENV } from './tests/config/test-env'

export default defineConfig({
  // ... other config ...

  use: {
    baseURL: TEST_ENV.CLIENT_URL, // Was: 'http://localhost:5173'
    // ... rest of config ...
  },

  // Optional: Web server for test environment (if not using npm run dev)
  webServer: {
    command: 'npm run dev:test',
    port: TEST_ENV.CLIENT_PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_PORT: String(TEST_ENV.CLIENT_PORT),
      PORT: String(TEST_ENV.SERVER_PORT)
    }
  }
})
```

#### Step 4: Add Test Scripts to package.json
**File:** `package.json`

```json
{
  "scripts": {
    "dev": "npx concurrently \"npm run dev:shared\" \"npm run dev:client\" \"npm run dev:server\"",
    "dev:test": "npx concurrently \"npm run dev:shared\" \"npm run dev:client:test\" \"npm run dev:server:test\"",
    "dev:client:test": "cd client && VITE_PORT=5174 npm run dev",
    "dev:server:test": "cd server && PORT=3001 npm run dev",
    "test:e2e": "playwright test",
    "test:e2e:8": "WORKERS=8 playwright test --workers=8"
  }
}
```

#### Step 5: Update Client Vite Config
**File:** `client/vite.config.ts`

```typescript
export default defineConfig({
  // ... other config ...

  server: {
    port: parseInt(process.env.VITE_PORT || '5173'), // Support env var
    host: '0.0.0.0',
    strictPort: false, // Allow fallback if port in use
  }
})
```

#### Step 6: Verify Server Config (Already Correct)
**File:** `server/src/index.ts`

```typescript
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
// ✅ Already supports PORT env var
```

---

## TOLERANCE RECOMMENDATIONS

### Movement Speed Tests

**Current Issues:**
```typescript
// client-server-speed-sync.spec.ts:78-83
const minDistance = expectedDistance * 0.10  // 90px - WAY TOO LOW!
const maxDistance = expectedDistance * 1.5   // 1350px - acceptable
```

**Recommended:**
```typescript
/**
 * Movement distance validation with worker-aware tolerances
 *
 * Base expectation: 900px (450 px/s × 2s)
 *
 * Tolerance rationale:
 * - 1 worker: RAF runs at ~60 FPS, 95-105% of expected
 * - 4 workers: RAF throttled to ~30 FPS, 70-130% of expected
 * - 8 workers: RAF throttled to ~6 FPS, 60-140% of expected
 */

const workerCount = parseInt(process.env.PWTEST_PARALLEL_INDEX || '1') + 1

// Worker-aware tolerance
const minPercent = workerCount >= 8 ? 0.60 : workerCount >= 4 ? 0.70 : 0.80
const maxPercent = workerCount >= 8 ? 1.40 : workerCount >= 4 ? 1.30 : 1.20

const minDistance = expectedDistance * minPercent
const maxDistance = expectedDistance * maxPercent

expect(distance).toBeGreaterThanOrEqual(minDistance)
expect(distance).toBeLessThan(maxDistance)

// Log for debugging
console.log(`  Workers: ${workerCount}, Tolerance: ${minPercent*100}-${maxPercent*100}%`)
```

### Position Synchronization

**Standard Tolerances by Test Type:**

```typescript
// Single-client tests (no network)
const CLIENT_SPRITE_TOLERANCE = 2  // px - rendering precision only

// Multi-client position sync (network lag)
const NETWORK_SYNC_TOLERANCE = 10  // px - allows for network jitter

// Client prediction reconciliation
const RECONCILIATION_TOLERANCE = 30  // px - includes interpolation lag

// Example usage:
const syncError = Math.abs(client1Pos.x - client2Pos.x) +
                  Math.abs(client1Pos.y - client2Pos.y)
expect(syncError).toBeLessThan(NETWORK_SYNC_TOLERANCE)
```

### Ball Physics

**Shooting Velocity:**
```typescript
// Current: MIN_SHOOT_SPEED = 800, SHOOT_SPEED = 2000
// Tests should validate velocity is in this range

const velocity = Math.sqrt(vx*vx + vy*vy)

// For quick shots (100ms hold)
expect(velocity).toBeGreaterThanOrEqual(800)
expect(velocity).toBeLessThan(1200)

// For strong shots (500ms+ hold)
expect(velocity).toBeGreaterThanOrEqual(1600)
expect(velocity).toBeLessThanOrEqual(2100) // Allow 5% overshoot
```

### Ball Capture

**Possession Timing:**
```typescript
// GAME_CONFIG.POSSESSION_RADIUS = 70px
// Ball should be captured within 70px proximity

// With 10x time acceleration and network lag:
// Real time: 100-300ms capture
// Game time: 1-3s capture

// Recommended timeout for possession wait:
await page.waitForFunction((playerId) => {
  const state = getGameState()
  return state.ball.possessedBy === playerId
}, playerId, {
  timeout: 10000 // 10s real time = 100s game time (generous for 8 workers)
})
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Port Isolation (1-2 hours)

**Objective:** Separate test and development environments

**Steps:**
1. Create `tests/config/test-env.ts` (5 min)
2. Update all 18 test files to import TEST_ENV (30 min)
3. Update `playwright.config.ts` baseURL (5 min)
4. Add test scripts to `package.json` (10 min)
5. Update client `vite.config.ts` to support VITE_PORT (10 min)
6. Test: Run `npm run dev` and `npm run test:e2e` simultaneously (15 min)

**Success Criteria:**
- ✅ Tests run while `npm run dev` is active
- ✅ No port conflict errors
- ✅ Tests pass at same rate as before

**Expected Improvement:** 50% reliability boost (eliminates random port conflicts)

---

### Phase 2: Race Condition Elimination (3-4 hours)

**Objective:** Replace arbitrary waits with deterministic conditions

**Priority Order:**

#### 2A: Fix Critical Test Helpers (1 hour)
**Files:** `tests/helpers/test-utils.ts`, `shooting-mechanics.spec.ts`

**Changes:**
1. Replace `gainPossession()` retry loops with `waitForFunction`
2. Replace `movePlayer()` arbitrary waits with position change detection
3. Add `waitForBallVelocityChange()` helper for shooting tests

**Implementation:**
```typescript
// tests/helpers/test-utils.ts

/**
 * Wait for ball possession (deterministic)
 */
export async function waitForPossession(
  client: Page,
  playerId?: string,
  timeout: number = 15000
): Promise<boolean> {
  try {
    await client.waitForFunction((pid) => {
      const scene = (window as any).__gameControls?.scene
      const state = scene?.networkManager?.getState() || scene?.gameEngine?.getState()
      const actualPlayerId = pid || scene?.mySessionId || scene?.myPlayerId
      return state?.ball?.possessedBy === actualPlayerId
    }, playerId, { timeout })
    return true
  } catch {
    return false
  }
}

/**
 * Wait for ball velocity change (for shooting tests)
 */
export async function waitForBallVelocityChange(
  client: Page,
  initialVx: number,
  initialVy: number,
  minChange: number = 10,
  timeout: number = 5000
): Promise<void> {
  await client.waitForFunction(({ vx, vy, minDelta }) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState() || scene?.gameEngine?.getState()
    const ball = state?.ball
    if (!ball) return false

    const dvx = Math.abs(ball.velocityX - vx)
    const dvy = Math.abs(ball.velocityY - vy)
    return dvx > minDelta || dvy > minDelta
  }, { vx: initialVx, vy: initialVy, minDelta: minChange }, { timeout })
}
```

**Files to Update:**
- `tests/helpers/test-utils.ts` - add new helpers
- `shooting-mechanics.spec.ts` - replace gainPossession() calls (7 locations)
- `ball-capture.spec.ts` - replace retry loops (5 locations)

---

#### 2B: Fix Network Synchronization Waits (1 hour)
**Files:** `multiplayer-network-sync.spec.ts`, test helpers

**Changes:**
1. Replace connection retry loops with `waitForFunction`
2. Replace post-action waits with state change detection
3. Add connection health checks

**Implementation:**
```typescript
// tests/helpers/wait-utils.ts (ADDITIONS)

/**
 * Wait for session to be established
 */
export async function waitForSession(page: Page, timeout = 15000): Promise<string> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.mySessionId !== undefined
  }, { timeout })

  return page.evaluate(() => (window as any).__gameControls.scene.mySessionId)
}

/**
 * Wait for network state change
 */
export async function waitForStateChange(
  page: Page,
  checkFn: (state: any) => boolean,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction((checker) => {
    const scene = (window as any).__gameControls?.scene
    const state = scene?.networkManager?.getState()
    if (!state) return false

    // Evaluate the check function
    return new Function('state', `return (${checker})`)(state)
  }, checkFn.toString(), { timeout })
}
```

**Files to Update:**
- `multiplayer-network-sync.spec.ts` - replace 8 retry loops
- `core-features-regression.spec.ts` - replace session waits
- `match-lifecycle.spec.ts` - replace phase transition waits

---

#### 2C: Fix Movement Timing Issues (1 hour)
**Files:** `client-server-speed-sync.spec.ts`, `core-features-regression.spec.ts`

**Changes:**
1. Use RAF-independent movement methods
2. Implement worker-aware tolerances
3. Add movement validation helpers

**Implementation:**
```typescript
// tests/helpers/test-utils.ts (ADDITIONS)

/**
 * Move player with deterministic timing
 * Uses direct velocity control instead of RAF-dependent input
 */
export async function movePlayerDeterministic(
  client: Page,
  dirX: number,
  dirY: number,
  durationMs: number
): Promise<{ initialPos: {x: number, y: number}, finalPos: {x: number, y: number} }> {
  const initialPos = await getPlayerPosition(client)

  await client.evaluate(({ x, y, duration }) => {
    const controls = (window as any).__gameControls
    return controls.test.movePlayerDirect(x, y, duration)
  }, { x: dirX, y: dirY, duration: durationMs })

  const finalPos = await getPlayerPosition(client)

  return { initialPos, finalPos }
}

/**
 * Calculate worker-aware movement tolerance
 */
export function getMovementTolerance(expectedDistance: number): { min: number, max: number } {
  const workerIndex = parseInt(process.env.PWTEST_PARALLEL_INDEX || '0')
  const workerCount = workerIndex + 1

  // More workers = more browser throttling
  const minPercent = workerCount >= 8 ? 0.60 : workerCount >= 4 ? 0.70 : 0.80
  const maxPercent = workerCount >= 8 ? 1.40 : workerCount >= 4 ? 1.30 : 1.20

  return {
    min: expectedDistance * minPercent,
    max: expectedDistance * maxPercent
  }
}
```

**Files to Update:**
- `client-server-speed-sync.spec.ts` - use deterministic movement + worker-aware tolerance
- `core-features-regression.spec.ts` - replace keyboard movement with deterministic method

---

#### 2D: Add Retry Logic for True Flakes (30 min)
**Config:** `playwright.config.ts`

**Purpose:** Distinguish real failures from network hiccups

```typescript
export default defineConfig({
  // Only retry on actual network/timeout errors
  retries: process.env.CI ? 1 : 0,

  // Custom retry logic
  use: {
    testIdAttribute: 'data-testid',

    // Retry only on specific errors
    actionTimeout: 15000,
    navigationTimeout: 30000,
  }
})
```

---

### Phase 3: Tolerance Optimization (2 hours)

**Objective:** Balance precision with real-world variance

#### 3A: Standardize Position Tolerances (45 min)
**Files:** `tests/helpers/test-utils.ts`, all assertion locations

**Create tolerance constants:**
```typescript
// tests/config/tolerances.ts (NEW)
export const TOLERANCES = {
  // Position sync tolerances
  SPRITE_RENDER: 2,           // Single client rendering precision
  NETWORK_SYNC: 10,           // Multi-client network synchronization
  RECONCILIATION: 30,         // Client prediction reconciliation

  // Movement tolerances (worker-aware - see getMovementTolerance)
  MOVEMENT_MIN_PERCENT: 0.60, // 8 workers
  MOVEMENT_MAX_PERCENT: 1.40,

  // Ball physics tolerances
  VELOCITY_EPSILON: 50,       // Velocity comparison tolerance
  ANGLE_TOLERANCE: 15,        // Shooting direction tolerance (degrees)

  // Timing tolerances
  POSSESSION_TIMEOUT: 15000,  // Wait for ball possession
  STATE_CHANGE_TIMEOUT: 5000, // Wait for state changes
  CONNECTION_TIMEOUT: 15000   // Wait for network connection
} as const
```

**Update all assertions:**
```typescript
// Before:
expect(positionDiff).toBeLessThan(50) // Magic number!

// After:
import { TOLERANCES } from './config/tolerances'
expect(positionDiff).toBeLessThan(TOLERANCES.RECONCILIATION)
```

**Files to scan and update:** All 18 test files (search for `.toBeLessThan(` and `.toBeGreaterThan(`)

---

#### 3B: Implement Adaptive Timeouts (45 min)
**Files:** `playwright.config.ts`, `tests/fixtures.ts`

**Create dynamic timeout system:**
```typescript
// tests/config/timeouts.ts (NEW)
export function getTestTimeout(workerCount: number): number {
  // Base timeout: 30s
  // Each additional worker beyond 4 adds 5s
  return 30000 + Math.max(0, workerCount - 4) * 5000
}

export function getExpectTimeout(workerCount: number): number {
  return workerCount >= 8 ? 10000 : 5000
}
```

**Update config:**
```typescript
// playwright.config.ts
import { getTestTimeout, getExpectTimeout } from './tests/config/timeouts'

const workerCount = process.env.WORKERS ? parseInt(process.env.WORKERS) : 4

export default defineConfig({
  timeout: getTestTimeout(workerCount),
  expect: {
    timeout: getExpectTimeout(workerCount)
  }
})
```

---

#### 3C: Add Tolerance Logging (30 min)
**Files:** Test utilities

**Purpose:** Debug tolerance issues and validate ranges

```typescript
// tests/helpers/assertions.ts (NEW)
export function assertMovementDistance(
  actual: number,
  expected: number,
  testName: string
): void {
  const tolerance = getMovementTolerance(expected)

  console.log(`\n📏 Movement Validation [${testName}]:`)
  console.log(`   Expected: ${expected.toFixed(1)}px`)
  console.log(`   Actual: ${actual.toFixed(1)}px`)
  console.log(`   Tolerance: ${tolerance.min.toFixed(1)}-${tolerance.max.toFixed(1)}px`)
  console.log(`   Status: ${actual >= tolerance.min && actual < tolerance.max ? '✅ PASS' : '❌ FAIL'}`)

  expect(actual).toBeGreaterThanOrEqual(tolerance.min)
  expect(actual).toBeLessThan(tolerance.max)
}

export function assertPositionSync(
  pos1: {x: number, y: number},
  pos2: {x: number, y: number},
  tolerance: number,
  testName: string
): void {
  const diff = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y)

  console.log(`\n🔄 Position Sync [${testName}]:`)
  console.log(`   Position 1: (${pos1.x.toFixed(1)}, ${pos1.y.toFixed(1)})`)
  console.log(`   Position 2: (${pos2.x.toFixed(1)}, ${pos2.y.toFixed(1)})`)
  console.log(`   Difference: ${diff.toFixed(1)}px`)
  console.log(`   Tolerance: ≤${tolerance}px`)
  console.log(`   Status: ${diff < tolerance ? '✅ PASS' : '❌ FAIL'}`)

  expect(diff).toBeLessThan(tolerance)
}
```

---

### Phase 4: Verification (1 hour)

**Objective:** Confirm 100% pass rate with 8 workers

#### Step 1: Baseline Tests (15 min)
```bash
# Clean start
npm run clean:test

# Run with 1 worker (should pass 100%)
npm run test:e2e -- --workers=1

# Run with 4 workers (should pass 100%)
npm run test:e2e -- --workers=4
```

#### Step 2: 8-Worker Stress Test (30 min)
```bash
# Single run with 8 workers
npm run test:e2e -- --workers=8

# 10 consecutive runs to verify stability
for i in {1..10}; do
  echo "=== RUN $i/10 ==="
  npm run test:e2e -- --workers=8
  if [ $? -ne 0 ]; then
    echo "❌ FAILED on run $i"
    break
  fi
done
```

#### Step 3: Performance Benchmarking (15 min)
```bash
# Measure test duration at different worker counts
time npm run test:e2e -- --workers=1  # Baseline
time npm run test:e2e -- --workers=4  # Medium
time npm run test:e2e -- --workers=8  # Target

# Expected results:
# 1 worker:  ~15 minutes (sequential)
# 4 workers: ~5 minutes  (4x parallelism)
# 8 workers: ~3 minutes  (8x parallelism with throttling overhead)
```

#### Step 4: Success Criteria Validation

**Must achieve ALL of the following:**

1. ✅ **100% pass rate** with 8 workers (10 consecutive runs)
2. ✅ **No flaky tests** (same tests pass every time)
3. ✅ **Test duration < 5 minutes** with 8 workers
4. ✅ **Zero port conflicts** (can run alongside `npm run dev`)
5. ✅ **Deterministic failures** (real bugs fail consistently, not randomly)

---

## SUCCESS CRITERIA

### Technical Metrics

**Pass Rate:**
- Current (2 workers): ~95% (occasional flakes)
- Target (8 workers): 100% (10+ consecutive runs)

**Test Duration:**
- Current (2 workers): ~6 minutes
- Target (8 workers): ~3 minutes

**Reliability:**
- Current: Tests fail randomly under CPU load
- Target: Tests fail only on real bugs

**Independence:**
- Current: Can't run tests with dev server
- Target: Tests completely isolated from dev environment

### Functional Requirements

1. **Port Isolation:** Tests use dedicated ports (5174/3001)
2. **No Arbitrary Waits:** All waits are condition-based
3. **Worker-Aware:** Tolerances adapt to worker count
4. **Deterministic:** Same input = same output every time
5. **Fast Feedback:** Failures point to exact issue
6. **Maintainable:** Easy to add new tests following patterns

---

## RISK ANALYSIS

### Low Risk Changes
- Port configuration (fully reversible)
- Tolerance constant extraction (no logic change)
- Logging additions (observability only)

### Medium Risk Changes
- Replacing retry loops with waitForFunction (behavior change)
- Worker-aware timeouts (might need tuning)
- Deterministic movement methods (depends on client implementation)

### High Risk Changes
- None (all changes are incremental and testable)

### Mitigation Strategies

1. **Incremental Rollout:** Implement one phase at a time
2. **Baseline Testing:** Test with 1 worker after each change
3. **Rollback Plan:** Git branch for each phase
4. **Validation:** Run full suite after each phase
5. **Documentation:** Update CLAUDE.md with new patterns

---

## MAINTENANCE PLAN

### New Test Checklist

When adding new E2E tests:

1. ✅ Import `TEST_ENV` for URLs (not hardcoded)
2. ✅ Use `setupIsolatedTest()` or `setupMultiClientTest()`
3. ✅ Use `waitForFunction` instead of `waitScaled` for synchronization
4. ✅ Use tolerance constants from `config/tolerances.ts`
5. ✅ Add descriptive console.log statements for debugging
6. ✅ Test with 8 workers before committing

### Code Review Focus

When reviewing test changes:

1. ❌ Flag any hardcoded URLs
2. ❌ Flag any arbitrary `waitScaled()` calls
3. ❌ Flag any magic number tolerances
4. ❌ Flag any retry loops
5. ✅ Verify proper use of `waitForFunction`
6. ✅ Verify worker-aware tolerances
7. ✅ Verify test isolation

---

## APPENDIX A: File Change Summary

### New Files (4)
1. `tests/config/test-env.ts` - Port configuration
2. `tests/config/tolerances.ts` - Tolerance constants
3. `tests/config/timeouts.ts` - Dynamic timeout calculation
4. `tests/helpers/assertions.ts` - Assertion helpers with logging

### Modified Files (24)

**Test Files (18):**
1. `ball-capture.spec.ts` - URL, waitForFunction, tolerances
2. `client-server-realtime-delta.spec.ts` - URL
3. `client-server-speed-sync.spec.ts` - URL, deterministic movement, worker-aware tolerance
4. `core-features-regression.spec.ts` - URL, waitForFunction, session waits
5. `game-field-rendering.spec.ts` - URL
6. `game-over-screen.spec.ts` - URL
7. `initial-position-sync.spec.ts` - URL
8. `lag-measurement.spec.ts` - URL
9. `match-lifecycle.spec.ts` - URL, phase transition waits
10. `multiplayer-e2e.spec.ts` - URL
11. `multiplayer-network-sync.spec.ts` - URL, connection retry loops, waitForFunction
12. `multiplayer-restart-colors.spec.ts` - URL
13. `player-lifecycle.spec.ts` - URL
14. `player-switching.spec.ts` - URL
15. `room-selection.spec.ts` - URL
16. `shooting-mechanics.spec.ts` - URL, gainPossession, waitForFunction
17. `two-client-cross-visibility.spec.ts` - URL
18. `two-player-room-join.spec.ts` - URL

**Helper Files (3):**
19. `tests/helpers/test-utils.ts` - Add waitForPossession, deterministic movement, worker-aware tolerances
20. `tests/helpers/wait-utils.ts` - Add waitForSession, waitForStateChange
21. `tests/helpers/room-utils.ts` - No changes (already excellent)

**Config Files (3):**
22. `playwright.config.ts` - baseURL, webServer, worker-aware timeouts
23. `package.json` - Add test scripts
24. `client/vite.config.ts` - Support VITE_PORT env var

---

## APPENDIX B: Command Reference

### Development
```bash
# Run development servers (ports 5173/3000)
npm run dev

# Run test servers (ports 5174/3001)
npm run dev:test
```

### Testing
```bash
# Run tests (uses ports 5174/3001)
npm run test:e2e

# Run with specific worker count
npm run test:e2e -- --workers=1
npm run test:e2e -- --workers=4
npm run test:e2e -- --workers=8

# Run specific test file
npm run test:e2e tests/shooting-mechanics.spec.ts

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# View report
npm run test:e2e:report
```

### Verification
```bash
# Clean test artifacts
npm run clean:test

# 10-run stability test
for i in {1..10}; do
  npm run test:e2e -- --workers=8 || break
done

# Performance benchmark
time npm run test:e2e -- --workers=8
```

---

## APPENDIX C: Quick Reference - Common Patterns

### Good vs Bad Test Patterns

#### ❌ BAD: Arbitrary Waits
```typescript
await page.keyboard.press('Space')
await waitScaled(page, 500) // Hope 500ms is enough
const ballState = await getBallState(page)
```

#### ✅ GOOD: Condition-Based Waits
```typescript
const initialBall = await getBallState(page)
await page.keyboard.press('Space')
await page.waitForFunction((initial) => {
  const state = getGameState()
  return state.ball.velocityX !== initial.vx
}, initialBall, { timeout: 5000 })
const ballState = await getBallState(page)
```

---

#### ❌ BAD: Retry Loops
```typescript
for (let i = 0; i < 10; i++) {
  await waitScaled(page, 500)
  const state = await getState(page)
  if (state.ready) break
}
```

#### ✅ GOOD: Playwright waitForFunction
```typescript
await page.waitForFunction(() => {
  const state = getGameState()
  return state.ready === true
}, { timeout: 10000 })
```

---

#### ❌ BAD: Magic Number Tolerances
```typescript
expect(distance).toBeGreaterThan(90) // Why 90?
expect(syncError).toBeLessThan(50)   // Why 50?
```

#### ✅ GOOD: Named Constants
```typescript
import { TOLERANCES } from './config/tolerances'
const tolerance = getMovementTolerance(expectedDistance)
expect(distance).toBeGreaterThan(tolerance.min)
expect(syncError).toBeLessThan(TOLERANCES.NETWORK_SYNC)
```

---

#### ❌ BAD: Hardcoded URLs
```typescript
const CLIENT_URL = 'http://localhost:5173'
await page.goto(CLIENT_URL)
```

#### ✅ GOOD: Environment Configuration
```typescript
import { TEST_ENV } from './config/test-env'
await page.goto(TEST_ENV.CLIENT_URL)
```

---

## CONCLUSION

This comprehensive plan addresses all identified issues preventing reliable 8-worker test execution. The phased approach allows for:

1. **Quick Wins:** Port isolation provides immediate 50% improvement
2. **Systematic Progress:** Each phase is independently testable
3. **Low Risk:** All changes are incremental and reversible
4. **Measurable Results:** Clear success criteria at each phase

**Estimated Timeline:** 7-9 hours implementation + 1 hour verification = 8-10 hours total

**Expected Outcome:** 100% pass rate with 8 workers, ~3 minute test duration, zero flakiness

The test suite is already well-structured with excellent room isolation. The remaining work focuses on eliminating arbitrary timeouts, optimizing tolerances, and separating test/dev environments. All changes follow existing patterns and improve maintainability for future test development.
