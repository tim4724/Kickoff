# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Socca2** is a fast-paced multiplayer arcade soccer game for mobile web. It's a real-time 2v2 (human + AI bots) soccer game built with Phaser 3 (client) and Colyseus (multiplayer server).

- **Current State**: Core multiplayer working with 100% E2E test pass rate
- **Key Achievement**: 55ms input lag (professional-grade, <100ms threshold)
- **Architecture**: Client-server with authoritative server, client prediction, and fixed timestep physics

## Essential Commands

### Development
```bash
npm run dev                    # Start all (client + server + shared watch mode)
npm run dev:client             # Client only (http://localhost:5173)
npm run dev:server             # Server only (http://localhost:3000)
npm run dev:shared             # Shared types watch mode
```

### Testing
```bash
# Run tests with parallel workers (default production mode)
npm run test:e2e                                    # All E2E tests (2 workers)
npm run test:e2e -- --workers=4                     # Custom worker count
npx playwright test --project=stable-tests          # Only stable tests

# Interactive/Debug modes
npm run test:e2e:ui                                 # Playwright UI (single worker)
npm run test:e2e:headed                             # See browser during tests
npm run test:e2e:debug                              # Debug mode with breakpoints

# Specific test suites
npm run test:physics            # Physics-only tests
npm run test:stable             # Stable tests only
npm run test:network            # Network sync tests

# Test management
npm run clean:test              # Remove test artifacts before running
npm run test:e2e:report         # View HTML report
```

**Important Testing Notes**:
- Tests use **isolated rooms** for parallel execution (each worker gets unique room)
- Default 2 workers provides good balance of speed and reliability
- Test helpers in `tests/helpers/room-utils.ts` provide isolation utilities
- Single worker mode (`--workers=1`) for debugging flaky tests

### Building
```bash
npm run build                  # Build both client & server for production
npm run build:client           # Client production build only
npm run build:server           # Server production build only
```

### Cleanup
```bash
npm run clean:test             # Remove test-results, playwright-report, .playwright-mcp
npm run clean:all              # Clean test artifacts + workspace clean
```

## Architecture Overview

### Coordinate System - CRITICAL
**Unified 1920×1080 coordinate space** across client, server, and physics:
- Game world: Fixed `GAME_CONFIG.FIELD_WIDTH` (1920) × `GAME_CONFIG.FIELD_HEIGHT` (1080)
- Client rendering: Dual camera system with letterboxing for non-16:9 aspect ratios
- Server physics: Uses same coordinate system for authoritative state
- All position values in game state are in this coordinate space

### Project Structure
```
socca2/
├── client/              # Phaser 3 game client (TypeScript + Vite)
│   ├── src/scenes/
│   │   ├── BaseGameScene.ts      # Shared game logic base class
│   │   ├── GameScene.ts          # Multiplayer scene (extends Base)
│   │   └── SinglePlayerScene.ts  # Single-player mode
│   ├── src/controls/             # Virtual joystick & action button
│   ├── src/network/              # NetworkManager for Colyseus
│   └── src/utils/                # CameraManager, FieldRenderer, BallRenderer
├── server/              # Colyseus multiplayer server
│   ├── src/rooms/MatchRoom.ts    # Game room with fixed timestep (60Hz)
│   └── src/schema/GameState.ts   # Authoritative state (@colyseus/schema)
├── shared/              # Shared types & constants
│   └── src/types.ts              # GAME_CONFIG constants & interfaces
└── tests/               # Playwright E2E tests (18 test files)
```

### Key Technical Patterns

#### 1. Fixed Timestep Physics (Server)
- **60Hz tick rate** with fixed 16.666ms timesteps (deterministic physics)
- Uses accumulator pattern to decouple render framerate from physics
- See `server/src/rooms/MatchRoom.ts` update() method
- Maximum 5 physics steps per frame to prevent spiral of death

#### 2. Client Prediction & Server Reconciliation
- Local player movement predicted immediately (0ms perceived lag)
- Server sends authoritative state at 60Hz
- Client reconciles prediction with server state using adaptive factors:
  - Base: 0.3 (smooth correction for small errors)
  - Moderate: 0.5 (errors >20px)
  - Strong: 0.8 (errors >50px, snap toward server)
- See `client/src/scenes/GameScene.ts` reconcileLocalPlayer()

#### 3. Dual Camera Architecture
- **Game Camera**: Fixed 1920×1080 bounds with dynamic viewport and letterboxing
- **UI Camera**: Full-screen coverage for controls (joystick, HUD)
- Letterboxing automatically handles non-16:9 aspect ratios
- Touch controls work in letterbox areas via uiCamera
- See `client/src/utils/CameraManager.ts`

#### 4. Ball Capture & Pressure System
Ball possession uses proximity-based capture with pressure mechanics:
- `POSSESSION_RADIUS: 70px` - Distance to claim ball
- `PRESSURE_RADIUS: 70px` - Distance opponents apply pressure
- `PRESSURE_BUILDUP_RATE: 2` - Pressure/second per opponent (~0.5s to steal)
- `PRESSURE_DECAY_RATE: 3` - Pressure decay when no opponents near
- **Lockout periods**:
  - `CAPTURE_LOCKOUT_MS: 300ms` - Can't lose possession after capturing
  - `LOSS_LOCKOUT_MS: 300ms` - Can't capture after losing possession
- See `claudedocs/BALL_CAPTURE_MECHANISM.md` for full details

