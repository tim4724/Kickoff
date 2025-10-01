# 🚀 Socca2 Quick Start Guide

## ✅ Installation Complete!

Your project is ready to run. All dependencies have been installed.

## 🎮 Running the Game

### Option 1: Run Both Client + Server (Recommended)

```bash
npm run dev
```

This starts:
- **Client** at http://localhost:5173
- **Server** at http://localhost:3000

### Option 2: Run Separately

**Terminal 1 - Client:**
```bash
npm run dev:client
```

**Terminal 2 - Server:**
```bash
npm run dev:server
```

## 🎯 What You Can Do Right Now

### Single Player Test (Week 1 Milestone)

1. Open http://localhost:5173 in your browser
2. **Controls:**
   - **Arrow Keys** → Move player
   - **Space Bar** → Shoot/Pass ball
3. You'll see:
   - Green soccer field with goals
   - Blue player (you)
   - White ball in center
   - Score display (0-0)

### Test Features

✅ **Player Movement** - Arrow keys move blue rectangle
✅ **Ball Physics** - Ball bounces off walls with friction
✅ **Shooting** - Get close to ball, press Space to kick
✅ **Ball Magnetism** - Ball sticks to player when close
✅ **Field Boundaries** - Player and ball stay in bounds

## 🔧 Development Tools

### Colyseus Monitor (Server Dashboard)

http://localhost:3000/colyseus

View:
- Active rooms
- Connected clients
- Server statistics

### Health Check

http://localhost:3000/health

Returns server status JSON

## 📁 Project Structure

```
socca2/
├── client/              # Phaser game (Vite + TypeScript)
│   ├── src/
│   │   ├── main.ts             # Entry point
│   │   └── scenes/
│   │       └── GameScene.ts    # Main game scene
│   ├── index.html
│   └── package.json
│
├── server/              # Colyseus server
│   ├── src/
│   │   ├── index.ts            # Server entry
│   │   ├── rooms/
│   │   │   └── MatchRoom.ts    # Game room logic
│   │   └── schema/
│   │       └── GameState.ts    # Shared state
│   └── package.json
│
├── shared/              # Shared TypeScript types
│   └── src/
│       └── types.ts            # Game constants & types
│
└── package.json         # Root workspace config
```

## 🎨 Current Visual Design

**Field:**
- Green background (#2d5016)
- White boundary lines
- Center circle and line
- Goals on left/right sides

**Player:**
- Blue rectangle (30×40px)
- White border
- Yellow indicator dot above

**Ball:**
- White circle (20px diameter)
- Black shadow for depth

## 🐛 Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Fix:**
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev:server
```

### Client Can't Connect to Server

**Check:**
1. Is server running? (http://localhost:3000/health should respond)
2. CORS enabled? (Already configured in server)
3. Browser console errors? (Open DevTools → Console)

### TypeScript Errors

**Fix:**
```bash
# Rebuild shared types
cd shared && npm run build
```

## 📋 Next Steps (Week 1-2 Roadmap)

Current: **Day 1-4 Complete** ✅

**Remaining Week 1-2 Tasks:**

### Day 5-7: Virtual Joystick
- [ ] Add touch controls (virtual joystick)
- [ ] Position joystick in bottom-left
- [ ] Add action button in bottom-right
- [ ] Test on mobile device

### Day 8-10: Movement Polish
- [ ] Add player sprite animations (if assets ready)
- [ ] Smooth camera follow
- [ ] Optimize for 60 FPS

**Check:** [MVP_ROADMAP.md](MVP_ROADMAP.md) for complete timeline

## 🔥 Quick Commands Reference

```bash
# Development
npm run dev              # Run client + server
npm run dev:client       # Client only
npm run dev:server       # Server only

# Build
npm run build            # Build both
npm run build:client     # Build client only
npm run build:server     # Build server only

# Utilities
npx kill-port 3000       # Kill server port
npx kill-port 5173       # Kill client port
```

## 🎯 Success Indicators

You're on track if you can:

✅ Open client in browser (http://localhost:5173)
✅ See green field with goals
✅ Move blue player with arrow keys
✅ Kick ball with space bar
✅ Ball bounces off walls realistically
✅ Server runs without errors (check terminal)

## 📖 Documentation

- [SPECIFICATION.md](SPECIFICATION.md) - Full product spec
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
- [MVP_ROADMAP.md](MVP_ROADMAP.md) - Development plan

## 🚀 Ready to Code!

You've completed **Week 1 Days 1-4**!

**Next milestone:** Virtual joystick for mobile (Days 5-7)

Start coding! 🎮⚽
