# Kickoff ⚽

Fast-paced 3v3 arcade soccer for mobile web (1 human + 2 AI bots per team) with authoritative Colyseus server, client prediction, and Playwright-covered E2E tests.

## Quick Start

```bash
# Install dependencies (root)
npm install

# Run client + server + shared watch
npm run dev

# Client: http://localhost:5173
# Server: http://localhost:3000
```

## Development Commands

```bash
# Development
npm run dev              # Client + server + shared watch
npm run dev:client       # Client only (5173)
npm run dev:server       # Server only (3000)
npm run dev:shared       # Shared types/watch

# Testing (Playwright spins up its own test servers on 3001/5174)
npm run test:e2e                      # All E2E (8 workers)
npm run test:e2e -- --workers=8       # Custom worker count
npm run test:e2e:ui                   # Playwright UI
npm run test:e2e:headed               # Headed browser
npm run test:e2e:debug                # Debug mode
npm run clean:test                    # Remove test artifacts
npm run test:e2e:report               # Open HTML report

# Build
npm run build           # Build client + server
npm run build:client    # Client only
npm run build:server    # Server only
```

## Project Structure

```
Kickoff/
├── client/          # PixiJS game client (TypeScript + Vite)
│   └── src/ai/      # AI system for bot players (3v3 gameplay)
├── server/          # Colyseus multiplayer server (Node.js)
├── shared/          # Shared engine + GAME_CONFIG constants
└── tests/           # Playwright E2E tests (13 tests)
```

## Current Status

- Authoritative server with 30 Hz tick, unified 1700×1000 coordinates
- Client prediction + reconciliation; ~55 ms measured input lag
- Ball capture with pressure + lockouts; variable-power shooting
- 3v3 gameplay with hierarchical AI (AIManager → TeamAI → AIPlayer)
- Dual-camera rendering (game + UI), letterboxing for non-16:9
- Playwright suite: 13 tests, auto-starts dedicated test servers, 10× time acceleration

## Near-Term Focus
- Match flow polish (timer/UI/end screen).
- AI tuning and balance adjustments.
- Reduce flaky/failing cases if any regressions appear; keep tests green.

## Documentation

- [AGENTS.md](AGENTS.md) — agent guidance: snapshot, gotchas, key constants
- [CLAUDE.md](CLAUDE.md) — symlink → AGENTS.md
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design + gameplay mechanics
- [TESTING.md](TESTING.md) — test commands, ports, helpers, folder map
- [DOCKER.md](DOCKER.md) — Docker deployment
- [client/src/ai/AI_STRUCTURE.md](client/src/ai/AI_STRUCTURE.md) — AI deep dive

## Performance Snapshot

- Input lag: ~55 ms (target <100 ms)
- Test coverage: 13 E2E tests; 8 workers with 10× time acceleration

## License

Private project - All rights reserved
