# Socca2 ⚽

Fast-paced multiplayer arcade soccer game for mobile web.

## Quick Start

```bash
# Install dependencies
npm install

# Run development servers (client + server)
npm run dev

# Client: http://localhost:5173
# Server: http://localhost:3000
```

## Project Structure

```
socca2/
├── client/          # Phaser 3 game client (TypeScript + Vite)
│   └── src/ai/      # AI system for bot players (3v3 gameplay)
├── server/          # Colyseus multiplayer server (Node.js)
├── shared/          # Shared game engine and physics
│   └── src/engine/  # GameEngine, PhysicsEngine, GameClock
├── tests/           # Playwright E2E tests (79-80 tests)
└── claudedocs/      # Technical documentation and analysis
```

## Tech Stack

- **Client:** Phaser 3, TypeScript, Vite
- **Server:** Colyseus, Node.js, TypeScript
- **Testing:** Playwright E2E tests
- **Deployment:** PWA (Progressive Web App)

## Documentation

### Essential Reading
- [SPECIFICATION.md](SPECIFICATION.md) - Complete product specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture details
- [QUICKSTART.md](QUICKSTART.md) - Development guide and commands
- [MVP_ROADMAP.md](MVP_ROADMAP.md) - Development roadmap and progress

### Recent Work
- [claudedocs/TEST_SUMMARY.md](claudedocs/TEST_SUMMARY.md) - Latest test results (79-80 tests, 98-100% pass rate)
- [claudedocs/TEST_IMPROVEMENT_FINAL_SUMMARY.md](claudedocs/TEST_IMPROVEMENT_FINAL_SUMMARY.md) - GameClock integration and 10x time acceleration
- [claudedocs/LAG_OPTIMIZATION_SUMMARY.md](claudedocs/LAG_OPTIMIZATION_SUMMARY.md) - Input lag optimization (85% reduction achieved)
- [client/src/ai/AI_STRUCTURE.md](client/src/ai/AI_STRUCTURE.md) - AI system architecture

### Archive
- Historical sprint reports and analysis: `claudedocs/archive/`

## Current Status

### ✅ Completed (Weeks 1-7)

**Core Multiplayer:**
- Client-server architecture with Colyseus
- Real-time position synchronization (<20px delta)
- 3v3 gameplay (1 human + 2 AI bots per team)
- Professional-grade input responsiveness (55ms lag)

**Player Controls:**
- Virtual joystick with dynamic spawning
- Action button with power-based mechanics
- Touch controls for mobile devices
- Responsive movement with client prediction

**Game Physics:**
- Ball physics and movement with pressure system
- Ball possession with capture/release mechanics
- Shooting with variable power (0-1 second hold)
- Goal detection and scoring
- Field boundaries and collision
- Unified 1920x1080 coordinate system across client/server

**AI System (3v3 Gameplay):**
- Hierarchical AI architecture (AIManager → TeamAI → AIPlayer)
- Strategy-based behavior (Offensive, Defensive, HasBall, SpreadPosition)
- Smart utilities (InterceptionCalculator, PassEvaluator)
- AI-only testing mode (AIOnlyScene for 6v6 bot matches)
- Comprehensive AI test suite (13 tests)

**Rendering System:**
- Dual camera architecture (game + UI)
- Responsive fullscreen with letterboxing
- Touch controls work in letterbox areas
- Tested on 5 viewport sizes (16:9, ultrawide, portrait, landscape)

**Testing:**
- 79-80 passing E2E tests (Playwright)
- 98-100% pass rate with 4 parallel workers
- GameClock-based 10x time acceleration (87.5% faster tests)
- Test suite runs in ~2.5 minutes (down from 20 minutes)
- Automated lag measurement
- Position synchronization validation

### 🚧 Next Up (Week 8+)

**Priority Features:**
- Match timer and victory conditions
- Game over screen improvements
- AI tuning and balancing

See [MVP_ROADMAP.md](MVP_ROADMAP.md) for detailed development plan.

## Development Commands

```bash
# Development
npm run dev              # Both client + server
npm run dev:client       # Client only (port 5173)
npm run dev:server       # Server only (port 3000)

# Testing (test servers auto-start on ports 3001/5174)
npm run test:e2e                      # Run all E2E tests (4 workers)
npm run test:e2e:ui                   # Interactive test UI
npm run test:e2e:headed               # See browser during tests
npm run test:e2e:debug                # Debug mode with breakpoints
npm run test:physics                  # Physics-only tests
npm run test:stable                   # Stable tests only
npm run clean:test                    # Remove test artifacts
npm run test:e2e:report               # View HTML report

# Building
npm run build           # Build for production
```

## Performance

**Input Lag:** 55ms average (professional-grade, <100ms threshold)
**Network RTT:** <2ms (local network)
**Test Coverage:** 79-80 E2E tests covering core multiplayer functionality
**Test Speed:** ~2.5 minutes with 10x time acceleration (87.5% faster than real-time)

## License

Private project - All rights reserved
