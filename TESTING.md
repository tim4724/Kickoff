# Testing Guide (concise)

## Quick start
```bash
# Auto-starts test servers on 3001/5174
npm run test:e2e                  # Default 4 workers
npm run test:e2e -- --workers=8   # More workers

# Suite subsets
npm run test:stable
npm run test:physics

# Interactive/debug
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug

# Utilities
npm run clean:test
npm run test:e2e:report
```

## Servers & ports
- Dev: client `5173`, server `3000`.
- Tests: client `5174`, server `3001` (Playwright `webServer` handles startup/teardown).
- `client/src/scenes/MultiplayerScene.ts` selects the server port (using `VITE_SERVER_PORT` or defaults).

## Time control & helpers
- 10× time acceleration is enabled in tests; use `waitScaled()` utilities instead of raw `waitForTimeout()`.
- Isolation helpers: `setupIsolatedTest` / `setupMultiClientTest` in `tests/helpers/room-utils.ts`.
- Time helpers: `tests/helpers/time-control.ts`.

## Determinism
- Authoritative server runs a fixed 30 Hz tick (`shared/src/types.ts:GAME_CONFIG`).
- Tests use isolated rooms per worker to avoid cross-talk.

## Folder map
```
tests/
├── helpers/        # time-control, room-utils, game-state, wait-utils
├── stable-tests/   # Core/always-green suites
└── physics-tests/  # Mechanics-focused suites
```
