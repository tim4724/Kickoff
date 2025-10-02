# 🚀 Kickoff Quick Start

Fast-paced multiplayer arcade soccer game with real-time physics and pressure-based possession mechanics.

## Getting Started

### Run the Game

```bash
npm run dev
```

This starts:
- **Client** → http://localhost:5173
- **Server** → http://localhost:3000

### Play

**Desktop:**
- Arrow Keys → Move
- Space → Shoot/Pass

**Mobile:**
- Left joystick → Move
- Right button → Shoot/Pass (hold for power)

## Features

✅ **Multiplayer** - Real-time 2v2 matches via Colyseus
✅ **Ball Physics** - Realistic friction, bouncing, momentum
✅ **Smart Possession** - Proximity-based with pressure dynamics
✅ **Shooting** - Variable power, direction control
✅ **Mobile Controls** - Touch joystick + action button
✅ **Goal Scoring** - Match timer, celebrations, reset

## Architecture

```
kickoff/
├── client/          # Phaser 3.80 + TypeScript + Vite
│   ├── src/scenes/GameScene.ts     # Main game logic
│   └── src/controls/               # Virtual joystick & button
├── server/          # Colyseus 0.16 multiplayer server
│   ├── src/rooms/MatchRoom.ts      # Game room logic
│   └── src/schema/GameState.ts     # Authoritative state
├── shared/          # Shared types & constants
└── tests/           # Playwright E2E tests
```

## Testing

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run with Playwright UI
npm run clean:test         # Clean test artifacts
```

**Test Coverage:**
- Core gameplay regression (movement, shooting, scoring)
- Multiplayer synchronization (position, ball state)
- Ball possession mechanics (capture, pressure, release)
- Client-server speed matching
- Shooting mechanics (direction, power, multiplayer sync)

## Development Tools

### Server Monitor
http://localhost:3000/colyseus
- Active rooms, connected clients, server stats

### Health Check
http://localhost:3000/health
- Server status JSON

## Configuration

### Game Constants
`shared/src/types.ts` - Physics, field dimensions, gameplay tuning

**Key Parameters:**
- `PLAYER_SPEED: 250` - Movement speed (px/s)
- `SHOOT_SPEED: 400` - Ball shot velocity (px/s)
- `POSSESSION_RADIUS: 50` - Capture distance (px)
- `PRESSURE_RADIUS: 120` - Contesting range (px)
- `BALL_FRICTION: 0.98` - Ball slowdown per frame

## Troubleshooting

**Port in use:**
```bash
npx kill-port 3000    # Server
npx kill-port 5173    # Client
```

**Connection issues:**
- Check http://localhost:3000/health
- Verify both client & server running
- Check browser console for errors

**TypeScript errors:**
```bash
cd shared && npm run build
```

## Project Documentation

- `claudedocs/BALL_CAPTURE_MECHANISM.md` - Possession system details
- `claudedocs/SHOOTING_IMPLEMENTATION_RESULTS.md` - Shooting mechanics
- `claudedocs/INPUT_LAG_OPTIMIZATION_WORKFLOW.md` - Performance work
- `tests/*.spec.ts` - Test specifications

## Quick Commands

```bash
# Development
npm run dev               # Run all (client + server + shared watch)
npm run dev:client        # Client only
npm run dev:server        # Server only
npm run dev:shared        # Shared types watch mode

# Build
npm run build             # Build both client & server
npm run build:client      # Client production build
npm run build:server      # Server production build

# Testing
npm run test:e2e          # Run E2E tests
npm run test:e2e:ui       # Playwright UI mode
npm run clean:test        # Remove test artifacts
```