#### 5. Shooting Mechanics
- Variable power based on action button hold time (0-1 second)
- `MIN_SHOOT_SPEED: 800 px/s` to `SHOOT_SPEED: 2000 px/s`
- Ball shoots in player's facing direction
- Requires possession to shoot (enforced server-side)
- See `claudedocs/SHOOTING_IMPLEMENTATION_RESULTS.md`

## Configuration Constants

All gameplay constants live in `shared/src/types.ts` under `GAME_CONFIG`:

```typescript
FIELD_WIDTH: 1920           // Unified coordinate system width
FIELD_HEIGHT: 1080          // Unified coordinate system height
PLAYER_SPEED: 450           // px/s movement speed
SHOOT_SPEED: 2000           // Max shoot velocity (full power)
MIN_SHOOT_SPEED: 800        // Min shoot velocity
POSSESSION_RADIUS: 70       // Ball capture distance
PRESSURE_RADIUS: 70         // Opponent pressure range
TICK_RATE: 30               // Server update frequency (Hz)
MATCH_DURATION: 120         // Match length (seconds)
```

## Testing Architecture

### Test Philosophy
- **Isolated rooms**: Each test/worker gets unique room to prevent interference
- **Parallel execution**: 2+ workers for speed, single worker for debugging
- **Server state verification**: Tests query server state, not just client rendering
- **Helper utilities**: `tests/helpers/room-utils.ts` for room isolation

### Test Organization
```
tests/
├── helpers/
│   └── room-utils.ts              # setupIsolatedTest, setupMultiClientTest
├── core-features-regression.spec.ts    # Core gameplay sanity checks
├── shooting-mechanics.spec.ts          # Shooting feature tests (7 tests)
├── ball-capture.spec.ts                # Possession mechanics tests
├── multiplayer-network-sync.spec.ts    # Network synchronization
├── lag-measurement.spec.ts             # Performance benchmarking
└── ... (13 more test files)
```

### Writing Tests
1. **Use isolated rooms** for parallel execution:
   ```typescript
   const roomId = await setupIsolatedTest(page, CLIENT_URL, testInfo.workerIndex)
   ```

2. **Query server state** via window.__gameControls:
   ```typescript
   const ballState = await page.evaluate(() => {
     const scene = (window as any).__gameControls?.scene
     return scene.networkManager.getState().ball
   })
   ```

3. **Use test API** for controls:
   ```typescript
   await page.evaluate(() => {
     const controls = (window as any).__gameControls
     controls.test.touchJoystick(150, 300)
     controls.test.dragJoystick(230, 300)
     controls.test.releaseJoystick()
   })
   ```

4. **Account for network latency**:
   - Wait 100-200ms after input for server round-trip
   - Wait 500ms for multiplayer synchronization

## Development Patterns

### Adding New Features
1. Define constants in `shared/src/types.ts` (GAME_CONFIG)
2. Implement server logic in `server/src/schema/GameState.ts` or `MatchRoom.ts`
3. Update client in `client/src/scenes/BaseGameScene.ts` or `GameScene.ts`
4. Write E2E tests in `tests/` using isolated room pattern
5. Document in `claudedocs/` if significant

### Debugging Multiplayer Issues
1. Check server logs: `npm run dev:server` shows physics/network events
2. Use Colyseus Monitor: http://localhost:3000/colyseus (active rooms, clients, state)
3. Use test API in browser console:
   ```javascript
   __gameControls.scene.networkManager.getState() // Current server state
   __gameControls.test.getState()                 // Control states
   ```
4. Run single-worker tests: `npx playwright test --workers=1` (isolates room issues)

### Performance Considerations
- Server runs at **60Hz fixed timestep** for deterministic physics
- Client prediction eliminates perceived input lag (55ms measured)
- Ball uses interpolation (lerp factor 0.3) for smooth rendering
- Remote players use interpolation (lerp factor 0.5) for smooth movement

## Common Gotchas

1. **Coordinate System**
   - Always use GAME_CONFIG.FIELD_WIDTH/HEIGHT for bounds
   - Don't hardcode pixel values; use shared constants
   - Client cameras automatically scale to fit coordinate space

2. **Fixed Timestep**
   - Server physics uses fixed 1/60s steps
   - Don't pass variable deltaTime to physics calculations
   - See `MatchRoom.ts` update() accumulator pattern

3. **Test Isolation**
   - ALWAYS use `setupIsolatedTest()` or `setupMultiClientTest()` helpers
   - Never hardcode room names; use worker index for uniqueness
   - Clean test artifacts before critical runs: `npm run clean:test`

4. **Client-Server State**
   - Server is **always authoritative**
   - Client prediction is for perceived responsiveness only
   - Server validates all actions (shooting, possession, goals)

5. **Ball Possession**
   - 300ms lockout periods prevent rapid possession changes
   - Pressure system creates realistic ball contests
   - Don't implement client-side possession logic; trust server

## Documentation References

### Main Documentation
- **ARCHITECTURE.md** - Detailed technical architecture
- **QUICKSTART.md** - Development guide
- **SPECIFICATION.md** - Complete product spec
- **TESTING.md** - Testing guide (multi-worker, time acceleration, test helpers)

### Implementation Details (claudedocs/)
- **BALL_CAPTURE_MECHANISM.md** - Possession system details
- **SHOOTING_IMPLEMENTATION_RESULTS.md** - Shooting mechanics
- **LAG_OPTIMIZATION_SUMMARY.md** - Performance optimization (85% lag reduction, 55ms achieved)
- **TEST_SUMMARY.md** - Latest test results

## Server URLs
- **Client**: http://localhost:5173
- **Server**: http://localhost:3000
- **Monitor**: http://localhost:3000/colyseus (room inspector)
- **Health**: http://localhost:3000/health (JSON status)
