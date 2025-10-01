# Week 3-4 Implementation Workflow
## Local Gameplay & Ball Mechanics

**Status**: 📋 Ready for Implementation
**Duration**: 11 days (Days 11-21)
**Risk Level**: 🟢 LOW
**Last Updated**: 2025-10-01

---

## 🎯 Overview

Building on the completed Week 1-2 foundation, Week 3-4 focuses on creating a complete single-player match experience with goal detection, scoring, and match flow.

### What's Already Complete (Week 1-2)
✅ Ball entity with physics (friction, bouncing)
✅ Basic power-based shooting mechanics
✅ Ball possession system (magnetism < 30px)
✅ Player-ball collision detection
✅ Dynamic touch controls with zone-based separation

### What We're Building (Week 3-4)
🎯 Goal detection system
🎯 Scoring and match timer
🎯 Goal celebrations with particles
🎯 Sound effects integration
🎯 Visual polish and playtesting

---

## 📊 Implementation Strategy

### Core Principle: **MVP First, Polish Later**
- Focus on core match flow (Days 11-14)
- Add juice and feedback (Days 15-17)
- Polish and validate (Days 18-21)

### Deferred Features (Not Week 3-4)
❌ Ball spin and curve physics → Phase 2
❌ Directional shooting → Phase 2
❌ Pass mechanics → Week 7-8 (requires AI teammates)
❌ Context-sensitive action button → Week 7-8

---

## 🗓️ Phase 1: Core Match Flow (Days 11-14)

**Goal**: Playable match with goals and scoring
**Duration**: 4 days
**Deliverable**: Can play full 2-minute match with accurate scoring

### Day 11: Goal Zone Detection ⚡

**Objective**: Implement goal detection logic and collision

**Tasks**:
1. Define goal zones based on existing visual goals
   ```typescript
   // In GameScene.ts
   private leftGoal = {
     x: 10,
     yMin: this.scale.height / 2 - 60,
     yMax: this.scale.height / 2 + 60,
     width: 20
   }

   private rightGoal = {
     x: this.scale.width - 10,
     yMin: this.scale.height / 2 - 60,
     yMax: this.scale.height / 2 + 60,
     width: 20
   }
   ```

2. Implement `checkGoal()` method
   ```typescript
   private checkGoal(): { scored: boolean; team?: 'blue' | 'red' } {
     // Check left goal (red scores)
     if (this.ball.x <= this.leftGoal.x &&
         this.ball.y >= this.leftGoal.yMin &&
         this.ball.y <= this.leftGoal.yMax) {
       return { scored: true, team: 'red' }
     }

     // Check right goal (blue scores)
     if (this.ball.x >= this.rightGoal.x &&
         this.ball.y >= this.rightGoal.yMin &&
         this.ball.y <= this.rightGoal.yMax) {
       return { scored: true, team: 'blue' }
     }

     return { scored: false }
   }
   ```

3. Add goal post collision (ball bounces)
   ```typescript
   // In updateBallPhysics()
   if (this.ball.y < this.leftGoal.yMin || this.ball.y > this.leftGoal.yMax) {
     // Hit goal post - bounce
     if (this.ball.x <= this.leftGoal.x + this.leftGoal.width) {
       this.ballVelocity.x *= -0.8
     }
   }
   ```

4. Add visual debug mode (optional)
   ```typescript
   if (import.meta.env.DEV) {
     // Draw goal zone rectangles
     const debugGraphics = this.add.graphics()
     debugGraphics.lineStyle(2, 0xff0000, 0.3)
     debugGraphics.strokeRect(
       this.leftGoal.x,
       this.leftGoal.yMin,
       this.leftGoal.width,
       this.leftGoal.yMax - this.leftGoal.yMin
     )
   }
   ```

**Testing**:
- Shoot ball into goal from various angles
- Verify goal detection accuracy (should be 100%)
- Test edge cases: ball on goal line, ball at post edges
- Verify goal post bouncing works

**Time**: 6-8 hours
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Day 12: Scoring System 📊

