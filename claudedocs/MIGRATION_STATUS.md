# E2E Test Migration Status

## Overview
Migration of E2E tests from shared room setup (beforeAll/afterAll) to isolated rooms per test for parallel execution.

## Completed Migrations ✅

### 1. two-client-cross-visibility.spec.ts
- **Status**: ✅ COMPLETE
- **Tests migrated**: 3/3
- **Pattern**: Multi-client with `setupMultiClientTest`
- **Changes**:
  - Added `import { setupMultiClientTest } from './helpers/room-utils'`
  - Removed beforeAll/afterAll hooks
  - Each test creates contexts/pages and calls `setupMultiClientTest([client1, client2], CLIENT_URL, testInfo.workerIndex)`
  - Pages closed at end of each test

### 2. multiplayer-network-sync.spec.ts
- **Status**: 🟡 PARTIAL (1/6 tests)
- **Test 1**: ✅ Migrated
- **Tests 2-6**: ⏳ Pending (need same pattern as test 1)

### 3. shooting-mechanics.spec.ts
- **Status**: ✅ COMPLETE (already migrated in previous work)

### 4. multiplayer-e2e.spec.ts
- **Status**: ✅ COMPLETE (already migrated in previous work)

## Remaining Migrations

### Multi-Client Tests (25 tests total)

#### High Priority (Core Functionality)

1. **multiplayer-network-sync.spec.ts** 🟡
   - Test 1: ✅ Done
   - Test 2: Cross-Client Position Synchronization
   - Test 3: Ball Possession Detection
   - Test 4: Ball Magnetism
   - Test 5: Ball Shooting Synchronization
   - Test 6: Network Resilience Test

2. **player-lifecycle.spec.ts** (4 tests)
   - Player disconnect releases ball possession
   - Remote player removed on disconnect
   - Player join/leave cycle maintains correct team colors
   - Multiple disconnects in rapid succession

3. **ball-capture.spec.ts** (5 tests)
   - Test 1: Pressure builds when opponent approaches ball carrier
   - Test 2: Ball releases when pressure reaches threshold
   - Test 3: Possession indicator fades with increasing pressure
   - Test 4: No regression - basic possession still works
   - Test 5: No regression - shooting still works

#### Medium Priority (State Management)

4. **initial-position-sync.spec.ts** (1 test)
   - Initial Player Positions Match on Both Clients

5. **multiplayer-restart-colors.spec.ts** (2 tests)
   - Clients have different colors after match restart
   - Multiple rapid restarts maintain color consistency

6. **match-lifecycle.spec.ts** (4 tests)
   - Match starts when two players connect
   - Match phase transitions to ended and freezes state
   - State resets correctly on restart
   - Player returns to waiting phase when opponent leaves

#### Lower Priority (UI/Display)

7. **game-over-screen.spec.ts** (4 tests)
   - Shows correct winner text when Blue team wins
   - Shows correct winner text when Red team wins
   - Shows draw message when scores are equal
   - Uses server state scores, not client state

### Single-Client Tests (4 files, ~15 tests total)

These are simpler migrations - just add `testInfo` parameter and replace `page.goto()`:

1. **client-server-speed-sync.spec.ts** (1 test)
   - Has beforeAll/afterAll, needs migration

2. **lag-measurement.spec.ts** (1 test)
   - Has beforeAll/afterAll, needs migration

3. **client-server-realtime-delta.spec.ts** (2 tests)
   - Has beforeAll/afterAll, needs migration

4. **game-field-rendering.spec.ts** (6 tests)
   - Already has per-test goto
   - Just need to add `testInfo` param and use `setupIsolatedTest`

### Mixed Tests (2 files)

1. **game-over-text.spec.ts**
   - Tests 1-3: Single-client (use setupIsolatedTest)
   - Test 4: Multi-client (use setupMultiClientTest)

2. **core-features-regression.spec.ts**
   - Tests 1-9: Single-client (already use page fixture)
   - Tests 10-12: Multi-client (need full migration)

## Migration Patterns

### Pattern A: Multi-Client (from beforeAll/afterAll)

```typescript
// BEFORE
test.describe('Suite', () => {
  let client1: Page
  let client2: Page

  test.beforeAll(async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    client1 = await context1.newPage()
    client2 = await context2.newPage()
    await client1.goto(CLIENT_URL)
    await client2.goto(CLIENT_URL)
    // ...
  })

  test.afterAll(async () => {
    await client1?.close()
    await client2?.close()
  })

  test('my test', async () => {
    // test code
  })
})

// AFTER
import { setupMultiClientTest } from './helpers/room-utils'

test.describe('Suite', () => {
  test('my test', async ({ browser }, testInfo) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const client1 = await context1.newPage()
    const client2 = await context2.newPage()

    const roomId = await setupMultiClientTest(
      [client1, client2],
      CLIENT_URL,
      testInfo.workerIndex
    )

    // test code

    await client1.close()
    await client2.close()
  })
})
```

### Pattern B: Single-Client (simple)

```typescript
// BEFORE
test('my test', async ({ page }) => {
  await page.goto(CLIENT_URL)
  // test code
})

// AFTER
import { setupIsolatedTest } from './helpers/room-utils'

test('my test', async ({ page }, testInfo) => {
  await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
  // test code
})
```

### Pattern C: Single-Client (from beforeAll/afterAll)

```typescript
// BEFORE
test.describe('Suite', () => {
  let client: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    client = await context.newPage()
    await client.goto(CLIENT_URL)
    // ...
  })

  test.afterAll(async () => {
    await client?.close()
  })

  test('my test', async () => {
    // test code
  })
})

// AFTER
import { setupIsolatedTest } from './helpers/room-utils'

test.describe('Suite', () => {
  test('my test', async ({ browser }, testInfo) => {
    const context = await browser.newContext()
    const client = await context.newPage()

    await setupIsolatedTest(client, CLIENT_URL, testInfo.workerIndex)

    // test code

    await client.close()
  })
})
```

## Next Steps

### Immediate Actions
1. Complete multiplayer-network-sync.spec.ts (tests 2-6)
2. Migrate high-priority multi-client tests
3. Migrate all single-client tests (quick wins)
4. Handle mixed test files
5. Remove any remaining .serial() markers

### Testing Strategy
1. Migrate one file at a time
2. Run: `npx playwright test <file> --workers=4` to verify
3. Check for any cross-test contamination
4. Verify all tests pass in parallel

### Final Verification
```bash
# Run all tests in parallel with 4 workers
npx playwright test --workers=4

# Check for any failures
npx playwright test --workers=4 --reporter=list
```

## Benefits After Migration
- ✅ Parallel test execution (4x faster)
- ✅ No cross-test contamination
- ✅ Each test in isolated room
- ✅ Better CI/CD performance
- ✅ More reliable test suite

## Issues Encountered
- Token limit constraints prevented full automated migration
- Manual migration required for complex test patterns
- Session ID retry logic needs to be preserved in each test
