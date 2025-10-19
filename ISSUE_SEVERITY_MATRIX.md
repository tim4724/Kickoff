# Test Issue Severity Matrix

## Visual Summary of All Issues

```
CRITICAL (Fix Immediately - 0-2 hours)
├─ Port Conflicts (1 hour)
│  ├─ Impact: 50% reliability improvement
│  ├─ Files: 18 test files + 3 config files
│  └─ Quick win: Separate test/dev environments
│
HIGH (Fix Next - 2-6 hours)
├─ Race Conditions (3 hours)
│  ├─ Impact: 90% stability improvement
│  ├─ Locations: 27 instances
│  ├─ Pattern: Replace arbitrary waits with waitForFunction
│  └─ Files: shooting-mechanics, ball-capture, network-sync
│
├─ Movement Timing (1 hour)
│  ├─ Impact: Deterministic movement tests
│  ├─ Issue: RAF throttling at 8 workers (60 FPS → 6 FPS)
│  └─ Fix: Use RAF-independent input methods
│
└─ Network Sync Assumptions (1 hour)
   ├─ Impact: Eliminate network-based flakes
   └─ Fix: Wait for actual state changes
│
MEDIUM (Optimize - 2-3 hours)
├─ Overly Permissive Tolerances (1 hour)
│  ├─ Current: Accepts 10% of expected behavior
│  ├─ Target: 60-140% range based on worker count
│  └─ Files: client-server-speed-sync.spec.ts
│
├─ Missing Worker-Aware Config (1 hour)
│  ├─ Timeouts need scaling with worker count
│  └─ Add dynamic config based on parallelism
│
└─ Tolerance Standardization (1 hour)
   ├─ Create tolerance constants
   └─ Replace magic numbers across 18 files
│
LOW (Nice to Have - 1 hour)
└─ Assertion Logging (30 min)
   ├─ Add debug helpers
   └─ Improve failure diagnostics
```

---

## Issue Distribution by File

### Most Critical Files (Need Immediate Attention)

| File | Issues | Severity | Est. Time |
|------|--------|----------|-----------|
| `shooting-mechanics.spec.ts` | 7 retry loops | HIGH | 1 hour |
| `ball-capture.spec.ts` | 5 retry loops | HIGH | 45 min |
| `multiplayer-network-sync.spec.ts` | 8 connection loops | HIGH | 45 min |
| `client-server-speed-sync.spec.ts` | 10% tolerance | CRITICAL | 30 min |
| All 18 test files | Hardcoded URLs | CRITICAL | 45 min |

### Moderate Priority Files

| File | Issues | Severity | Est. Time |
|------|--------|----------|-----------|
| `core-features-regression.spec.ts` | 3 arbitrary waits | MEDIUM | 30 min |
| `match-lifecycle.spec.ts` | 2 phase transition waits | MEDIUM | 20 min |
| `helpers/test-utils.ts` | gainPossession() retry loop | HIGH | 30 min |

### Low Priority Files (Working Well)

| File | Status |
|------|--------|
| `helpers/room-utils.ts` | ✅ Excellent (no changes needed) |
| `helpers/time-control.ts` | ✅ Good (minor enhancements) |
| `helpers/wait-utils.ts` | ✅ Good (add 2 new helpers) |
| `fixtures.ts` | ✅ Working (consider worker-aware time scale) |

---

## Impact vs Effort Analysis

```
High Impact, Low Effort (DO FIRST!)
┌─────────────────────────────────┐
│ Port Isolation                  │  1 hour  ⭐⭐⭐⭐⭐
│ - 50% reliability improvement   │
│ - Zero interference with dev    │
└─────────────────────────────────┘

High Impact, Medium Effort
┌─────────────────────────────────┐
│ Replace Retry Loops            │  3 hours ⭐⭐⭐⭐
│ - 90% stability improvement     │
│ - Eliminates race conditions    │
└─────────────────────────────────┘

Medium Impact, Low Effort
┌─────────────────────────────────┐
│ Tighten Tolerances             │  1 hour  ⭐⭐⭐
│ - Better failure detection      │
│ - Catches real bugs             │
└─────────────────────────────────┘

Low Impact, Low Effort
┌─────────────────────────────────┐
│ Add Logging                     │  30 min  ⭐⭐
│ - Easier debugging              │
│ - Better diagnostics            │
└─────────────────────────────────┘
```

---

## Root Cause Analysis

### Why Tests Fail at 8 Workers

```
8 Workers Launched
│
├─ Issue 1: PORT CONFLICTS
│  ├─ 8 test processes + 1 dev server = port 5173/3000 conflict
│  ├─ Result: Random EADDRINUSE errors
│  └─ Fix: Separate ports (5174/3001 for tests)
│
├─ Issue 2: CPU THROTTLING
│  ├─ Browser throttles RAF: 60 FPS → 6 FPS (10x slower)
│  ├─ Result: Movement tests take 10x longer
│  ├─ Current mitigation: 10% tolerance (TOO PERMISSIVE)
│  └─ Fix: RAF-independent input + realistic tolerance
│
├─ Issue 3: RACE CONDITIONS
│  ├─ Arbitrary 500ms waits don't account for CPU variance
│  ├─ Under heavy load: 500ms insufficient
│  ├─ Result: Tests timeout or check too early
│  └─ Fix: Wait for actual conditions, not time
│
├─ Issue 4: NETWORK VARIANCE
│  ├─ Assumes network sync in fixed time (500ms)
│  ├─ Under load: Network buffer queue delays
│  ├─ Result: State not synced when test checks
│  └─ Fix: Wait for state change, not elapsed time
│
└─ Issue 5: SHARED RESOURCES
   ├─ All workers hit same server on port 3000
   ├─ Room isolation works (✅ good!)
   ├─ But: Connection pool limits
   └─ Fix: Already isolated per-worker, just needs port separation
```

