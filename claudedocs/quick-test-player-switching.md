# Quick Test: Player Switching

## Fixed Issues

✅ **GameScene**: Local prediction now works for AI teammates (no more lag when controlling bots)
✅ **Visual Update**: All sprites update correctly based on controlledPlayerId
✅ **Border Feedback**: Controlled player shows thick border (8px), uncontrolled show thin (2px)

## Immediate Testing (Browser Console)

### Single Player Test
1. Open http://localhost:5174
2. Select "Single Player"
3. Open browser console (F12)
4. Run these commands:

```javascript
// Quick status check
const scene = window.__gameControls.scene
console.log('My ID:', scene.myPlayerId) // e.g., "player1"
console.log('Controlled:', scene.controlledPlayerId) // should match myPlayerId initially

// Test switching
scene.switchToNextTeammate()
console.log('After switch:', scene.controlledPlayerId) // e.g., "player1-bot1"

// Verify visual border (thick = controlled)
scene.remotePlayers.forEach((sprite, id) => {
  console.log(`Player ${id}: strokeWidth=${sprite.strokeLineWidth}`)
})
// Controlled player should have strokeLineWidth = 8, others = 2

// Test movement on AI teammate
window.__gameControls.test.touchJoystick(100, 0) // Move right
// Watch the controlled bot (thick border) move
setTimeout(() => window.__gameControls.test.releaseJoystick(), 1000)

// Switch again
scene.switchToNextTeammate()
console.log('After 2nd switch:', scene.controlledPlayerId) // e.g., "player1-bot2"
```

### Multiplayer Test
1. Open two browser windows side-by-side
2. Both select "Multiplayer"
3. In window 1 console:

```javascript
const scene = window.__gameControls.scene
console.log('Window 1 - My ID:', scene.myPlayerId)
console.log('Window 1 - Team:', scene.getGameState().players.get(scene.myPlayerId).team)

// Switch through teammates
scene.switchToNextTeammate()
console.log('Window 1 - Now controlling:', scene.controlledPlayerId)
```

4. In window 2 console (same commands)
5. Verify each player can independently switch their own team

## Visual Verification

### What to Look For

1. **Thick Border** = Controlled player (you're moving this one)
2. **Thin Border** = Uncontrolled teammates/opponents
3. **Color Tint** = Moving player is brighter
4. **Responsive Movement** = Controlled player responds instantly to input (no lag)

### Expected Behavior

- Press **Space** (or tap action button) → switches to next teammate
- Border immediately thickens on new controlled player
- Arrow keys/joystick now control the newly selected player
- Player responds smoothly with no network lag

## Keyboard Shortcuts

- **Arrow Keys**: Move controlled player
- **Space**:
  - If you have ball → Shoot
  - If no ball → Switch to next teammate

## Common Issues

If player switching still feels broken:

1. **Check controlledPlayerId**:
   ```javascript
   console.log(window.__gameControls.scene.controlledPlayerId)
   ```

2. **Check borders**:
   ```javascript
   const scene = window.__gameControls.scene
   console.log('Main player border:', scene.player.strokeLineWidth)
   scene.remotePlayers.forEach((s, id) => {
     console.log(`${id} border:`, s.strokeLineWidth)
   })
   ```

3. **Check if sprite exists**:
   ```javascript
   const scene = window.__gameControls.scene
   const controlled = scene.controlledPlayerId
   if (controlled === scene.myPlayerId) {
     console.log('Controlling main player sprite')
   } else {
     const sprite = scene.remotePlayers.get(controlled)
     console.log('Controlling bot sprite:', sprite ? 'exists' : 'MISSING!')
   }
   ```

## Success Criteria

✅ Space bar cycles through all 3 teammates (player1, player1-bot1, player1-bot2)
✅ Visual border updates immediately
✅ Movement input controls the selected player
✅ Multiplayer: Each player controls their own team independently
✅ Auto-switch: When teammate gets ball, control automatically switches

## Report Issues

If you find bugs:
1. Note the controlledPlayerId value
2. Note which scene (Single vs Multiplayer)
3. Describe what you expected vs what happened
4. Check browser console for errors
