# 🚀 Kickoff Quick Start

Fast-paced 3v3 arcade soccer (1 human + 2 AI bots per team) with unified 1700×1000 coordinates and authoritative Colyseus server.

## Run the Game

```bash
npm run dev
```

This starts:
- **Client** → http://localhost:5173
- **Server** → http://localhost:3000

## Play

- **Desktop:** Keyboard movement + space/action (or use the on-screen controls)
- **Mobile:** Virtual joystick (left) + action button (right, hold for power)

## Features

- Real-time multiplayer with client prediction + server reconciliation
- Ball capture system with pressure/lockouts and variable-power shooting
- Dual-camera rendering (game + UI) with letterboxing for non-16:9 screens
- 3v3 teams with hierarchical AI and auto cursor switching to nearest player

## Architecture

Kickoff/
├── client/          # PixiJS v8 + TypeScript + Vite
│   ├── src/scenes/  # MultiplayerScene, SinglePlayerScene, BaseGameScene
│   └── src/controls/# Virtual joystick & action button
├── server/          # Colyseus multiplayer server
│   ├── src/rooms/MatchRoom.ts
│   └── src/schema/GameState.ts
├── shared/          # Shared types + GAME_CONFIG constants
└── tests/           # Playwright E2E tests (auto-start servers)
```

## Testing

```bash
npm run test:e2e           # All E2E (spins up test servers on 3001/5174)
npm run test:e2e:ui        # Playwright UI
npm run clean:test         # Clean test artifacts
```

**Coverage highlights:**
- Core gameplay regression (movement, shooting, scoring)
- Multiplayer sync and ball possession mechanics
- AI gameplay flow and physics-only suites

## Development Tools

- **Server Monitor:** http://localhost:3000/colyseus
- **Health Check:** http://localhost:3000/health

## Key Game Constants (`shared/src/types.ts`)

- `FIELD_WIDTH: 1700`, `FIELD_HEIGHT: 1000`
- `PLAYER_SPEED: 284`
- `SHOOT_SPEED: 1440`, `MIN_SHOOT_SPEED: 720`
- `POSSESSION_RADIUS: 45`, `PRESSURE_RADIUS: 45`
- `CAPTURE_LOCKOUT_MS: 300`, `LOSS_LOCKOUT_MS: 300`
- `TICK_RATE: 30`, `MATCH_DURATION: 120`

## Troubleshooting

- **Port in use:** `npx kill-port 3000` (server), `npx kill-port 5173` (client)
- **Connection issues:** Check `/health`, ensure both services running, inspect browser console
- **TypeScript errors:** `cd shared && npm run build`

## Docs

- `AGENTS.md` — working notes/commands
- `README.md`, `MVP_ROADMAP.md` — additional overview and roadmap
- `tests/*.spec.ts` — test definitions and helpers
