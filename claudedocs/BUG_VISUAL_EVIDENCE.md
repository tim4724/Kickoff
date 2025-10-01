# Visual Evidence: Team Assignment Bug

**Bug ID**: SOCCA2-MULTI-001
**Severity**: CRITICAL
**Status**: OPEN
**Date Found**: 2025-10-01

---

## Visual Evidence

### Client 1 Screenshot
![Client 1](../test-results/multiplayer/2-client1-colors.png)

**What we see**:
- **LEFT**: Two BLUE players (both rectangles are blue)
- **RIGHT**: White ball in center circle
- **BOTTOM RIGHT**: Brown touch joystick

**Expected**: One BLUE local player + one RED remote player
**Actual**: Two BLUE players ❌

---

### Client 2 Screenshot
![Client 2](../test-results/multiplayer/2-client2-colors.png)

**What we see**:
- **CENTER-LEFT**: BLUE player (Client 2's local player)
- **RIGHT**: RED player (Client 1's remote player)
- **CENTER**: White ball in center circle

**Expected**: RED local player + BLUE remote player
**Actual**: BLUE local player ❌ + RED remote player ✅

---

## Analysis

### Client 1 View
```
Position        | Team Color | Expected | Actual  | Status
----------------|------------|----------|---------|--------
x=150 (left)    | BLUE       | BLUE     | BLUE    | ✅ OK
x=150 (left)    | BLUE       | RED      | BLUE    | ❌ BUG
```
Both players appear at x=150 (left side), both BLUE

### Client 2 View
```
Position        | Team Color | Expected | Actual  | Status
----------------|------------|----------|---------|--------
x=300 (center)  | BLUE       | RED      | BLUE    | ❌ BUG
x=650 (right)   | RED        | BLUE     | RED     | ❌ BUG (wrong position)
```

---

## Root Cause

**File**: `client/src/scenes/GameScene.ts:660`

```typescript
private async connectToMultiplayer() {
  // ... connection logic ...
  this.updateLocalPlayerColor()  // ❌ CALLED TOO EARLY
  // Player not in server state yet → returns early → never called again
}
```

**Race Condition Timeline**:
```
1. Client connects to server
2. updateLocalPlayerColor() called immediately
3. Server state not yet synchronized
4. Player not found in state → function returns early
5. Player color stays at default BLUE (0x0066ff)
6. Color never updated again ❌
```

---

## Server Logs (Correct Behavior)

```
Added player ALjrrLr4a to team blue  ✅
Added player o5ELUwdJH to team red   ✅
```

Server correctly assigns:
- First player (ALjrrLr4a) → BLUE team
- Second player (o5ELUwdJH) → RED team

**Problem**: Client doesn't receive/apply this team assignment

---

## Fix

**Event-based color update** in `setupNetworkListeners()`:

```typescript
this.networkManager.on('stateChange', (state: any) => {
  // Update color when player appears in state
  if (this.mySessionId && state.players?.has(this.mySessionId)) {
    const localPlayer = state.players.get(this.mySessionId)
    const expectedColor = localPlayer.team === 'blue' ? 0x0066ff : 0xff4444

    if (this.playerTeamColor !== expectedColor) {
      this.playerTeamColor = expectedColor
      this.player.setFillStyle(this.playerTeamColor)
      console.log(`✅ Color updated to ${localPlayer.team}`)
    }
  }

  this.updateFromServerState(state)
})
```

Remove premature call:
```typescript
// DELETE THIS LINE from connectToMultiplayer():
// this.updateLocalPlayerColor()
```

---

## Verification

After fix, Client 2 screenshot should show:
- **CENTER-LEFT**: RED player (local)
- **LEFT**: BLUE player (remote)

---

**Visual Evidence Files**:
- `test-results/multiplayer/2-client1-colors.png`
- `test-results/multiplayer/2-client2-colors.png`
