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
├── server/          # Colyseus multiplayer server (Node.js)
├── tests/           # Playwright E2E tests
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
- [TEST_SUMMARY.md](TEST_SUMMARY.md) - Latest test results
- [claudedocs/LAG_OPTIMIZATION_SUMMARY.md](claudedocs/LAG_OPTIMIZATION_SUMMARY.md) - Input lag optimization (85% reduction achieved)

### Archive
- Historical sprint reports and analysis: `claudedocs/archive/`

## Current Status

### ✅ Completed (Weeks 1-6)

**Core Multiplayer:**
- Client-server architecture with Colyseus
- Real-time position synchronization (<20px delta)
- Two-player matchmaking with team assignment
- Professional-grade input responsiveness (55ms lag)

**Player Controls:**
- Virtual joystick with dynamic spawning
- Action button with power-based mechanics
- Touch controls for mobile devices
- Responsive movement with client prediction

**Game Physics:**
- Ball physics and movement
- Player-ball interactions
- Field boundaries and collision
- Unified 1920x1080 coordinate system across client/server

**Rendering System:**
- Dual camera architecture (game + UI)
- Responsive fullscreen with letterboxing
- Touch controls work in letterbox areas
- Tested on 5 viewport sizes (16:9, ultrawide, portrait, landscape)

**Testing:**
- 20 passing E2E tests (Playwright)
- Automated lag measurement
- Position synchronization validation

### 🚧 Next Up (Week 7+)

**Priority Features:**
- Ball possession mechanics (magnetism + indicators)
- Ball kicking system
- Goal detection and scoring
- Match timer and victory conditions

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
**Test Coverage:** 20 E2E tests covering core multiplayer functionality

## License

Private project - All rights reserved