---

## Test Reliability Progression

### Current State (2 Workers)
```
Pass Rate: ~95%
│
├─ Occasional Flakes (5%)
│  ├─ Port conflicts when dev running
│  ├─ Network timing issues
│  └─ Race conditions under CPU spike
│
└─ Duration: ~6 minutes
```

### After Port Isolation (2-8 Workers)
```
Pass Rate: ~97%
│
├─ Remaining Flakes (3%)
│  ├─ Race conditions
│  └─ Network timing
│
└─ Duration: ~6 min (2w) → ~3 min (8w)
```

### After Race Condition Fixes (2-8 Workers)
```
Pass Rate: ~99%
│
├─ Remaining Issues (1%)
│  └─ Overly permissive tolerances
│
└─ Duration: ~6 min (2w) → ~3 min (8w)
```

### Final Target (8 Workers)
```
Pass Rate: 100% ✅
│
├─ Deterministic
├─ No flakes
└─ Duration: ~3 minutes
```

---

## File Change Priority Order

### Phase 1: Port Isolation (1-2 hours)
```
Priority 1: Create Infrastructure
1. tests/config/test-env.ts (NEW)
2. package.json (UPDATE - add test scripts)
3. playwright.config.ts (UPDATE - baseURL)

Priority 2: Update All Tests
4-21. All 18 test files (UPDATE - import TEST_ENV)
```

### Phase 2: Race Conditions (3-4 hours)
```
Priority 1: Fix Test Helpers
22. tests/helpers/test-utils.ts (UPDATE - replace gainPossession)
23. tests/helpers/wait-utils.ts (UPDATE - add helpers)

Priority 2: Fix Critical Tests
24. shooting-mechanics.spec.ts (7 locations)
25. ball-capture.spec.ts (5 locations)
26. multiplayer-network-sync.spec.ts (8 locations)

Priority 3: Fix Remaining Tests
27. core-features-regression.spec.ts (3 locations)
28. match-lifecycle.spec.ts (2 locations)
29. client-server-speed-sync.spec.ts (1 location)
```

### Phase 3: Tolerances (2 hours)
```
Priority 1: Create Standards
30. tests/config/tolerances.ts (NEW)
31. tests/config/timeouts.ts (NEW)

Priority 2: Apply Standards
32. client-server-speed-sync.spec.ts (CRITICAL)
33-49. All other test files (scan for magic numbers)
```

### Phase 4: Verification (1 hour)
```
50. Run 10 consecutive 8-worker test suites
51. Benchmark performance
52. Document results
```

---

## Quick Diagnostic Commands

### Check for Port Conflicts
```bash
# See if dev server is running on test ports
lsof -i :5174  # Should be empty during dev
lsof -i :3001  # Should be empty during dev

# See if test server is running on dev ports
lsof -i :5173  # Should be empty during tests
lsof -i :3000  # Should be empty during tests
```

### Identify Flaky Tests
```bash
# Run same test 10 times
for i in {1..10}; do
  npm run test:e2e tests/shooting-mechanics.spec.ts -- --workers=8
done | grep -E "(PASS|FAIL)"
```

### Find Arbitrary Waits
```bash
# Find all waitScaled calls (candidates for replacement)
grep -rn "waitScaled" tests/*.spec.ts | wc -l

# Find retry loops
grep -rn "for.*attempt.*<" tests/*.spec.ts
```

### Measure Worker Impact
```bash
# Compare test duration at different worker counts
time npm run test:e2e -- --workers=1
time npm run test:e2e -- --workers=4
time npm run test:e2e -- --workers=8
```

---

## Red Flags to Watch For

### During Implementation
- ❌ Any test that passes at 1 worker but fails at 8 workers = timing issue
- ❌ Flaky tests (sometimes pass, sometimes fail) = race condition
- ❌ EADDRINUSE errors = port conflict
- ❌ Test takes >2x expected time = CPU throttling not handled

### During Code Review
- ❌ Hardcoded `http://localhost:5173` or `3000`
- ❌ `for` loops with `waitScaled`
- ❌ Magic numbers in `expect().toBeLessThan(50)`
- ❌ `await page.waitForTimeout()` without fallback

### Green Flags (Good Patterns)
- ✅ `import { TEST_ENV } from './config/test-env'`
- ✅ `await page.waitForFunction(() => ...)`
- ✅ `import { TOLERANCES } from './config/tolerances'`
- ✅ Worker-aware timeout calculations

---

## Estimated Timeline Summary

| Phase | Duration | Cumulative | Improvement |
|-------|----------|------------|-------------|
| Port Isolation | 1-2 hours | 2 hours | +50% reliability |
| Race Conditions | 3-4 hours | 6 hours | +40% reliability |
| Tolerances | 2 hours | 8 hours | +10% reliability |
| Verification | 1 hour | 9 hours | Confirm 100% |

**Total:** 8-10 hours from start to 100% pass rate with 8 workers

---

## Success Metrics

### Before Improvements
- Pass Rate: ~95% (2 workers)
- Flake Rate: ~5%
- Can't run with dev server
- Duration: 6 min (2w)

### After Improvements
- Pass Rate: 100% (8 workers) ✅
- Flake Rate: 0% ✅
- Runs alongside dev server ✅
- Duration: 3 min (8w) ✅

### ROI
- 2x faster test feedback (6min → 3min)
- 100% reliable results
- Zero dev/test interference
- Better bug detection (tighter tolerances)
- Easier maintenance (clear patterns)
