# Player Switching Test Plan

## Issue Analysis
Player switching logic (`switchToNextTeammate()`) correctly updates `controlledPlayerId` and borders, but visual feedback may not be responsive when controlling AI teammates.

## Root Causes Identified

### 1. Visual Update Logic
- **SinglePlayerScene**: All sprites update correctly via `syncVisualsFromEngine()`
- **GameScene**: Local prediction only works when `controlledPlayerId === mySessionId` (line 75)
  - When controlling AI teammate, no local prediction → feels laggy

### 2. Input Routing
- **SinglePlayerScene**: ✅ Correctly sends input to `controlledPlayerId` (line 78)
- **GameScene**: ✅ Correctly sends input to `controlledPlayerId` (line 70)

## Testing Strategy

### Phase 1: Manual Testing (Browser Console)

The game already exposes `window.__gameControls` for testing. Use these commands:

```javascript
// Get current game state
const scene = window.__gameControls.scene
const state = scene.getGameState()

// Check current player IDs
console.log('My Player ID:', scene.myPlayerId)
console.log('Controlled Player ID:', scene.controlledPlayerId)

// List all players
state.players.forEach((player, id) => {
  console.log(`Player ${id}: team=${player.team}, isHuman=${player.isHuman}`)
})

// Test player switching
scene.switchToNextTeammate()
console.log('After switch, controlled:', scene.controlledPlayerId)

// Test input while controlling AI
window.__gameControls.test.touchJoystick(50, -50) // Move up-right
// Watch if the controlled player sprite moves

window.__gameControls.test.releaseJoystick()

// Switch again and test
scene.switchToNextTeammate()
console.log('After 2nd switch, controlled:', scene.controlledPlayerId)
```

### Phase 2: Automated Testing

#### Test Cases

1. **Single Player Mode**
   - Join single-player game
   - Verify 3 teammates on blue team (player1, player1-bot1, player1-bot2)
   - Press Space (no ball) → should switch to player1-bot1
   - Move joystick → verify player1-bot1 sprite moves
   - Press Space again → should switch to player1-bot2
   - Move joystick → verify player1-bot2 sprite moves
   - Press Space again → should cycle back to player1

2. **Multiplayer Mode**
   - Two players join
   - Verify 6 total players (3 per team)
   - Player 1 presses Space → switches through their 3 teammates
   - Verify input only affects player 1's team
   - Verify player 2 can independently switch their team

3. **Border Visual Feedback**
   - Verify controlled player has thick border (8px)
   - Verify uncontrolled teammates have thin border (2px)
   - Verify border updates immediately on switch

4. **Auto-Switch on Possession**
   - Teammate gains ball possession
   - Verify `controlledPlayerId` automatically switches to ball possessor
   - Verify border updates to show new controlled player

## Expected vs Actual Behavior

### Expected
- Press Space → switch to next teammate
- Border immediately shows thick line on new controlled player
- Movement input controls the newly selected player
- Player responds smoothly to input

### Potential Issues
1. **Multiplayer lag**: AI teammate control feels unresponsive due to no local prediction
2. **Visual confusion**: Hard to tell which player is controlled without clear indicator
3. **Camera following**: Camera doesn't follow controlled player (by design - shows full field)

## Fixes Needed

### Fix 1: GameScene Local Prediction for AI Teammates
**Problem**: Line 75 only predicts when `controlledPlayerId === mySessionId`

**Solution**: Apply local prediction to whichever sprite represents `controlledPlayerId`

```typescript
// Find the sprite for the controlled player
let controlledSprite: Phaser.GameObjects.Arc
if (this.controlledPlayerId === this.mySessionId) {
  controlledSprite = this.player
} else {
  controlledSprite = this.remotePlayers.get(this.controlledPlayerId)!
}

if (controlledSprite && hasMovement) {
  // Apply local prediction to controlled sprite
  controlledSprite.x += movement.x * GAME_CONFIG.PLAYER_SPEED * dt
  controlledSprite.y += movement.y * GAME_CONFIG.PLAYER_SPEED * dt
  // ... clamping and visual feedback
}
```

### Fix 2: Enhanced Visual Feedback
**Problem**: May be hard to track controlled player

**Potential improvements**:
- Add player name/ID text above sprites
- Add arrow indicator above controlled player
- Different animation for controlled vs uncontrolled

## Test Execution

### Using Browser DevTools
1. Open game in browser
2. Open DevTools console (F12)
3. Run manual test commands above
4. Observe behavior and log results

### Using Playwright (Automated)
```javascript
// Test will be created in next phase
test('player switching cycles through teammates', async ({ page }) => {
  // Navigate to single-player game
  // Wait for game start
  // Simulate Space key press
  // Verify controlledPlayerId changed
  // Simulate movement
  // Verify controlled player position changed
})
```

## Success Criteria

✅ Space bar cycles through teammates in correct order
✅ Border visual updates immediately
✅ Movement input controls the selected player
✅ No crashes or errors during switching
✅ Works in both single-player and multiplayer modes
✅ Auto-switch on possession works correctly
