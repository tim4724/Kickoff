# Testing Guide

## Quick Start

```bash
# Run all tests (recommended: 1 worker for stability)
npm run test:e2e -- --workers=1

# Run specific test suites
npm run test:stable    # Stable core feature tests
npm run test:physics   # Physics and gameplay tests

# Run with UI (interactive mode)
npm run test:e2e:ui

# View latest test report
npm run test:e2e:report
```

## Test Infrastructure

### Time Control System

Tests use a **10x time acceleration** system for faster execution while maintaining deterministic physics:

```typescript
// Automatic 10x time acceleration (configured in global setup)
// Game time: 120s match = 12s real time

// Manual time control (advanced usage)
import { setTimeScale, waitScaled } from './helpers/time-control'

await setTimeScale(page, 10)  // 10x speed
await waitScaled(page, 1000)  // Wait 1s game time = 100ms real time
```

### Test Isolation

Each test runs in an isolated Colyseus room to prevent cross-test interference:

```typescript
import { setupIsolatedTest } from './helpers/room-utils'

test('my test', async ({ page }, testInfo) => {
  const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
  // Test runs in isolated room
})
```

### Key Helper Functions

**Time Control** (`tests/helpers/time-control.ts`):
- `setTimeScale(page, scale)` - Set time acceleration (1-100x)
- `getTimeScale(page)` - Get current time scale
- `waitScaled(page, ms)` - Wait adjusted for time scale
- `enableMockTime(page)` - Enable frame-perfect control
- `advanceTime(page, deltaMs)` - Manual time stepping

**Room Management** (`tests/helpers/room-utils.ts`):
- `setupIsolatedTest()` - Single client setup
- `setupMultiClientTest()` - Multiple clients in same room
- `waitForPlayerReady()` - Wait for server confirmation
- `generateTestRoomId()` - Create unique room IDs

**Game State** (`tests/helpers/game-state.ts`):
- `getServerState(page)` - Get authoritative server state
- `waitForMatchStart(page)` - Wait for match to begin
- `waitForPhase(page, phase)` - Wait for specific game phase

## Test Organization

```
tests/
├── helpers/           # Test utilities and helpers
│   ├── time-control.ts      # Time acceleration
│   ├── room-utils.ts        # Room isolation
│   ├── game-state.ts        # State management
│   └── wait-utils.ts        # Waiting utilities
│
├── stable-tests/      # Core features (always pass)
│   ├── room-selection.spec.ts
│   ├── player-lifecycle.spec.ts
│   └── multiplayer-e2e.spec.ts
│
└── physics-tests/     # Gameplay mechanics
    ├── ball-capture.spec.ts
    ├── shooting-mechanics.spec.ts
    └── client-server-speed-sync.spec.ts
```

## Deterministic Physics

The game uses a **fixed 60Hz timestep** for deterministic physics:

```typescript
// GameEngine runs physics at fixed 16.666ms intervals
const FIXED_TIMESTEP_MS = 1000 / 60  // 16.666ms
const FIXED_TIMESTEP_S = FIXED_TIMESTEP_MS / 1000  // 0.01666s

// Time acceleration doesn't affect physics determinism
// It only speeds up the clock, physics steps remain fixed
```

## Multi-Worker Testing

**Current Status**: Multi-worker testing (2+ workers) is **not supported** due to Playwright browser concurrency issues.

**Recommended**: Use **1 worker** with 10x time acceleration:
```bash
npm run test:e2e -- --workers=1
```

**Why 1 Worker?**
- ✅ All tests pass reliably
- ✅ 10x time acceleration provides speed
- ✅ Deterministic physics maintained
- ❌ Multi-worker has browser initialization failures

See `PARALLEL_TEST_ANALYSIS.md` for detailed investigation.

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test'
import { setupIsolatedTest } from './helpers/room-utils'
import { waitForMatchStart, getServerState } from './helpers/game-state'

const CLIENT_URL = 'http://localhost:5173'