**Objective**: Track and display scores when goals are scored

**Tasks**:
1. Add score state to GameScene
   ```typescript
   private scoreBlue: number = 0
   private scoreRed: number = 0
   ```

2. Implement `onGoalScored()` method
   ```typescript
   private onGoalScored(team: 'blue' | 'red') {
     // Update score
     if (team === 'blue') {
       this.scoreBlue++
     } else {
       this.scoreRed++
     }

     // Update UI
     this.scoreText.setText(`${this.scoreBlue} - ${this.scoreRed}`)

     // Reset ball to center
     this.resetBall()

     // Log for debugging
     console.log(`⚽ Goal! ${team} scores. Score: ${this.scoreBlue}-${this.scoreRed}`)
   }
   ```

3. Implement ball reset
   ```typescript
   private resetBall() {
     this.ball.x = this.scale.width / 2
     this.ball.y = this.scale.height / 2
     this.ballVelocity.x = 0
     this.ballVelocity.y = 0
   }
   ```

4. Call `onGoalScored()` from goal detection
   ```typescript
   // In update() method
   const goalResult = this.checkGoal()
   if (goalResult.scored) {
     this.onGoalScored(goalResult.team!)
   }
   ```

5. Prevent multiple goal triggers
   ```typescript
   private goalScored: boolean = false

   // In checkGoal()
   if (this.goalScored) return { scored: false }

   // In onGoalScored()
   this.goalScored = true
   this.time.delayedCall(1000, () => {
     this.goalScored = false
   })
   ```

