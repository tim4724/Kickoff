# Multiplayer Implementation - Key Patterns

## Critical Fixes Implemented

### 1. Race-Safe Team Assignment

**Problem**: Simultaneous joins could assign both players to same team

**Solution**: Async lock pattern in `server/src/schema/GameState.ts`

```typescript
private playerAdditionLock: Promise<void> = Promise.resolve()

async addPlayer(sessionId: string): Promise<{ team: Team }> {
  await this.playerAdditionLock  // Serialize additions

  let resolveLock: () => void
  this.playerAdditionLock = new Promise(resolve => resolveLock = resolve)

  try {
    // Atomic team assignment logic
    const blueCount = Array.from(this.players.values()).filter(p => p.team === 'blue').length
    const redCount = Array.from(this.players.values()).filter(p => p.team === 'red').length
    const team: Team = blueCount <= redCount ? 'blue' : 'red'
    // ... create player
    return { team }
  } finally {
    resolveLock!()
  }
}
```

### 2. Connection Handshake Pattern

**Problem**: Clients checked state before server finished initialization

**Solution**: `player_ready` message confirms initialization

**Server** (`server/src/rooms/MatchRoom.ts`):
```typescript
async onJoin(client: Client, options: any) {
  const playerInfo = await this.state.addPlayer(client.sessionId)  // Wait for completion

  client.send('player_ready', {  // Confirm to client
    sessionId: client.sessionId,
    team: playerInfo.team,
  })
}
```

**Client** (`client/src/network/NetworkManager.ts`):
```typescript
this.room.onMessage('player_ready', (message) => {
  this.sessionId = message.sessionId
  this.onPlayerReady?.(message.sessionId, message.team)
})
```

**Tests** (`tests/helpers/room-utils.ts`):
```typescript
export async function waitForPlayerReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as any).__gameControls?.scene
    return scene?.mySessionId &&
           scene?.networkManager?.getState()?.players?.has(scene.mySessionId)
  }, { timeout: 10000 })
}
```

## Single-Player vs Multiplayer

Both modes use the same server logic:

**Single-Player**:
1. Player joins → Assigned to team
2. After 2s timeout if alone → AI opponents created on opposite team
3. Match starts

**Multiplayer**:
1. Player 1 joins → Assigned to blue team (blueCount=0, redCount=0)
2. Player 2 joins → Assigned to red team (blueCount=1, redCount=0)
3. Match starts immediately

## Key Takeaways

1. **Always use async locks** for shared state mutations
2. **Wait for server confirmation** before client-side state checks
3. **Test helpers must synchronize** with server lifecycle
4. **Both game modes** share the same robust implementation

## Related Files

- Server: `server/src/schema/GameState.ts`, `server/src/rooms/MatchRoom.ts`
- Client: `client/src/network/NetworkManager.ts`
- Tests: `tests/helpers/room-utils.ts`
