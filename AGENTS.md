# AGENTS.md

Guidance for coding agents working on Kickoff. Keep it current; prefer this over legacy docs when instructions conflict.

## Snapshot
- Fast-paced 3v3 arcade soccer (1 human + 2 AI bots per team) for mobile web.
- Authoritative Colyseus server, client prediction + reconciliation.
- Unified 1700×1000 coordinate system; GAME_CONFIG lives in `shared/src/types.ts`.
- Tick rate: 30 Hz server; measured input lag ~55 ms.
- Playwright E2E suite (13 tests) with auto-started test servers.

## Architecture Quick Notes
- Client: PixiJS v8 + Vite; dual-layer (game + UI) with letterboxing for non-16:9.
- Server: Colyseus authoritative room; fixed-timestep physics @ 30 Hz.
- AI: Hierarchical (AIManager → TeamAI → AIPlayer); 3v3 team composition enforced.
- Testing: Playwright uses isolated rooms and auto-start servers; ports 3001/5174 are reserved for tests, 3000/5173 for dev.

## Key Gameplay Constants (`shared/src/types.ts`)
- `FIELD_WIDTH: 1700`, `FIELD_HEIGHT: 1000`
- `PLAYER_SPEED: 350`
- `SHOOT_SPEED: 1440`
- `CHALLENGE_RADIUS: 70`
- `MATCH_DURATION: 120`

## Gotchas
- Always use GAME_CONFIG for field/physics values; avoid hardcoding pixels.
- Respect port separation: dev (3000/5173) vs tests (3001/5174).
- In tests, use `page.waitForFunction()` for conditions; `waitForFrames()` only for small settle delays (1-5 frames). Never use `waitForTimeout`.
- Server is authoritative for possession/shooting; client prediction is for UX only.
- Keep auto-start test servers in mind—no need to run dev servers before `npm run test:e2e`.
