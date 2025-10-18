# Phase 3: Race Condition & Tolerance Fixes

## Files with Retry Loops to Fix

### Priority 1: Critical Race Conditions (while loops)

1. **multiplayer-network-sync.spec.ts** (Line 326)
   - Pattern: `while (distance >= 30 && iteration < MAX_ITERATIONS)`
   - Fix: Replace with waitForFunction checking distance condition

2. **player-lifecycle.spec.ts** (Line 65)
   - Pattern: `while (!hasPossession && attempts < 15)`
   - Fix: Replace with waitForFunction checking possession state

3. **player-switching.spec.ts** (Line 260)
   - Pattern: `while (retries < maxRetries && !beforeSwitch)`
   - Fix: Replace with waitForFunction checking switch state

### Priority 2: For-Loop Retries

4. **shooting-mechanics.spec.ts** (Line 548)
   - Pattern: `for (let i = 0; i < 5; i++)` - Shoot spam test
   - Status: Actually sequential actions, NOT a retry pattern - SKIP

5. **lag-measurement.spec.ts** (Lines 50, 103)
   - Line 50: `for (let i = 0; i < 500; i++)` - Polling for movement
   - Line 103: `for (let i = 0; i < 10; i++)` - Multiple measurements
   - Fix: Replace polling loop with waitForFunction

6. **ball-capture.spec.ts** (Lines 328, 449)
   - Line 328: `for (let i = 0; i < 4; i++)` - Pressure testing loop
   - Line 449: `for (let i = 0; i < 10; i++)` - Possession toggle test
   - Status: Already examined - these are intentional test iterations, NOT retries

7. **multiplayer-restart-colors.spec.ts** (Line 193)
   - Pattern: `for (let i = 0; i < 3; i++)` - Color cycling test
   - Status: Intentional test iterations - SKIP

8. **player-lifecycle.spec.ts** (Line 303)
   - Pattern: `for (let i = 0; i < 2; i++)` - Reconnect test loop
   - Status: Intentional test iterations - SKIP

9. **player-switching.spec.ts** (Line 63)
   - Pattern: `for (let i = 0; i < teammates.teammates.length; i++)`
   - Status: Array iteration - SKIP

10. **client-server-realtime-delta.spec.ts** (Line 71)
    - Pattern: `for (let i = 0; i < SAMPLE_COUNT; i++)` - Multiple samples
    - Status: Intentional sampling - SKIP

11. **two-client-cross-visibility.spec.ts** (Lines 165, 320, 462)
    - Pattern: `for (let i = 0; i < SAMPLE_COUNT; i++)` - Multiple samples
    - Status: Intentional sampling - SKIP

### Priority 3: Date.now() Timing Issues

12. **lag-measurement.spec.ts** (Lines 32, 62, 117)
    - Line 32: `const startTime = Date.now()`
    - Line 62: `lag = Date.now() - startTime`
    - Status: Performance measurement - acceptable use
    - Action: Document as intentional timing measurement

13. **Room ID generation with Date.now()** (Multiple files)
    - Files: match-lifecycle, player-lifecycle, player-switching, room-selection, two-player-room-join
    - Pattern: `const testRoomId = test-w${testInfo.workerIndex}-${Date.now()}`
    - Status: Already using worker index - Date.now() adds uniqueness
    - Action: KEEP - no conflict risk

## Summary

**Actual Fixes Needed: 4 files**

1. multiplayer-network-sync.spec.ts - Replace while loop with waitForFunction
2. player-lifecycle.spec.ts - Replace while loop with waitForFunction  
3. player-switching.spec.ts - Replace while loop with waitForFunction
4. lag-measurement.spec.ts - Replace polling loop with waitForFunction

**False Positives (Keep As-Is): 9 patterns**

- Intentional test iterations (ball-capture pressure tests, color cycling)
- Array iterations (player switching teammates)
- Sampling loops (cross-visibility, realtime delta)
- Performance measurements (lag measurement timing)
- Room ID generation (already isolated by worker index)

