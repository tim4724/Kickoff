# Socca2 ⚽

Fast-paced multiplayer arcade soccer game for mobile web.

## Project Structure

```
socca2/
├── client/          # Phaser 3 game client
├── server/          # Colyseus multiplayer server
├── shared/          # Shared TypeScript types
└── docs/            # Specifications and documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install all dependencies (root + workspaces)
npm install

# Run development servers (client + server concurrently)
npm run dev
```

### Development

```bash
# Client only (http://localhost:5173)
npm run dev:client

# Server only (http://localhost:3000)
npm run dev:server

# Both concurrently
npm run dev
```

## Tech Stack

- **Client:** Phaser 3, TypeScript, Vite
- **Server:** Colyseus, Node.js, TypeScript
- **Deployment:** PWA (Progressive Web App)

## Documentation

### Core Documentation
- [SPECIFICATION.md](SPECIFICATION.md) - Complete product specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture details
- [MVP_ROADMAP.md](MVP_ROADMAP.md) - Week-by-week development plan
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide

### Mobile Controls
- [MOBILE_CONTROLS.md](MOBILE_CONTROLS.md) - Touch controls implementation guide
- [TOUCH_TESTING_API.md](TOUCH_TESTING_API.md) - Testing API reference
- [TOUCH_CONTROLS_WORKFLOW.md](TOUCH_CONTROLS_WORKFLOW.md) - Implementation workflow

### Testing & Progress
- [WEEK1-2_SUMMARY.md](WEEK1-2_SUMMARY.md) - Week 1-2 implementation summary
- [DESKTOP_TEST_REPORT.md](DESKTOP_TEST_REPORT.md) - Desktop testing checklist
- [MANUAL_TEST_GUIDE.md](MANUAL_TEST_GUIDE.md) - Manual testing procedures

## Current Status

✅ **Week 1-2: Foundation** - Complete!

- [x] Project scaffolding
- [x] Basic rendering (field + player + ball)
- [x] Virtual joystick controls (dynamic spawning)
- [x] Action button (power-based shooting)
- [x] Single player movement
- [x] Zone-based control separation
- [x] Automated testing API (14/14 tests passing)

## License

Private project - All rights reserved