**Testing**:
- Score multiple goals, verify count increments correctly
- Verify UI updates immediately
- Test rapid scoring (ball shouldn't trigger multiple goals)
- Verify ball resets to center after goal

**Time**: 4-6 hours
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Day 13: Match Timer ⏱️

**Objective**: Countdown timer with match end logic

**Tasks**:
1. Add timer state
   ```typescript
   private matchDuration: number = 120 // 2 minutes in seconds
   private timeRemaining: number = 120
   private timerEvent?: Phaser.Time.TimerEvent
   ```

2. Start timer in `create()`
   ```typescript
   private startMatchTimer() {
     this.timerEvent = this.time.addEvent({
       delay: 1000,
       callback: this.updateTimer,
       callbackScope: this,
       loop: true
     })
   }
   ```

3. Implement timer update
   ```typescript
   private updateTimer() {
     this.timeRemaining--

     // Update UI (MM:SS format)
     const minutes = Math.floor(this.timeRemaining / 60)
     const seconds = this.timeRemaining % 60
     this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`)

     // Check for match end
     if (this.timeRemaining <= 0) {
       this.onMatchEnd()
     }
   }
   ```

4. Implement match end
   ```typescript
   private onMatchEnd() {
     // Stop timer
     if (this.timerEvent) {
       this.timerEvent.remove()
     }

     // Determine winner
     const winner = this.scoreBlue > this.scoreRed ? 'Blue' :
                    this.scoreRed > this.scoreBlue ? 'Red' : 'Draw'

     // Show end screen
     this.showMatchEndScreen(winner)

     console.log(`🏁 Match End! Winner: ${winner}`)
   }
   ```

5. Create simple end screen
   ```typescript
   private showMatchEndScreen(winner: string) {
     // Dark overlay
     const overlay = this.add.rectangle(
       this.scale.width / 2,
       this.scale.height / 2,
       this.scale.width,
       this.scale.height,
       0x000000,
       0.7
     )
     overlay.setDepth(2000)

     // Winner text
     const resultText = this.add.text(
       this.scale.width / 2,
       this.scale.height / 2 - 50,
       winner === 'Draw' ? 'Match Draw!' : `${winner} Team Wins!`,
       { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }
     )
     resultText.setOrigin(0.5)
     resultText.setDepth(2001)

     // Final score
     const scoreText = this.add.text(
       this.scale.width / 2,
       this.scale.height / 2 + 20,
       `${this.scoreBlue} - ${this.scoreRed}`,
       { fontSize: '36px', color: '#ffffff' }
     )
     scoreText.setOrigin(0.5)
     scoreText.setDepth(2001)

     // Restart hint
     const restartText = this.add.text(
       this.scale.width / 2,
       this.scale.height / 2 + 80,
       'Tap to restart',
       { fontSize: '24px', color: '#aaaaaa' }
     )
     restartText.setOrigin(0.5)
     restartText.setDepth(2001)

     // Handle restart
     this.input.once('pointerdown', () => {
       this.scene.restart()
     })
   }
   ```

**Testing**:
- Verify timer counts down correctly (MM:SS format)
- Test match end at 0:00
- Verify winner is determined correctly (blue/red/draw)
- Test restart functionality

**Time**: 6-8 hours
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Day 14: Ball Possession Indicator 🎨

**Objective**: Visual feedback when player has ball possession

**Tasks**:
1. Create possession indicator graphics
   ```typescript
   private possessionIndicator!: Phaser.GameObjects.Circle

   // In createPlayer()
   this.possessionIndicator = this.add.circle(0, 0, 40, 0xffff00, 0)
   this.possessionIndicator.setStrokeStyle(3, 0xffff00, 0.6)
   this.possessionIndicator.setDepth(999)
   ```

2. Update possession indicator in `update()`
   ```typescript
   // In checkCollisions() or update()
   const dx = this.ball.x - this.player.x
   const dy = this.ball.y - this.player.y
   const dist = Math.sqrt(dx * dx + dy * dy)

   if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
     // Show possession indicator
     this.possessionIndicator.setPosition(this.player.x, this.player.y)
     this.possessionIndicator.setAlpha(0.6)

     // Optional: pulse animation
     this.tweens.add({
       targets: this.possessionIndicator,
       scale: { from: 1, to: 1.2 },
       duration: 500,
       yoyo: true,
       repeat: -1
     })
   } else {
     // Hide possession indicator
     this.possessionIndicator.setAlpha(0)
   }
   ```

3. Add smooth fade in/out
   ```typescript
   // Instead of instant alpha change
   this.tweens.add({
     targets: this.possessionIndicator,
     alpha: hasPossession ? 0.6 : 0,
     duration: 200,
     ease: 'Linear'
   })
   ```

**Testing**:
- Verify indicator appears when near ball
- Test smooth fade in/out
- Verify indicator follows player position
- Test pulse animation (optional)

**Time**: 3-4 hours
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Phase 1 Testing Gate ✅

**Criteria to pass to Phase 2**:
- [ ] Goals detected accurately (100% success rate)
- [ ] Score updates correctly after each goal
- [ ] Timer counts down properly (MM:SS format)
- [ ] Match ends at 0:00 with correct winner
- [ ] Possession indicator visible when near ball
- [ ] No false goal detections or duplicate scoring
- [ ] Can play full 2-minute match start to finish

**Testing Method**: 30-minute playtest session
**Pass Criteria**: All checklist items complete + no critical bugs

---

## 🎨 Phase 2: Juice & Feedback (Days 15-17)

**Goal**: Make the game feel exciting and polished
**Duration**: 3 days
**Deliverable**: Satisfying visual/audio feedback for all actions

### Day 15-16: Goal Celebration 🎉

**Objective**: Particle effects and screen feedback on goal

**Tasks**:
1. Load particle texture (or use simple graphics)
   ```typescript
   // In preload() or create simple particle
   const particle = this.add.circle(0, 0, 4, 0xffffff)
   particle.generateTexture('spark', 8, 8)
   particle.destroy()
   ```

2. Create particle emitter
   ```typescript
   private createGoalCelebration(x: number, y: number) {
     // Particle explosion
     const particles = this.add.particles(x, y, 'spark', {
       speed: { min: -200, max: 200 },
       angle: { min: 0, max: 360 },
       scale: { start: 1, end: 0 },
       blendMode: 'ADD',
       lifespan: 600,
       gravityY: 300,
       quantity: 30
     })

     // Auto-destroy after animation
     this.time.delayedCall(1000, () => {
       particles.destroy()
     })
   }
   ```

3. Add screen flash
   ```typescript
   private flashScreen(color: number = 0xffffff) {
     const flash = this.add.rectangle(
       this.scale.width / 2,
       this.scale.height / 2,
       this.scale.width,
       this.scale.height,
       color,
       0.5
     )
     flash.setDepth(1500)

     this.tweens.add({
       targets: flash,
       alpha: 0,
       duration: 300,
       onComplete: () => flash.destroy()
     })
   }
   ```

4. Add screen shake
   ```typescript
   private shakeScreen() {
     this.cameras.main.shake(200, 0.01)
   }
   ```

5. Integrate into `onGoalScored()`
   ```typescript
   private onGoalScored(team: 'blue' | 'red') {
     // Existing score logic...

     // Celebration effects
     const goalX = team === 'blue' ? this.rightGoal.x : this.leftGoal.x
     const goalY = this.scale.height / 2

     this.createGoalCelebration(goalX, goalY)
     this.flashScreen(team === 'blue' ? 0x0066ff : 0xff4444)
     this.shakeScreen()

     // Delay ball reset for celebration
     this.time.delayedCall(1000, () => {
       this.resetBall()
       this.goalScored = false
     })
   }
   ```

**Testing**:
- Score goals and verify celebration plays
- Test particle effect performance (should maintain 60 FPS)
- Verify screen flash is visible but not overwhelming
- Test celebration from both goals (blue and red)

**Time**: 10-12 hours (2 days)
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Day 17: Sound Effects 🔊

**Objective**: Add audio feedback for key actions

**Tasks**:
1. Download sound assets from freesound.org
   - Ball kick sound (short, punchy)
   - Goal scored sound (celebration horn/cheering)
   - Whistle sound (match start/end)
   - UI click sound (optional)

2. Add sounds to assets folder
   ```
   client/public/assets/sounds/
   ├── kick.mp3
   ├── goal.mp3
   └── whistle.mp3
   ```

3. Load sounds in `preload()`
   ```typescript
   preload() {
     this.load.audio('kick', 'assets/sounds/kick.mp3')
     this.load.audio('goal', 'assets/sounds/goal.mp3')
     this.load.audio('whistle', 'assets/sounds/whistle.mp3')
   }
   ```

4. Add sound references
   ```typescript
   private sounds: {
     kick?: Phaser.Sound.BaseSound
     goal?: Phaser.Sound.BaseSound
     whistle?: Phaser.Sound.BaseSound
   } = {}

   // In create()
   this.sounds.kick = this.sound.add('kick', { volume: 0.5 })
   this.sounds.goal = this.sound.add('goal', { volume: 0.7 })
   this.sounds.whistle = this.sound.add('whistle', { volume: 0.6 })
   ```

5. Play sounds at appropriate times
   ```typescript
   // In shootBall()
   if (dist < GAME_CONFIG.POSSESSION_RADIUS) {
     this.sounds.kick?.play()
     // ... shooting logic
   }

   // In onGoalScored()
   this.sounds.goal?.play()

   // In create() and onMatchEnd()
   this.sounds.whistle?.play()
   ```

6. Add mute toggle (optional)
   ```typescript
   private createMuteButton() {
     const muteButton = this.add.text(
       this.scale.width - 50,
       30,
       this.sound.mute ? '🔇' : '🔊',
       { fontSize: '24px' }
     )
     muteButton.setInteractive()
     muteButton.on('pointerdown', () => {
       this.sound.mute = !this.sound.mute
       muteButton.setText(this.sound.mute ? '🔇' : '🔊')
     })
   }
   ```

**Testing**:
- Verify all sounds play at correct times
- Test volume levels (not too loud/quiet)
- Verify no audio glitches or delays
- Test mute toggle functionality
- Test on mobile device (iOS requires user interaction first)

**Time**: 6-8 hours
**Files Modified**: `client/src/scenes/GameScene.ts`
**Assets Added**: `client/public/assets/sounds/` (3 files)

---

### Phase 2 Testing Gate ✅

**Criteria to pass to Phase 3**:
- [ ] Goal celebration particles visible and performant
- [ ] Screen flash visible but not jarring
- [ ] All sounds play at appropriate times
- [ ] No audio glitches or performance issues
- [ ] Game still maintains 60 FPS with all effects

**Testing Method**: User test with 3 players (15 min each)
**Pass Criteria**: Positive feedback on "does scoring feel exciting?"

---

## 🎯 Phase 3: Polish & Validation (Days 18-21)

**Goal**: Bug-free, smooth experience ready for production
**Duration**: 4 days
**Deliverable**: Production-ready single-player game

### Day 18-19: Bug Fixing & Refinement 🐛

**Objective**: Fix all issues found in Phase 1-2 testing

**Common Issues to Check**:
1. **Goal Detection**:
   - Ball clipping through goal posts
   - Multiple goal triggers
   - False positives (ball near but not in goal)

2. **Scoring**:
   - Score not updating immediately
   - Wrong team credited with goal
   - Score display formatting issues

3. **Timer**:
   - Timer not stopping at match end
   - Incorrect MM:SS display
   - Timer drift over long matches

4. **Celebrations**:
   - Particle effects not destroying properly (memory leak)
   - Screen flash too intense or not visible
   - Celebration blocking gameplay too long

5. **Sound**:
   - Sound not playing on mobile
   - Volume too loud/quiet
   - Audio popping or glitching

**Process**:
1. Create issue list from Phase 1-2 testing
2. Prioritize: Critical → High → Medium → Low
3. Fix critical and high priority issues (Day 18)
4. Fix medium and low priority issues (Day 19)
5. Retest after each fix

**Time**: 12-16 hours (2 days)
**Files Modified**: Various based on issues found

---

### Day 19: Visual Polish (Afternoon) ✨

**Objective**: Add final visual touches

**Tasks**:
1. **Ball Trail Effect** (optional)
   ```typescript
   private createBallTrail() {
     const trail = this.add.particles(this.ball.x, this.ball.y, 'spark', {
       follow: this.ball,
       speed: 0,
       scale: { start: 0.5, end: 0 },
       alpha: { start: 0.5, end: 0 },
       lifespan: 200,
       frequency: 50,
       quantity: 1
     })
   }
   ```

2. **Smooth Player Rotation**
   ```typescript
   // In updatePlayerMovement()
   if (velocityMagnitude > 0) {
     const angle = Math.atan2(this.playerVelocity.y, this.playerVelocity.x)
     this.player.rotation = angle
   }
   ```

3. **Field Line Glow** (optional)
   ```typescript
   // Add subtle glow to center line
   borderGraphics.lineStyle(3, 0xffffff, 0.8)
   borderGraphics.lineBetween(width / 2, 10, width / 2, height - 10)
   ```

4. **UI Polish**
   - Add drop shadow to score text
   - Animate score change (scale up briefly)
   - Add glow to timer when under 30 seconds

**Time**: 4-6 hours
**Files Modified**: `client/src/scenes/GameScene.ts`

---

### Day 20: Extended Playtesting 🧪

**Objective**: Comprehensive testing with real users

**Playtest Plan**:
1. **Recruit 5-10 testers**
   - Mix of gaming experience levels
   - Both desktop and mobile testers
   - Fresh eyes (not development team)

2. **Test Protocol** (15-20 min per tester):
   - Brief introduction (1 min)
   - Unguided play (5 min) - observe without helping
   - Guided tasks (5 min):
     - Play a full 2-minute match
     - Score at least 3 goals
     - Try both power levels (tap vs hold)
   - Feedback interview (5 min):
     - What felt good? What felt frustrating?
     - Any bugs or confusing moments?
     - Would you play again?

3. **Data Collection**:
   - Bug reports (screenshot if possible)
   - Feedback notes (positive and negative)
   - Performance metrics (FPS, device type)
   - Playtime and engagement level

4. **Success Metrics**:
   - 80%+ testers complete full match
   - Average playtime >5 minutes
   - Zero critical bugs reported
   - Positive feedback from 70%+ testers

**Time**: 6-8 hours (including scheduling and analysis)
**Deliverable**: Bug list + feedback summary

---

### Day 21: Final Bug Fixes & Performance 🚀

**Objective**: Address all playtest findings and optimize

**Tasks**:
1. **Critical Bugs**:
   - Fix any game-breaking issues from playtesting
   - Priority: issues that block core gameplay

2. **Performance Optimization**:
   - Profile game with Phaser debug tools
   - Optimize particle effects if needed
   - Check memory usage (no leaks)
   - Verify 60 FPS on iPhone 11 / Pixel 4a

3. **Final Polish**:
   - Adjust ball physics based on feedback
   - Tweak celebration timing if too long/short
   - Fine-tune sound volumes

4. **Code Cleanup**:
   - Remove debug logs
   - Remove debug visual modes
   - Clean up commented code
   - Update comments for clarity

5. **Documentation**:
   - Update MOBILE_CONTROLS.md with new features
   - Add "Known Issues" section if any remain
   - Update README with Week 3-4 completion status

**Time**: 6-8 hours
**Files Modified**: Various

---

### Phase 3 Completion Checklist ✅

**Must Pass All**:
- [ ] Zero critical bugs (game-breaking issues)
- [ ] 60 FPS maintained on target devices (iPhone 11, Pixel 4a)
- [ ] All 5+ playtesters completed full match
- [ ] Average playtime >5 minutes per session
- [ ] Positive feedback from 70%+ testers
- [ ] Goal detection 100% accurate in playtesting
- [ ] No memory leaks (particle effects cleaned up)
- [ ] Sound works on both iOS and Android
- [ ] Match end screen displays correctly
- [ ] Code cleaned up and well-documented

---

## 📋 Implementation Checklist

### Phase 1: Core Match Flow ✅
- [ ] Day 11: Goal zone detection
  - [ ] Define goal zones
  - [ ] Implement checkGoal() method
  - [ ] Goal post collision
  - [ ] Visual debug mode
  - [ ] Testing: 100% detection accuracy

- [ ] Day 12: Scoring system
  - [ ] Score state tracking
  - [ ] onGoalScored() method
  - [ ] Ball reset after goal
  - [ ] Prevent duplicate goal triggers
  - [ ] Testing: Multiple goal scenarios

- [ ] Day 13: Match timer
  - [ ] Timer state and event
  - [ ] MM:SS display format
  - [ ] Match end detection
  - [ ] End screen with winner
  - [ ] Restart functionality
  - [ ] Testing: Full match playthrough

- [ ] Day 14: Possession indicator
  - [ ] Visual indicator graphics
  - [ ] Show/hide based on distance
  - [ ] Smooth fade in/out
  - [ ] Optional pulse animation
  - [ ] Testing: Visual feedback clear

- [ ] Phase 1 Testing Gate
  - [ ] 30-minute playtest session
  - [ ] All criteria passed
  - [ ] No critical bugs

### Phase 2: Juice & Feedback ✅
- [ ] Day 15-16: Goal celebration
  - [ ] Particle effect system
  - [ ] Screen flash
  - [ ] Screen shake
  - [ ] Integration with scoring
  - [ ] Testing: Performance maintained

- [ ] Day 17: Sound effects
  - [ ] Download sound assets
  - [ ] Load sounds in preload
  - [ ] Play kick sound
  - [ ] Play goal sound
  - [ ] Play whistle sound
  - [ ] Optional mute toggle
  - [ ] Testing: All sounds work

- [ ] Phase 2 Testing Gate
  - [ ] User test with 3 players
  - [ ] Positive feedback received
  - [ ] No audio/performance issues

### Phase 3: Polish & Validation ✅
- [ ] Day 18-19: Bug fixing
  - [ ] Create issue list
  - [ ] Fix critical bugs
  - [ ] Fix high priority bugs
  - [ ] Fix medium/low bugs
  - [ ] Retest all fixes

- [ ] Day 19 (PM): Visual polish
  - [ ] Ball trail effect (optional)
  - [ ] Player rotation (optional)
  - [ ] UI polish (shadows, animations)
  - [ ] Testing: Performance check

- [ ] Day 20: Extended playtesting
  - [ ] Recruit 5-10 testers
  - [ ] Run playtest sessions
  - [ ] Collect feedback and bugs
  - [ ] Analyze results
  - [ ] Create final bug list

- [ ] Day 21: Final polish
  - [ ] Fix critical playtest bugs
  - [ ] Performance optimization
  - [ ] Code cleanup
  - [ ] Documentation updates
  - [ ] Final testing pass

- [ ] Phase 3 Completion Gate
  - [ ] All checklist items complete
  - [ ] Zero critical bugs
  - [ ] 60 FPS verified
  - [ ] Positive playtest results

---

## 🎯 Success Criteria

### Week 3-4 Complete When:
✅ Goal detection working with 100% accuracy
✅ Scoring system tracks both teams correctly
✅ Match timer counts down and ends properly
✅ Goal celebrations feel exciting (particles + sound)
✅ Sound effects play at all key moments
✅ Game maintains 60 FPS on target devices
✅ Zero critical bugs reported in playtesting
✅ Positive feedback from majority of playtesters
✅ Code is clean and well-documented

---

## 📊 Time Estimates

| Phase | Days | Hours | Tasks |
|-------|------|-------|-------|
| Phase 1: Core Match Flow | 4 | 24-32 | Goal detection, scoring, timer, possession |
| Phase 2: Juice & Feedback | 3 | 20-28 | Celebrations, sound effects |
| Phase 3: Polish & Validation | 4 | 28-36 | Bug fixes, polish, playtesting |
| **Total** | **11** | **72-96** | |

**Compression Potential**: Can reduce to 8-9 days by:
- Parallel development (Day 11)
- Simpler celebrations (screen flash only)
- Reduced polish time

**Buffer**: 2-3 days built into estimates for unexpected issues

---

## ⚠️ Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Goal detection edge cases | Visual debug zones, extensive testing |
| Particle performance issues | Object pooling, max particle limits |
| Sound not working on iOS | Test early, require user interaction first |
| Timer drift in long sessions | Use Phaser TimerEvent, not Date.now() |

### Scope Risks
| Risk | Mitigation |
|------|------------|
| Feature creep (spin physics) | Strict "defer to Phase 2" discipline |
| Over-polishing | Time-box polish to Day 19 |
| Insufficient testing time | Reserve full 2 days (Day 20-21) |

---

## 📚 Resources

### Documentation
- [Phaser 3 Particles](https://newdocs.phaser.io/docs/3.80.0/Phaser.GameObjects.Particles.ParticleEmitter)
- [Phaser 3 Sound](https://newdocs.phaser.io/docs/3.80.0/Phaser.Sound.BaseSoundManager)
- [Phaser 3 Tweens](https://newdocs.phaser.io/docs/3.80.0/Phaser.Tweens.TweenManager)

### Assets
- [freesound.org](https://freesound.org) - Free CC0 sound effects
- [OpenGameArt](https://opengameart.org) - Free game assets

### Testing
- [ngrok](https://ngrok.com) - HTTPS tunnel for mobile testing
- Chrome DevTools - Performance profiling

---

## ✅ Next Steps After Week 3-4

Once Week 3-4 is complete, move to:
- **Week 5-6**: Multiplayer Networking (Colyseus integration)
- **Week 7-8**: AI Teammates & Cursor Switching
- **Week 9-10**: Polish, Testing, Deployment

---

**Workflow Status**: 📋 Ready for Implementation
**Confidence**: 85% (can deliver all features on schedule)
**Next Action**: Start Day 11 - Goal Zone Detection

🚀 Let's build an exciting single-player soccer experience!
