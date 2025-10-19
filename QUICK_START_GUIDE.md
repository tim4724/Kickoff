# Quick Start Guide: 8-Worker Test Improvements

## TL;DR - Critical Issues

**Current State:** Tests pass with 1-2 workers, unreliable at 8 workers
**Target:** 100% pass rate with 8 workers
**Time Required:** 8-10 hours
**Priority Order:** Port isolation → Race conditions → Tolerances → Verification

---

## Top 5 Critical Issues

### 1. PORT CONFLICTS (Fix First - 1 hour)
**Problem:** Tests share ports 5173/3000 with dev servers
**Impact:** Random failures when `npm run dev` is running
**Quick Fix:**

```bash
# Create test environment config
cat > tests/config/test-env.ts << 'EOF'
export const TEST_ENV = {
  CLIENT_URL: 'http://localhost:5174',
  SERVER_URL: 'http://localhost:3001'
} as const
EOF

# Update package.json
npm pkg set scripts.dev:client:test="cd client && VITE_PORT=5174 npm run dev"
npm pkg set scripts.dev:server:test="cd server && PORT=3001 npm run dev"
npm pkg set scripts.dev:test="concurrently \"npm:dev:shared\" \"npm:dev:client:test\" \"npm:dev:server:test\""
```

Then update all test files:
```typescript
// OLD: const CLIENT_URL = 'http://localhost:5173'
// NEW:
import { TEST_ENV } from './config/test-env'
const CLIENT_URL = TEST_ENV.CLIENT_URL
```

---

### 2. RETRY LOOPS (Fix Second - 2 hours)
**Problem:** 27 instances of arbitrary `waitScaled()` calls masking race conditions
**Impact:** Tests timeout randomly under CPU load

**Before:**
```typescript
for (let i = 0; i < 10; i++) {
  await waitScaled(page, 500) // Hope it's ready
  if (await isReady(page)) break
}
```

**After:**
```typescript
await page.waitForFunction(() => {
  return (window as any).__gameControls?.scene?.ready === true
}, { timeout: 15000 })
```

**Files to fix:**
- `shooting-mechanics.spec.ts` - gainPossession() function
- `ball-capture.spec.ts` - 5 possession loops
- `multiplayer-network-sync.spec.ts` - connection retry loops

---

### 3. OVERLY PERMISSIVE TOLERANCES (Fix Third - 1 hour)
**Problem:** Tests accept 10% of expected behavior
**Impact:** Bugs pass as successful tests

**Before:**
```typescript
const expectedDistance = 900 // px
const minDistance = expectedDistance * 0.10  // 90px - ACCEPTS 10x SLOWER!
expect(distance).toBeGreaterThan(minDistance)
```

**After:**
```typescript
const tolerance = {
  min: expectedDistance * 0.60,  // 540px
  max: expectedDistance * 1.40   // 1260px
}
expect(distance).toBeGreaterThanOrEqual(tolerance.min)
expect(distance).toBeLessThan(tolerance.max)
```

**File to fix:** `client-server-speed-sync.spec.ts:78`

---

### 4. MOVEMENT TIMING ASSUMPTIONS (Fix Fourth - 1 hour)
**Problem:** Tests assume constant 60 FPS, but 8 workers throttle to ~6 FPS
**Impact:** Movement tests fail or pass incorrectly

**Fix:** Use RAF-independent movement
```typescript
// Before: Frame-dependent keyboard movement
await page.keyboard.down('ArrowRight')
await waitScaled(page, 2000)
await page.keyboard.up('ArrowRight')

// After: Direct velocity control
await page.evaluate(() => {
  return (window as any).__gameControls.test.movePlayerDirect(1, 0, 2000)
})
```

---

### 5. NETWORK SYNC WAITS (Fix Fifth - 1 hour)
**Problem:** Assumes 500ms network propagation
**Impact:** Flaky under variable network conditions

**Fix:** Wait for actual state changes
```typescript
// Before:
await shootBall(client1)
await waitScaled(client1, 500) // Hope network synced

// After:
const initialBall = await getBallState(client1)
await shootBall(client1)
await client1.waitForFunction((initial) => {
  const state = getGameState()
  return state.ball.velocityX !== initial.vx ||
         state.ball.velocityY !== initial.vy
}, initialBall, { timeout: 5000 })
```

---

## Immediate Action Items

### Hour 1: Port Isolation
```bash
# 1. Create config directory
mkdir -p tests/config

# 2. Create test-env.ts
cat > tests/config/test-env.ts << 'EOF'
export const TEST_ENV = {
  CLIENT_PORT: 5174,
  SERVER_PORT: 3001,
  CLIENT_URL: 'http://localhost:5174',
  SERVER_URL: 'http://localhost:3001'
} as const
EOF

# 3. Update all 18 test files
find tests -name "*.spec.ts" -exec sed -i.bak \
  "s/const CLIENT_URL = 'http:\/\/localhost:5173'/import { TEST_ENV } from '.\/config\/test-env'\nconst CLIENT_URL = TEST_ENV.CLIENT_URL/g" {} \;

# 4. Test it
npm run test:e2e -- --workers=8
```

### Hours 2-3: Fix Race Conditions
Priority files:
1. `tests/helpers/test-utils.ts` - Replace gainPossession()
2. `shooting-mechanics.spec.ts` - Use new helper
3. `ball-capture.spec.ts` - Replace retry loops
4. `multiplayer-network-sync.spec.ts` - Fix connection waits

### Hour 4: Tolerance Optimization
1. Create `tests/config/tolerances.ts`
2. Update `client-server-speed-sync.spec.ts`
3. Standardize position sync tolerances across all files

### Hours 5-6: Verification
```bash
# Clean run
npm run clean:test

# Single 8-worker run
npm run test:e2e -- --workers=8

# 10 consecutive runs
for i in {1..10}; do
  echo "Run $i/10"
  npm run test:e2e -- --workers=8 || break
done
```

---

## Commands Cheat Sheet

```bash
# Run tests with different worker counts
npm run test:e2e -- --workers=1   # Baseline
npm run test:e2e -- --workers=4   # Medium
npm run test:e2e -- --workers=8   # Target

# Run specific test
npm run test:e2e tests/shooting-mechanics.spec.ts

# Debug mode
npm run test:e2e:debug tests/shooting-mechanics.spec.ts

# Clean and re-run
npm run clean:test && npm run test:e2e -- --workers=8

# Performance timing
time npm run test:e2e -- --workers=8
```

---

## Success Checklist

After each phase, verify:
- [ ] Tests pass with 1 worker (baseline)
- [ ] Tests pass with 4 workers
- [ ] Tests pass with 8 workers
- [ ] 10 consecutive 8-worker runs = 100% pass rate
- [ ] Test duration < 5 minutes with 8 workers
- [ ] No port conflicts with dev servers
- [ ] No random timeouts or race conditions

---

## Need Help?

See full details in `TEST_IMPROVEMENT_PLAN.md`:
- Detailed issue analysis with code examples
- Complete implementation roadmap
- Tolerance recommendations
- File-by-file change list
- Testing and verification procedures

---

## Key Insight

**The test infrastructure is already excellent** (room isolation, time acceleration, helpers). The issues are:
1. Port conflicts (easy fix)
2. Arbitrary waits (replace with conditions)
3. Overly permissive tolerances (tighten based on actual behavior)

None of these require architectural changes - just systematic refinement of existing patterns.
