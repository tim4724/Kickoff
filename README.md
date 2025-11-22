# Socca2 ⚽

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
npm run test:e2e                      # All E2E (4 workers)
npm run test:e2e -- --workers=8       # Custom worker count
npm run test:e2e:ui                   # Playwright UI
npm run test:e2e:headed               # Headed browser
npm run test:e2e:debug                # Debug mode
npm run test:physics                  # Physics-only tests
npm run test:stable                   # Stable tests only
npm run clean:test                    # Remove test artifacts
npm run test:e2e:report               # Open HTML report

# Build
npm run build           # Build client + server
npm run build:client    # Client only
npm run build:server    # Server only
```

## Project Structure

```
socca2/
├── client/          # Phaser 3 game client (TypeScript + Vite)
│   └── src/ai/      # AI system for bot players (3v3 gameplay)
├── server/          # Colyseus multiplayer server (Node.js)
├── shared/          # Shared engine + GAME_CONFIG constants
├── tests/           # Playwright E2E tests (79-80 tests)
└── claudedocs/      # Technical documentation and analysis
```

## Current Status

- Authoritative server with 30 Hz tick, unified 1920×1080 coordinates
- Client prediction + reconciliation; ~55 ms measured input lag
- Ball capture with pressure + lockouts; variable-power shooting
- 3v3 gameplay with hierarchical AI (AIManager → TeamAI → AIPlayer)
- Dual-camera rendering (game + UI), letterboxing for non-16:9
- Playwright suite: 79-80 tests, auto-starts dedicated test servers, 10× time acceleration

## Documentation

- [CLAUDE.md](CLAUDE.md) — up-to-date working notes and quick commands
- [QUICKSTART.md](QUICKSTART.md) — player/dev quickstart
- [ARCHITECTURE.md](ARCHITECTURE.md) — high-level system design (some legacy notes)
- [SPECIFICATION.md](SPECIFICATION.md) — product spec (contains historical scope; see CLAUDE.md for current state)
- [MVP_ROADMAP.md](MVP_ROADMAP.md) — roadmap
- Key deep dives: [claudedocs/BALL_CAPTURE_MECHANISM.md](claudedocs/BALL_CAPTURE_MECHANISM.md), [claudedocs/SHOOTING_IMPLEMENTATION_RESULTS.md](claudedocs/SHOOTING_IMPLEMENTATION_RESULTS.md), [client/src/ai/AI_STRUCTURE.md](client/src/ai/AI_STRUCTURE.md)

## Performance Snapshot

- Input lag: ~55 ms (target <100 ms)
- Test coverage: 79-80 E2E tests; ~2.5 min suite with 4 workers and 10× time acceleration

## License

Private project - All rights reserved