test('my gameplay test', async ({ page }, testInfo) => {
  // 1. Setup isolated room
  const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)

  // 2. Wait for match to start
  await waitForMatchStart(page)

  // 3. Test game logic
  const state = await getServerState(page)
  expect(state.phase).toBe('playing')
  expect(state.matchTime).toBeGreaterThan(0)

  // 4. Interact and verify
  await page.click('#shoot-button')
  await page.waitForTimeout(100)

  const newState = await getServerState(page)
  // Assertions...
})
```

### Multiplayer Test Structure

```typescript
test('two player test', async ({ browser }, testInfo) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()
  const client1 = await context1.newPage()
  const client2 = await context2.newPage()

  const roomId = await setupMultiClientTest(
    [client1, client2],
    CLIENT_URL,
    testInfo.workerIndex
  )

  await waitForMatchStart(client1)
  await waitForMatchStart(client2)

  // Both clients now in same match
  const state1 = await getServerState(client1)
  const state2 = await getServerState(client2)

  expect(state1.players.size).toBe(2)
  expect(state2.players.size).toBe(2)
})
```

## Debugging Tests

### Interactive Mode
```bash
npm run test:e2e:ui
```

### Headed Browser
```bash
npm run test:e2e:headed
```

### Debug Specific Test
```bash
npm run test:e2e:debug -- tests/my-test.spec.ts
```

### View Test Artifacts
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

## Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
{
  testDir: './tests',
  fullyParallel: true,
  timeout: 30000,  // 30s (reduced for time acceleration)
  workers: 8,      // Ignored, use --workers=1

  projects: [
    { name: 'stable-tests', testMatch: /room-selection|player-lifecycle|multiplayer-e2e/ },
    { name: 'physics-tests', testMatch: /ball-capture|shooting|speed-sync/ }
  ]
}
```

### Global Setup

Time acceleration is automatically applied to all tests via `tests/global-setup.ts`.

## Troubleshooting

### Tests Timeout
- **Solution**: Ensure dev server is running (`npm run dev`)
- **Check**: `curl http://localhost:5173` and `curl http://localhost:3000/health`

### Connection Failures
- **Symptom**: `ERR_CONNECTION_RESET` or `Failed to fetch`
- **Solution**: Restart dev environment: `pkill -9 -f "node|tsx|vite" && npm run dev`

### Flaky Tests
- **Solution**: Use 1 worker (`--workers=1`)
- **Verify**: Time acceleration is active (check console logs)

### Physics Non-Determinism
- **Check**: GameClock is properly initialized
- **Verify**: Fixed timestep (60Hz) in GameEngine
- **Debug**: Use `enableMockTime()` for frame-perfect control

## Performance

### Current Performance
```
Configuration       | Workers | Time    | Status
--------------------|---------|---------|--------
Recommended         | 1       | 5-8 min | ✅ Pass (all 79 tests)
With 10x accel      | 1       | 5-8 min | ✅ Pass (10x game time)
Multi-worker (2+)   | 2-4     | N/A     | ❌ Fail (browser issues)
```

### Speed Optimization

Tests run **10x faster** due to time acceleration:
- Match duration: 120s game time = 12s real time
- Test timeouts: Reduced proportionally
- Physics: Still deterministic (fixed 60Hz)

## Best Practices

1. **Always use 1 worker** for stability
2. **Leverage time acceleration** for speed
3. **Use isolated rooms** to prevent test interference
4. **Wait for server confirmation** (`waitForPlayerReady`)
5. **Test server state**, not just client UI
6. **Use helpers** to reduce boilerplate
7. **Group related tests** in describe blocks
8. **Clean up resources** (close pages/contexts)

## References

- [Playwright Documentation](https://playwright.dev)
- [Colyseus Testing Guide](https://docs.colyseus.io/testing)
- Time Control: `tests/helpers/time-control.ts`
- Room Utils: `tests/helpers/room-utils.ts`
