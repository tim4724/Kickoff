# Testing Guide

## Quick start
```bash
# Auto-starts test servers on 3001/5174
npm run test:e2e                  # Auto-detect workers (cpus/2)
npm run test:e2e -- --workers=4   # Custom worker count

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
- Wait helpers: `tests/helpers/wait-utils.ts`, `tests/helpers/deterministic-wait-utils.ts`.
- Test utilities: `tests/helpers/test-utils.ts`, `tests/helpers/test-setup.ts`, `tests/helpers/test-constants.ts`.
- Touch testing: `tests/helpers/touch-test-utils.ts`.

## Determinism
- Authoritative server runs a fixed 30 Hz tick (`shared/src/types.ts:GAME_CONFIG`).
- Tests use isolated rooms per worker to avoid cross-talk.

## Folder map
```
tests/
├── helpers/        # room-utils, time-control, wait-utils, test-utils, etc.
├── config/         # Playwright project configuration
├── *.spec.ts       # All spec files (13 tests across 10 files)
├── fixtures.ts     # Custom test fixtures
├── global-setup.ts
└── global-teardown.ts
```
