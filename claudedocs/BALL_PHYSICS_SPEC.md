# Ball Physics Specification

## Overview

The Socca2 ball physics system implements server-authoritative possession and magnetism mechanics to ensure synchronized gameplay across all clients.

## Key Principles

1. **Server Authority**: All ball state (position, velocity, possession) is computed on the server
2. **Client Synchronization**: Clients receive ball updates and render them locally
3. **Continuous Magnetism**: Ball sticks to player continuously while possessed, not just when stationary
4. **Direction-Based Shooting**: Ball is shot in the direction the player is facing, not toward ball position

## Ball State

```typescript
class Ball extends Schema {
  x: number                  // Ball X position (0-800)
  y: number                  // Ball Y position (0-600)
  velocityX: number          // Ball X velocity (px/s)
  velocityY: number          // Ball Y velocity (px/s)
  possessedBy: string        // Session ID of possessing player (empty if free)
}
```

## Possession Mechanics

### Gaining Possession

A player gains possession when:
- Ball is free (`possessedBy === ''`)
- Player is within `POSSESSION_RADIUS` (30px) of ball
- First player to enter radius gets possession (first-come-first-served)

### Maintaining Possession

While possessed:
1. Ball position is updated every frame to stick in front of player
   - Distance: 25px from player center
   - Direction: Player's facing direction (`player.direction`)
   - Formula: `ball.x = player.x + cos(direction) * 25`
             `ball.y = player.y + sin(direction) * 25`

2. Ball velocity is zeroed (ball moves with player, not independently)
   - `ball.velocityX = 0`
   - `ball.velocityY = 0`

3. Ball follows player through all movements
   - No delay or lag
   - Instant position updates
   - Works for all movement directions

### Releasing Possession

Possession is released when:
- Player shoots (action button pressed)
- Player disconnects
- Distance between player and ball exceeds 50px (safety check)

## Shooting Mechanics

When a player shoots:

1. **Possession Check**: Only players with possession can shoot
   - Check: `ball.possessedBy === player.id`

2. **Direction Calculation**: Use player's facing direction
   ```typescript
   const dx = Math.cos(player.direction)
   const dy = Math.sin(player.direction)
   ```

3. **Velocity Application**: Apply shoot speed with power multiplier
   ```typescript
   const power = 0.8 // Can be adjusted based on button hold duration
   ball.velocityX = dx * SHOOT_SPEED * power  // SHOOT_SPEED = 400
   ball.velocityY = dy * SHOOT_SPEED * power
   ```

4. **Possession Release**: Clear possession
   ```typescript
   ball.possessedBy = ''
   ```

5. **Player State**: Set player to 'kicking' state
   ```typescript
   player.state = 'kicking'
   ```

## Physics Update Order

Critical: Ball possession must be handled BEFORE independent physics:

```typescript
updatePhysics(dt: number) {
  // 1. Handle ball possession FIRST
  this.updateBallPossession()

  // 2. Only apply physics if ball is NOT possessed
  if (this.ball.possessedBy === '') {
    // Apply friction
    this.ball.velocityX *= BALL_FRICTION  // 0.98
    this.ball.velocityY *= BALL_FRICTION

    // Stop if too slow
    if (Math.abs(this.ball.velocityX) < 1 && Math.abs(this.ball.velocityY) < 1) {
      this.ball.velocityX = 0
      this.ball.velocityY = 0
    }

    // Update position
    this.ball.x += this.ball.velocityX * dt
    this.ball.y += this.ball.velocityY * dt

    // Bounce off boundaries
    // ... boundary collision logic ...
  }

  // 3. Check goals (even when possessed)
  this.checkGoals()
}
```

## Game Configuration

```typescript
const GAME_CONFIG = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PLAYER_SPEED: 200,          // px/s
  BALL_FRICTION: 0.98,        // Applied each frame
  SHOOT_SPEED: 400,           // px/s
  PASS_SPEED: 300,            // px/s (future)
  POSSESSION_RADIUS: 30,      // px
  TICK_RATE: 30,              // Hz
}
```

## Client-Side Rendering

Clients receive ball state updates at 30Hz and render:

1. **Ball Position**: Updated from server state
   ```typescript
   this.ball.x = state.ball.x
   this.ball.y = state.ball.y
   ```

2. **Possession Indicator**: Yellow circle around player with possession
   ```typescript
   if (state.ball.possessedBy === this.mySessionId) {
     this.possessionIndicator.setAlpha(0.6)  // Show indicator
   } else {
     this.possessionIndicator.setAlpha(0)    // Hide indicator
   }
   ```

3. **Ball Sprite**: Follows ball position smoothly
   - Phaser handles interpolation
   - No client-side prediction needed (server-authoritative)

## Edge Cases

### Multiple Players Near Ball

- **First-come-first-served**: First player within 30px gains possession
- **No stealing**: Cannot take possession from another player
- **Possession locked**: Once possessed, ball stays with player until released

### Player Disconnection

- **Automatic Release**: Ball is released when possessing player disconnects
  ```typescript
  removePlayer(sessionId: string) {
    if (this.ball.possessedBy === sessionId) {
      this.ball.possessedBy = ''
    }
    this.players.delete(sessionId)
  }
  ```

### Ball Out of Bounds

- **Bouncing**: Ball bounces off boundaries (except goal zones)
- **Goals**: Ball entering goal zone triggers scoring
- **Possession Maintained**: Player keeps possession during wall bounces

### Action Without Possession

If player shoots without possession:
- Check if close enough to gain possession (< 30px)
- If yes, gain possession immediately
- If no, log warning and ignore action

## Testing

### Possession Detection Test

1. Player starts at team spawn position
2. Player moves toward ball at center (400, 300)
3. Loop movement until within 30px (max 30 seconds)
4. Verify `ball.possessedBy === playerSessionId`

### Ball Magnetism Test

1. Player gains possession
2. Player moves in direction
3. Verify ball maintains 25px offset in front of player
4. Verify ball.velocity === (0, 0) while possessed

### Shooting Test

1. Player has possession
2. Player presses action button
3. Verify ball velocity becomes non-zero
4. Verify ball moves in player's facing direction
5. Verify possession is released

## Future Enhancements

1. **Pass Mechanics**: Lower power for passing to teammates
2. **Power Charging**: Hold action button to increase shoot power
3. **Dribbling**: Slight ball movement while possessed for visual effect
4. **Tackle Mechanics**: Allow stealing possession under certain conditions
5. **Ball Trails**: Visual effects for ball movement

## Implementation Files

- **`server/src/schema/GameState.ts`**: Ball physics and possession logic
- **`server/src/rooms/MatchRoom.ts`**: Game loop and input handling
- **`client/src/scenes/GameScene.ts`**: Ball rendering and possession indicator
- **`client/src/network/NetworkManager.ts`**: State synchronization
- **`tests/multiplayer-network-sync.spec.ts`**: E2E possession tests

---

**Version**: 1.0
**Date**: 2025-10-01
**Status**: Implemented and tested
