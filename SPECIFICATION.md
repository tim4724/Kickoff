# Socca2 - Arcade Soccer Game
## Technical Specification v1.0

**Project Type:** Fast-paced multiplayer arcade soccer for mobile web
**Strategy:** Agile MVP → Iterative enhancement
**Timeline:** 3-4 months to production-ready MVP

---

## 🎯 Core Vision

**Elevator Pitch:** Fast-paced 5v5 arcade soccer where you control the player nearest to the ball, competing against another human player in 2-4 minute matches. Think "FIFA Street meets mobile web gaming."

**Key Differentiators:**
- Real-time 1v1 multiplayer (each controlling 5-player teams)
- Cursor-switching control (auto-switch to nearest player to ball)
- Arcade physics (no simulation complexity)
- Mobile-first web deployment (PWA)
- 2-4 minute match duration (perfect for mobile sessions)

---

## 🎮 Gameplay Mechanics

### Control Scheme
**Input System:**
- **Virtual Joystick** (left thumb): Movement control
- **Action Button** (right thumb): Context-sensitive pass/shoot
  - Near goal → shoot
  - Away from goal → pass to nearest teammate
  - Hold duration → power modifier

**Player Switching:**
- **Automatic cursor switching** to player closest to ball
- Visual indicator shows controlled player (highlight/arrow)
- Smooth transitions between players during play
- Ball possession = control locked to that player

### Match Structure
- **Format:** 1 human + 4 AI bots vs 1 human + 4 AI bots
- **Duration:** 2-4 minutes per match
- **Camera:** Top-down orthographic view
- **Field:** Simplified soccer pitch (single screen or scrolling TBD)
- **Scoring:** Traditional goals, tiebreaker by sudden death or penalties

### AI Teammate Behavior
**Critical Success Factor:** AI must feel competent, not frustrating

**AI Responsibilities:**
- **Positioning:** Formation-based (4-4-2 or 4-3-3 simple formations)
- **Movement:** Run to open space, track opposing players
- **Actions:** Automatic pass reception, basic interceptions
- **Difficulty:** Adaptive - mirror opponent AI skill to maintain balance

**AI System Architecture:**
- Rule-based state machine (not ML for MVP)
- States: Attacking, Defending, Supporting, Chasing ball
- Pathfinding: Simple waypoint navigation (A* if needed, likely simpler)

### Ball Mechanics
**Arcade Physics Approach:**
- Ball "magnetism" to players when close (forgiving arcade feel)
- Simplified trajectories (linear interpolation with arc modifier)
- Pass speed: Fixed or distance-based
- Shot power: Button hold duration (0.1s - 1.5s charge)
- No spin, curve, or advanced physics

**Possession Rules:**
- Ball sticks to player slightly (arcade style)
- Tackles = proximity-based (touch opponent with ball → contest)
- Loose ball = both teams can claim (closest player wins)

---

## 🏗️ Technical Architecture

### Frontend Stack

