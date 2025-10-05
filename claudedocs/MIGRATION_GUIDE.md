# Test Isolation Migration Guide

## Overview
This guide explains how to migrate existing test suites to use isolated Colyseus rooms for parallel execution.

## Why Test Isolation?
- **Prevents Cross-Test Contamination**: Each test runs in its own Colyseus room
- **Enables Parallel Execution**: Tests can run simultaneously without interference
- **Faster Regression Testing**: Parallel execution reduces test suite runtime significantly

## How It Works

### 1. Room Selection Priority (NetworkManager)
```
URL Parameter → Window Variable → Default Config
```

The NetworkManager checks in this order:
1. `?roomId=xxx` in URL (for manual debugging)
2. `window.__testRoomId` (for automated tests)
3. `config.roomName` (default: 'match')

When a test room ID is detected, the client calls `create('match')` to force creation of a new isolated room.

### 2. Test Helper Utilities
Located in `tests/helpers/room-utils.ts`:

- `generateTestRoomId(workerIndex)` - Creates unique room IDs
- `setTestRoomId(page, roomId)` - Sets window variable before page load
- `setupIsolatedTest(page, url, workerIndex)` - Single-client test setup
- `setupMultiClientTest(pages[], url, workerIndex)` - Multi-client test setup

## Migration Steps

### Single-Client Tests

**Before:**
```typescript
test('my test', async ({ page }) => {
  await page.goto(CLIENT_URL)
  // ... test code
})
```

**After:**
```typescript
import { setupIsolatedTest } from './helpers/room-utils'

test('my test', async ({ page }, testInfo) => {
  const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
  console.log(`🔒 Test isolated in room: ${roomId}`)
  // ... test code
})
```

### Multi-Client Tests

**Before:**
```typescript
test('multiplayer test', async ({ browser }) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()
  const client1 = await context1.newPage()
  const client2 = await context2.newPage()

  await client1.goto(CLIENT_URL)
  await client2.goto(CLIENT_URL)
  // ... test code
})
```

**After:**
```typescript
import { setupMultiClientTest } from './helpers/room-utils'

test('multiplayer test', async ({ browser }, testInfo) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()
  const client1 = await context1.newPage()
  const client2 = await context2.newPage()

  const roomId = await setupMultiClientTest(
    [client1, client2],
    CLIENT_URL,
    testInfo.workerIndex
  )
  console.log(`🔒 Both clients isolated in room: ${roomId}`)
  // ... test code
})
```

### Remove Serial Execution

**Before:**
```typescript
test.describe.serial('My Tests', () => {
  // Tests run sequentially
})
```

**After:**
```typescript
test.describe('My Tests', () => {
  // Tests run in parallel (isolated rooms)
})
```

## Example: shooting-mechanics.spec.ts

See `tests/shooting-mechanics.spec.ts` for a complete working example with:
- 6 single-client tests using `setupIsolatedTest()`
- 1 multi-client test using `setupMultiClientTest()`
- Parallel execution enabled
- All tests properly isolated

## Troubleshooting

### Tests fail with "sessionId is empty"
- Ensure you're using `setupIsolatedTest()` or `setupMultiClientTest()`
- Check that `testInfo` parameter is added to test signature
- Verify the game initializes (wait time may need adjustment)

### Tests still interfere with each other
- Check that you removed `.serial()` from test.describe
- Verify each test uses the isolation helpers
- Confirm parallel execution is enabled in `playwright.config.ts`

### Multi-client tests fail to coordinate
- Ensure all pages use `setupMultiClientTest()` (not individual `setupIsolatedTest()`)
- Verify all pages get the same roomId
- Check that server allows multiple clients per room

## Implementation Files

- `client/src/network/NetworkManager.ts` - Room selection logic
- `tests/helpers/room-utils.ts` - Test isolation utilities
- `playwright.config.ts` - Parallel execution config
- `tests/shooting-mechanics.spec.ts` - Reference implementation

## Next Steps

1. Migrate remaining test suites one at a time
2. Test each suite individually after migration
3. Run full suite with parallel execution to verify no interference
4. Gradually increase worker count for faster execution
