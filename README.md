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

- [SPECIFICATION.md](SPECIFICATION.md) - Complete product specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture details
- [MVP_ROADMAP.md](MVP_ROADMAP.md) - Week-by-week development plan

## Current Status

🚧 **Week 1-2: Foundation** - In Progress

- [x] Project scaffolding
- [ ] Basic rendering (field + player)
- [ ] Virtual joystick controls
- [ ] Single player movement

## License

Private project - All rights reserved
