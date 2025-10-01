# 🎮 Manual Test Guide - Virtual Joystick

**⚠️ IMPORTANT**: Phaser Canvas games require **manual browser testing** due to how they capture input events. Automated testing tools cannot properly simulate Phaser's pointer and keyboard systems.

---

## 🚀 Quick Start

1. **Open the game**: http://localhost:5174
2. **Verify game loads**: Green field, blue player, white ball, score/timer, controls hint
3. **Follow test cases below**

---

## ✅ Test Case 1: Keyboard Controls (Baseline)

### Steps:
1. Press **Arrow Keys** (↑ ↓ ← →) on your keyboard
2. Observe player movement
3. Move player near the ball (within ~30px)
4. Press **Spacebar** to shoot

### Expected Results:
- ✅ Player moves smoothly in all 4 directions
- ✅ Player turns **light blue** (#0088ff) when moving
- ✅ Player returns to **dark blue** (#0066ff) when stopped
- ✅ Diagonal movement works (e.g., Up+Right simultaneously)
- ✅ Ball shoots away from player when Space pressed near ball
- ✅ Browser console shows: `⚽ Shot! Power: 0.80`
- ✅ Ball too far away = Space does nothing (> 30px)

### Pass Criteria:
- [ ] All 4 directions work
- [ ] Color change visible when moving
- [ ] Ball shoots with correct power (0.80)
- [ ] Console log appears
- [ ] No errors in console

---

## ✅ Test Case 2: Virtual Joystick Appearance

### Steps:
1. **Click and hold** in the **bottom-left corner** of the game (around 100px from left, 100px from bottom)
2. Observe what appears

### Expected Results:
- ✅ **Gray base circle** appears (semi-transparent, ~60px radius)
- ✅ **Blue stick circle** appears (semi-transparent, ~30px radius)
- ✅ Joystick centered where you clicked
- ✅ Both circles have visible borders

### Pass Criteria:
- [ ] Joystick appears on mouse down
- [ ] Visual feedback is clear (gray base + blue stick)
- [ ] Positioned in bottom-left area

---

## ✅ Test Case 3: Virtual Joystick Movement

### Steps:
1. Click and hold bottom-left to activate joystick
2. **Drag mouse** in different directions (up, down, left, right, diagonals)
3. Watch the blue stick follow your mouse
4. Watch the player move

### Expected Results:
- ✅ Blue stick follows mouse within the gray circle
- ✅ Stick **clamped to max 60px** from base center
- ✅ Player moves in the direction of the stick
- ✅ Player turns **light blue** when joystick active
- ✅ Smooth, responsive movement

### Pass Criteria:
- [ ] Stick follows mouse accurately
- [ ] Stick doesn't exceed base circle
- [ ] Player moves in correct direction
- [ ] Movement feels smooth and responsive

---

## ✅ Test Case 4: Joystick Dead Zone

### Steps:
1. Activate joystick (click bottom-left)
2. Move stick **very slightly** (less than ~12px from center)
3. Observe player behavior

### Expected Results:
- ✅ Player does **NOT move** when stick within dead zone (~12px = 20% of 60px)
- ✅ Player **starts moving** smoothly once stick exceeds dead zone
- ✅ No "drift" or unintended movement from tiny stick movements

### Pass Criteria:
- [ ] Dead zone prevents accidental movement
- [ ] Smooth transition from dead zone to active zone
- [ ] No jittery movement at center

---

## ✅ Test Case 5: Joystick Release

### Steps:
1. Use joystick to move player
2. **Release mouse** button

### Expected Results:
- ✅ Joystick **disappears** immediately
- ✅ Player **stops moving** immediately
- ✅ Player returns to **dark blue** color
- ✅ Screen clears (joystick no longer visible)

### Pass Criteria:
- [ ] Joystick disappears on release
- [ ] Player stops instantly
- [ ] Color returns to dark blue
- [ ] Clean visual state

---

## ✅ Test Case 6: Action Button Appearance

### Steps:
1. Look at the **bottom-right corner** of the game
2. Observe the action button

### Expected Results:
- ✅ **Red/brown circle** visible (~50px radius)
- ✅ **⚽ Soccer ball emoji** in center
- ✅ Button has visible border
- ✅ Button is **always visible** (even when not pressed)
- ✅ Positioned ~80px from right edge, 100px from bottom

### Pass Criteria:
- [ ] Button clearly visible
- [ ] Color is red/brown
- [ ] Soccer ball emoji visible
- [ ] Position is bottom-right

---

## ✅ Test Case 7: Action Button - Quick Tap (Low Power)

### Steps:
1. Move player near ball using keyboard or joystick
2. **Quick tap** the action button (< 0.2 seconds)
3. Observe ball speed and console

### Expected Results:
- ✅ Button **scales down** slightly when pressed (0.9x)
- ✅ Ball shoots with **low power** (~0.1-0.2)
- ✅ Ball moves **slowly** (~40-80 px/s)
- ✅ Console shows: `⚽ Shot! Power: 0.13` (or similar low value)
- ✅ Button returns to normal after release

### Pass Criteria:
- [ ] Button visual feedback on press
- [ ] Low power shot executed
- [ ] Ball speed is noticeably slow
- [ ] Console shows power < 0.3

---

## ✅ Test Case 8: Action Button - Long Hold (High Power)

### Steps:
1. Move player near ball
2. **Click and hold** action button for **1.5+ seconds**
3. Watch button visual changes
4. Release and observe ball

### Expected Results:
- ✅ Button **scales up** gradually as held (0.9x → 1.1x)
- ✅ Button **alpha increases** (0.4 → 0.8) - gets more opaque
- ✅ Visual "pulse" effect visible during hold
- ✅ Ball shoots with **maximum power** (1.0)
- ✅ Ball moves **fast** (~400 px/s)
- ✅ Console shows: `⚽ Shot! Power: 1.00`

### Pass Criteria:
- [ ] Button grows during hold
- [ ] Visual pulse effect clear
- [ ] Max power achieved after 1.5s
- [ ] Ball shoots very fast
- [ ] Console shows power = 1.00

---

## ✅ Test Case 9: Action Button - Medium Power

### Steps:
1. Move player near ball
2. **Hold button for ~0.75 seconds** (half of max)
3. Release and observe

### Expected Results:
- ✅ Power level ~0.5 (half of max)
- ✅ Ball speed medium (~200 px/s)
- ✅ Console shows: `⚽ Shot! Power: 0.50` (±0.1)
- ✅ Smooth power scaling from 0 to 1

### Pass Criteria:
- [ ] Power scales smoothly with hold time
- [ ] Medium power distinguishable from low/high
- [ ] Console confirms ~0.5 power

---

## ✅ Test Case 10: Dual Input Priority

### Steps:
1. Use **keyboard** to move player (arrow keys)
2. While moving, **activate joystick** (click bottom-left and drag)
3. Release joystick
4. Try keyboard again

### Expected Results:
- ✅ Keyboard works initially (player moves)
- ✅ **Joystick takes priority** when activated (keyboard ignored)
- ✅ Smooth transition: keyboard → joystick
- ✅ Keyboard works again after joystick released
- ✅ Smooth transition: joystick → keyboard
- ✅ No stuck states or input conflicts

### Pass Criteria:
- [ ] Joystick overrides keyboard when active
- [ ] Keyboard works before and after joystick use
- [ ] Transitions are smooth
- [ ] No input getting "stuck"

---

## ✅ Test Case 11: Simultaneous Joystick + Button

### Steps:
1. **Click and drag joystick** with mouse (move player)
2. While holding joystick, try to **click button**

**Note**: This test is **limited on desktop** with a single mouse. True multi-touch testing requires mobile device.

### Expected Results:
- ✅ On desktop: Only one control can be used at a time (mouse limitation)
- ✅ No crashes or errors when rapidly switching
- ✅ Controls don't interfere with each other
- ✅ Smooth handoff between joystick and button

### Pass Criteria:
- [ ] No errors when switching between controls
- [ ] Controls function independently
- [ ] No visual glitches
- [ ] (Mobile testing required for true multi-touch)

---

## ✅ Test Case 12: Ball Physics Integration

### Steps:
1. Test shooting with **different power levels** (quick tap vs long hold)
2. Observe ball behavior after each shot

### Expected Results:
- ✅ Low power (0.2): Ball moves ~80 px/s
- ✅ Medium power (0.5): Ball moves ~200 px/s
- ✅ High power (1.0): Ball moves ~400 px/s
- ✅ Ball **slows down over time** (friction = 0.98 per frame)
- ✅ Ball **bounces** off field boundaries (walls)
- ✅ Ball eventually **stops** due to friction
- ✅ Power directly affects initial ball speed

### Pass Criteria:
- [ ] Clear difference between power levels
- [ ] Ball friction visible (slows down)
- [ ] Ball bounces off walls
- [ ] Physics feel realistic for arcade game

---

## ✅ Test Case 13: Performance Check

### Steps:
1. Open **browser DevTools** (F12 or Ctrl+Shift+I)
2. Go to **Performance** tab or enable **FPS meter**
3. Use joystick and button repeatedly for 1-2 minutes
4. Monitor frame rate

### Expected Results:
- ✅ **Stable 60 FPS** during normal gameplay
- ✅ **No frame drops** when using controls
- ✅ Smooth visual updates (no stuttering)
- ✅ No memory leaks over 2-3 minutes
- ✅ CPU usage reasonable (< 50% on modern hardware)

### Pass Criteria:
- [ ] 60 FPS maintained consistently
- [ ] No stuttering or lag
- [ ] Memory usage stable
- [ ] Smooth gameplay experience

---

## ✅ Test Case 14: Console Logging

### Steps:
1. Open **browser console** (F12 → Console tab)
2. Refresh page and play normally
3. Check for messages and errors

### Expected Messages:
- ✅ `🎮 Socca2 initialized!`
- ✅ `⚽ Game scene ready! Mobile: false`
- ✅ `⚽ Shot! Power: [value]` (when shooting)

### Should NOT See:
- ❌ TypeScript errors
- ❌ Phaser warnings or errors
- ❌ `ReferenceError` or `undefined` errors
- ❌ Module resolution errors
- ❌ 404 errors (except favicon.ico - safe to ignore)

### Pass Criteria:
- [ ] Initialization messages present
- [ ] Shot messages appear with correct power values
- [ ] No JavaScript errors
- [ ] No Phaser warnings

---

## ✅ Test Case 15: Visual Feedback Summary

### Steps:
Review all visual feedback elements work together:

### Expected Visual States:

**Player States**:
- ✅ Idle: Dark blue (#0066ff)
- ✅ Moving: Light blue (#0088ff)
- ✅ Yellow indicator circle always visible above player

**Joystick States**:
- ✅ Hidden: Not visible when not in use
- ✅ Active: Gray base + blue stick visible
- ✅ Stick position: Follows mouse within radius

**Action Button States**:
- ✅ Idle: Red/brown, semi-transparent (alpha 0.4)
- ✅ Pressed: Darker, more opaque, scaled down
- ✅ Charging: Growing scale (0.9x → 1.1x), increasing alpha (0.4 → 0.8)

### Pass Criteria:
- [ ] All visual states clearly distinguishable
- [ ] Smooth transitions between states
- [ ] No visual glitches or artifacts
- [ ] Professional appearance

---

## 📊 Test Results Summary

After completing all test cases, fill out this summary:

### Keyboard Controls
- [ ] ✅ PASS - All tests passed
- [ ] ⚠️ PARTIAL - Some issues found
- [ ] ❌ FAIL - Major issues

**Issues found**: ___________________________

---

### Virtual Joystick
- [ ] ✅ PASS - All tests passed
- [ ] ⚠️ PARTIAL - Some issues found
- [ ] ❌ FAIL - Major issues

**Issues found**: ___________________________

---

### Action Button
- [ ] ✅ PASS - All tests passed
- [ ] ⚠️ PARTIAL - Some issues found
- [ ] ❌ FAIL - Major issues

**Issues found**: ___________________________

---

### Integration & Performance
- [ ] ✅ PASS - All tests passed
- [ ] ⚠️ PARTIAL - Some issues found
- [ ] ❌ FAIL - Major issues

**Issues found**: ___________________________

---

## 🐛 Bug Reporting Template

If you find any issues, document them here:

**Issue #1**:
- **Component**: Joystick / Button / Keyboard / Other
- **Steps to reproduce**:
- **Expected behavior**:
- **Actual behavior**:
- **Console errors**:
- **Severity**: Critical / High / Medium / Low

---

## ✅ Test Completion Checklist

Mark when complete:
- [ ] All 15 test cases executed
- [ ] Console checked for errors
- [ ] Performance verified (60 FPS)
- [ ] Visual feedback confirmed working
- [ ] Summary filled out above
- [ ] Any bugs documented

**Tester Name**: ___________________________
**Date**: ___________________________
**Browser**: ___________________________
**OS**: ___________________________

---

## 📱 Next Steps After Desktop Testing

### If All Tests PASS:
✅ Proceed to **mobile device testing** (Week 1-2 Days 8-10):
1. Set up mobile access (ngrok or local network)
2. Test on iOS device
3. Test on Android device
4. Verify true multi-touch (joystick + button simultaneously)
5. Optimize sensitivity based on touch feedback

### If Issues Found:
⚠️ Fix bugs before mobile testing:
1. Document all issues in DESKTOP_TEST_REPORT.md
2. Prioritize: Critical → High → Medium → Low
3. Fix systematically
4. Re-test after each fix
5. Ensure 60 FPS maintained

---

**Estimated Test Time**: 20-30 minutes
**Status**: Ready for manual execution
**URL**: http://localhost:5174