**Rendering Engine:** [Phaser 3](https://phaser.io/)
- **Why:** Best-in-class 2D web game framework
- Mature, well-documented, active community
- WebGL + Canvas fallback for compatibility
- Built-in sprite management, animations, input handling
- Mobile-optimized touch controls
- Free and MIT licensed

**Graphics Approach:** 2D sprite-based (Phase 1)
- Top-down player sprites (4-8 directional animations)
- Simple ball sprite with shadow
- Field background (single image or tiled)
- UI overlays (score, timer, controls)
- **Art style:** Low-poly flat design or pixel art (asset-friendly)

**3D Alternative (Phase 2+):** Three.js or Babylon.js
- Simple 3D models (low-poly characters)
- Top-down camera maintained
- Higher fidelity but slower development

**Client Framework:** TypeScript + Vite
- Modern build tooling for fast iteration
- Type safety for multiplayer state management
- Hot module replacement for development

### Backend Stack

**Multiplayer Server:** [Colyseus](https://colyseus.io/)
- **Why:** Purpose-built for real-time web multiplayer games
- Room-based architecture (perfect for matches)
- State synchronization built-in (delta compression)
- WebSocket transport with fallback support
- TypeScript support (shared types with frontend)
- Automatic matchmaking capabilities
- Free and MIT licensed

**Alternative:** Custom Node.js + Socket.IO
- More flexible but requires building state sync from scratch
- **Recommendation:** Use Colyseus - faster MVP delivery

**Server Features Needed:**
- Match rooms (10-player capacity per room)
- Game state authority (validate all actions server-side)
- Client-side prediction reconciliation
- Player authentication (JWT tokens)
- Matchmaking queue (simple pairing system)

**Database:** PostgreSQL + Prisma ORM
- User accounts (username, password hash, stats)
- Match history (optional for MVP)
- Leaderboards (wins, goals, rankings)
- Can use Supabase for managed Postgres + auth

**Hosting Options:**

| Service | Use Case | Cost (Est) |
|---------|----------|-----------|
| **Railway/Render** | MVP/Testing | $20-50/mo |
| **AWS/GCP** | Production scaling | $50-200/mo |
| **Hathora/Edgegap** | Optimized game hosting | $100-300/mo |

**MVP Recommendation:** Railway or Render for simplicity

### Network Architecture

**Communication Protocol:** WebSocket (via Colyseus)
- Binary state snapshots for efficiency
- Target tick rate: 20-30 updates/second
- Client prediction for local player movement
- Server reconciliation for authoritative state

**State Synchronization Strategy:**

```
Client Input → Server Validates → Broadcast State → Client Interpolates
     ↓              ↓                    ↓                  ↓
  Predict      Simulate Game        Delta Update      Smooth Render
```

**Data Flow (per frame):**
1. **Client → Server:** Player input (joystick vector, button state)
2. **Server → Clients:** Game state snapshot (10 player positions, ball state, score)
3. **Client Processing:** Interpolate between snapshots for smooth visuals
4. **Prediction:** Client immediately moves local player, waits for server confirmation

**Latency Handling:**
- Client-side prediction (no input lag for local player)
- Lag compensation (server rewinds time for hit detection)
- Interpolation buffer (100-150ms of state history)
- Visual smoothing (lerp between positions)

**Network Performance Targets:**
- Latency: <100ms playable, <50ms ideal
- Bandwidth: ~5-10 KB/s per client (compressed state)
- Packet loss: Handle up to 5% gracefully

---

## 📱 Mobile Deployment

### Progressive Web App (PWA)

**Why PWA for MVP:**
- No app store approval delays
- Instant updates without resubmission
- Cross-platform (iOS/Android) from single codebase
- Users can "install" to home screen
- Service workers for offline-capable assets

**Mobile Optimizations:**
- Touch-optimized virtual joystick (thumb-friendly zones)
- Responsive layout (portrait or landscape support)
- Battery optimization (throttle rendering when inactive)
- Reduced asset sizes (sprite atlases, compressed textures)
- Adaptive quality settings (detect device performance)

**PWA Requirements:**
- HTTPS hosting (required for service workers)
- Web manifest file (icon, name, theme)
- Service worker for caching
- Responsive viewport meta tags

**Post-MVP Path:** Capacitor wrapper
- If app store presence needed, wrap PWA in native container
- Access native APIs (haptics, notifications)
- Minimal code changes required

---

## 🛠️ Development Roadmap

### Phase 1: Core Multiplayer MVP (8-10 weeks)

**Week 1-2: Foundation**
- ✓ Project setup (Vite + TypeScript + Phaser)
- ✓ Basic Colyseus server with room creation
- ✓ Simple field rendering (top-down view)
- ✓ Single player movement (virtual joystick)

**Week 3-4: Local Gameplay**
- ✓ Ball physics (simplified arcade logic)
- ✓ Pass/shoot mechanics (button implementation)
- ✓ Basic AI player (single bot for testing)
- ✓ Goal detection and scoring

**Week 5-6: Multiplayer Foundation**
- ✓ Client-server state synchronization
- ✓ Two-player networking (1v1 with no bots)
- ✓ Client-side prediction + reconciliation
- ✓ Latency testing and optimization

**Week 7-8: AI Teammates**
- ✓ 4 AI bots per team (5v5 complete)
- ✓ Basic AI positioning and movement
- ✓ Player cursor switching logic (auto-switch to nearest)
- ✓ AI pass/shoot decision-making

**Week 9-10: Polish & Testing**
- ✓ Matchmaking system (simple queue)
- ✓ Match timer and end-game flow
- ✓ Mobile touch optimization
- ✓ PWA setup (manifest, service worker)
- ✓ Playtesting and bug fixes

**Deliverable:** Playable 5v5 multiplayer game on mobile web

### Phase 2: Enhancement (4-6 weeks)

**Features:**
- User accounts and authentication
- Match statistics and leaderboards
- Visual polish (animations, particle effects)
- Sound effects and music
- Power-ups or special moves (optional)
- Better AI behavior tuning
- Performance optimization

**Stretch Goals:**
- Tournament/league modes
- Customizable teams (colors, names)
- Replay system
- Social features (friend invites)

### Phase 3: Scaling & Monetization (Ongoing)

**Technical:**
- CDN for global asset delivery
- Load balancing for multiple game servers
- Analytics integration (player behavior tracking)
- A/B testing infrastructure

**Business:**
- Monetization strategy (ads, cosmetics, battle pass)
- Marketing and user acquisition
- Community management
- App store deployment (if needed)

---

## ⚠️ Risk Assessment

### High-Risk Areas

**1. AI Teammate Quality** 🔴 **CRITICAL**
- **Risk:** Bad AI ruins gameplay experience
- **Impact:** Players feel frustrated by own teammates
- **Mitigation:**
  - Allocate 2-3 weeks for AI tuning specifically
  - Playtesting with focus on "does AI feel competent?"
  - Simple > Complex (rule-based beats broken ML)
  - Copy proven patterns (FIFA/Rocket League AI behaviors)

**2. Network Performance** 🟡 **IMPORTANT**
- **Risk:** Laggy multiplayer = unplayable
- **Impact:** Game feels unresponsive, unfair
- **Mitigation:**
  - Target 20 tick rate minimum (industry standard for web games)
  - Implement client-side prediction early
  - Test on real mobile networks (not just WiFi)
  - Regional servers if needed (start single region for MVP)

**3. Cursor Switching Confusion** 🟡 **IMPORTANT**
- **Risk:** Players lose track of which character they control
- **Impact:** Frustrating control feel, "I didn't press that!"
- **Mitigation:**
  - Strong visual feedback (highlight, arrow, color change)
  - Brief "lock" period after switch (prevent rapid switching)
  - Playtesting to tune switching sensitivity
  - Tutorial mode to explain mechanic

### Medium-Risk Areas

**4. Mobile Performance** 🟢 **MODERATE**
- **Risk:** Low-end devices struggle with rendering + networking
- **Impact:** Limited audience reach
- **Mitigation:**
  - Target 30 FPS minimum on mid-range devices (iPhone 11, Pixel 4a)
  - Adaptive quality settings (reduce sprites/effects on slow devices)
  - Phaser's WebGL rendering is well-optimized
  - Profile early and often

**5. Matchmaking Time** 🟢 **MODERATE**
- **Risk:** Not enough players = long wait times
- **Impact:** Players quit before finding match
- **Mitigation:**
  - Bots as fallback (play vs AI if no human opponent)
  - Show estimated wait time
  - Post-launch: viral mechanics for player growth

**6. Scope Creep** 🟢 **MODERATE**
- **Risk:** Feature additions delay MVP
- **Impact:** Never ship, or ship late with bugs
- **Mitigation:**
  - **Strict MVP scope enforcement** (this document as contract)
  - Phase 2 features are explicitly deferred
  - Weekly review: "Does this block MVP shipping?"

---

## 🎨 Asset Requirements (MVP)

### Graphics Assets Needed

**Characters (Priority 1):**
- 2 teams × 5 players = 10 player sprites
- 4-directional animations (up, down, left, right) or 8-directional
- States: Idle, Run, Kick (3 states × 8 directions = 24 frames per player)
- Can reuse with color palette swap (Team A blue, Team B red)
- **Format:** Sprite sheets (PNG, 32×32 or 64×64 per frame)

**Ball (Priority 1):**
- Simple sphere sprite with shadow
- Optional: Rotating animation (4-8 frames)

**Field (Priority 1):**
- Top-down soccer pitch background
- Goal areas, center circle, boundary lines
- **Format:** Single 1024×1024 PNG or tiled

**UI Elements (Priority 1):**
- Virtual joystick (base + stick sprites)
- Action button (pass/shoot icon)
- Score display elements
- Timer display
- Game over screen background

**Effects (Priority 2 - Phase 2):**
- Ball trail particle
- Goal celebration particles
- Speed lines for sprinting
- Impact effects for tackles

### Audio Assets Needed (Priority 2)

**Sound Effects:**
- Ball kick (pass/shoot variations)
- Goal scored celebration
- Whistle (match start/end)
- UI button clicks
- Crowd ambience (optional)

**Music:**
- Menu theme (looping)
- Gameplay theme (upbeat, looping)
- **Format:** MP3/OGG, <1MB per track

### Asset Creation Strategy

**Option A - Free Assets:**
- [Kenney.nl](https://kenney.nl/) - Public domain game assets
- [OpenGameArt.org](https://opengameart.org/) - CC-licensed sprites
- **Pros:** Free, fast, decent quality
- **Cons:** Generic look, limited customization

**Option B - Commissioned Art:**
- Hire pixel artist or low-poly 3D artist
- Budget: $500-2000 for full MVP asset pack
- **Pros:** Unique style, tailored to vision
- **Cons:** Cost, time (2-4 week delivery)

**Option C - AI-Generated + Refinement:**
- Use AI tools (Midjourney, DALL-E) for concepts
- Manual cleanup and sprite sheet creation
- **Pros:** Fast iteration, unique style possible
- **Cons:** Requires art skills for refinement

**MVP Recommendation:** Start with **Option A (free assets)** to validate gameplay, upgrade to **Option B** post-MVP if game shows traction.

---

## 💰 Budget Estimate (MVP Phase)

### Development Costs
| Item | Cost |
|------|------|
| **Developer Time** (solo, 3 months) | Sweat equity or $15-30K freelance |
| **Assets** (free assets for MVP) | $0-500 |
| **Hosting** (Railway/Render, 3 months) | $60-150 |
| **Domain** (optional) | $10-15/year |
| **Tools/Services** (GitHub, testing devices) | $0-100 |
| **TOTAL (excluding dev salary)** | ~$100-800 |

### Post-MVP Monthly Costs (Phase 2)
| Item | Cost |
|------|------|
| **Hosting** (scaling) | $50-200 |
| **CDN** (Cloudflare free tier initially) | $0-50 |
| **Database** (managed Postgres) | $0-25 |
| **Analytics** (Plausible/Mixpanel) | $0-50 |
| **Marketing** (variable) | $100-1000+ |
| **TOTAL** | $150-1325+ |

---

## 📊 Success Metrics (MVP)

### Technical Metrics
- **Multiplayer stability:** >95% match completion rate (no disconnects)
- **Latency:** <100ms average round-trip time
- **Performance:** 30+ FPS on target devices (iPhone 11, Pixel 4a)
- **Load time:** <5 seconds initial load on 4G

### Engagement Metrics
- **Session length:** Average 10+ minutes (3-5 matches)
- **Retention:** 40%+ D1 retention, 20%+ D7 retention
- **Match completion:** >90% of started matches finished
- **Matchmaking:** <30 seconds average wait time

### Quality Metrics
- **Bug severity:** No critical bugs (game-breaking issues)
- **Crash rate:** <1% of sessions
- **User feedback:** Qualitative playtesting ("Is this fun?")

---

## 🚀 Getting Started (Next Steps)

### Immediate Actions (This Week)
1. **Project scaffolding:**
   ```bash
   npm create vite@latest socca2-client -- --template vanilla-ts
   mkdir socca2-server && cd socca2-server && npm init -y
   npm install colyseus @colyseus/monitor
   ```

2. **Repository setup:**
   - Initialize git repository
   - Create monorepo structure (client/, server/, shared/)
   - Set up TypeScript configs

3. **Spike prototypes:**
   - Phaser "hello world" (render a sprite and move it)
   - Colyseus "hello world" (two clients connect and sync state)
   - Mobile joystick test (touch input handling)

4. **Design mockups:**
   - Sketch field layout (top-down view)
   - UI placement (joystick left, button right, score top)
   - Player switching visual indicator concept

### Week 1 Deliverables
- ✓ Development environment set up
- ✓ Phaser renders a player sprite moving on a field
- ✓ Colyseus server running locally with test room
- ✓ Virtual joystick controls sprite movement
- ✓ Ball sprite renders and follows simple physics

---

## 📚 Technical Resources

### Documentation & Tutorials
- **Phaser:** [Official tutorials](https://phaser.io/tutorials), [examples](https://phaser.io/examples)
- **Colyseus:** [Getting started guide](https://docs.colyseus.io/), [multiplayer patterns](https://docs.colyseus.io/state/overview/)
- **Multiplayer networking:** [Gabriel Gambetta's series](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- **Client-side prediction:** [Valve's Source engine networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)

### Example Projects
- [Phaser multiplayer examples](https://github.com/photonstorm/phaser3-examples)
- [Colyseus example games](https://github.com/colyseus/colyseus-examples)
- [Top-down soccer game reference](https://github.com/Code-Pop/soccer-game) (Unity but similar mechanics)

### Communities
- [Phaser Discord](https://discord.gg/phaser)
- [Colyseus Discord](https://discord.gg/RY8rRS7)
- [r/gamedev](https://reddit.com/r/gamedev)
- [HTML5GameDevs Forum](https://www.html5gamedevs.com/)

---

## 🤝 Team Roles (If Expanding)

### MVP (Solo Dev)
- **You:** Full-stack development (client + server + deployment)

### Post-MVP (Scaling)
- **Frontend Dev:** Phaser, UI/UX, mobile optimization
- **Backend Dev:** Colyseus, database, matchmaking
- **Game Designer:** Mechanics tuning, AI behavior, balancing
- **Artist:** Sprites, animations, UI elements
- **Sound Designer:** Audio effects and music (Phase 2)

---

## 📝 Specification Change Log

**v1.0 (2025-10-01):**
- Initial specification created
- Control model: Cursor-switching (Option B)
- Team composition: 1v1 humans with AI bots (Option A)
- Phased approach: Ship complete 5v5 MVP (8-10 weeks)

**Future updates will be tracked here.**

---

## ✅ Sign-Off

This specification represents the agreed-upon scope for Socca2 MVP development.

**Critical Success Factors:**
1. AI teammates feel competent (not frustrating)
2. Multiplayer networking is smooth (<100ms latency)
3. Cursor switching is intuitive with clear visual feedback
4. Game is fun in 2-4 minute sessions

**Next Step:** Begin Phase 1 Week 1 development tasks.

---

**Document Status:** ✅ Ready for Implementation
**Last Updated:** 2025-10-01
**Owner:** Tim (Project Lead)
