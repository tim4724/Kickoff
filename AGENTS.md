# AGENTS.md

Guidance for coding agents working on Kickoff (replaces CLAUDE.md). Keep it current; prefer this over legacy docs when instructions conflict.

## Snapshot
- Fast-paced 3v3 arcade soccer (1 human + 2 AI bots per team) for mobile web.
- Authoritative Colyseus server, client prediction + reconciliation.
- Unified 1920×1080 coordinate system; GAME_CONFIG lives in `shared/src/types.ts`.
- Tick rate: 30 Hz server; measured input lag ~55 ms.
- Playwright E2E suite (40 tests) with auto-started test servers.

## Core Commands
### Development
```bash
npm run dev          # Client + server + shared watch (5173/3000)
npm run dev:client   # Client only
npm run dev:server   # Server only
npm run dev:shared   # Shared types/watch
```

### Testing (Playwright starts its own servers on 3001/5174)
```bash
npm run test:e2e                      # All E2E (4 workers default)
npm run test:e2e -- --workers=8       # Custom workers
npm run test:e2e:ui                   # Playwright UI
npm run test:e2e:headed               # Headed browser
npm run test:e2e:debug                # Debug mode
npm run test:physics                  # Physics-only tests
npm run test:stable                   # Stable tests only
npm run clean:test                    # Remove artifacts
npm run test:e2e:report               # Open HTML report
```

### Build
```bash
npm run build
npm run build:client
npm run build:server
```

## Architecture Quick Notes
- Client: PixiJS v8 + Vite; dual-layer (game + UI) with letterboxing for non-16:9.
- Server: Colyseus authoritative room; fixed-timestep physics @ 30 Hz.
- AI: Hierarchical (AIManager → TeamAI → AIPlayer); 3v3 team composition enforced.
- Testing: Playwright uses isolated rooms and auto-start servers; ports 3001/5174 are reserved for tests, 3000/5173 for dev.

## Key Gameplay Constants (`shared/src/types.ts`)
- `FIELD_WIDTH: 1920`, `FIELD_HEIGHT: 1080`
- `PLAYER_SPEED: 284`
- `SHOOT_SPEED: 1440`, `MIN_SHOOT_SPEED: 720`
- `POSSESSION_RADIUS: 45`, `PRESSURE_RADIUS: 45`
- `CAPTURE_LOCKOUT_MS: 300`, `LOSS_LOCKOUT_MS: 300`
- `TICK_RATE: 30`, `MATCH_DURATION: 120`

## Project Structure (top-level)
```
client/    # PixiJS client (TypeScript + Vite)
server/    # Colyseus server
shared/    # Shared engine + GAME_CONFIG constants
tests/     # Playwright E2E suite
```

## Gotchas
- Always use GAME_CONFIG for field/physics values; avoid hardcoding pixels.
- Respect port separation: dev (3000/5173) vs tests (3001/5174).
- Use `waitScaled()` helpers in tests (time acceleration); avoid raw `waitForTimeout`.
- Server is authoritative for possession/shooting; client prediction is for UX only.
- Keep auto-start test servers in mind—no need to run dev servers before `npm run test:e2e`.

## Documentation Pointers
- Latest working overview: `README.md`, `QUICKSTART.md`, `MVP_ROADMAP.md`.
- Deep dive: `client/src/ai/AI_STRUCTURE.md`.
- Legacy/high-level: `ARCHITECTURE.md`, `SPECIFICATION.md` (historical; defer to this file for current state).
