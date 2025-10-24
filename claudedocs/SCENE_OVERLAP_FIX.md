# Scene Overlap Fix - Complete Resolution

**Date**: 2025-10-24
**Issue**: Scene overlap where MenuScene and game scenes (GameScene/SinglePlayerScene/AIOnlyScene) were visible simultaneously
**Status**: FIXED ✅

## Problem Analysis

### Root Cause
The scene transition logic in `SceneRouter.navigateToPath()` was incorrectly starting new scenes without stopping the current scene:

```typescript
// BEFORE (BUGGY CODE)
if (currentScene) {
  currentScene.scene.start(sceneKey)  // BUG: Starts new scene without stopping current
} else {
  this.game.scene.start(sceneKey)
}
```

**Why This Failed:**
1. Phaser's `scene.start(sceneKey)` does NOT automatically stop the current scene when called from another scene
2. This resulted in both scenes running simultaneously and overlapping visually
3. The `scene.start()` method only stops the current scene automatically when called from **within** that scene using `this.scene.start()`

### Additional Issues Found
1. **MenuScene.ts** (line 258): Test auto-start code directly called `this.scene.start('GameScene')` bypassing the router
2. **BaseGameScene.ts** (line 501): Match end screen directly called `this.scene.start('MenuScene')` bypassing the router

## Solution Implemented

### 1. Fixed SceneRouter.navigateToPath()
**File**: `/Users/tim/Projects/Socca2/client/src/utils/SceneRouter.ts` (lines 145-160)

```typescript
// AFTER (FIXED CODE)
// Properly transition scenes - stop current scene first, then start new scene
if (currentScene) {
  const currentKey = currentScene.scene.key
  console.log(`[SceneRouter] Stopping scene: ${currentKey}`)

  // Stop current scene first to prevent overlap
  this.game.scene.stop(currentKey)

  // Then start the new scene
  console.log(`[SceneRouter] Starting scene: ${sceneKey}`)
  this.game.scene.start(sceneKey)
} else {
  // No scene running yet, start the target scene
  console.log(`[SceneRouter] Starting initial scene: ${sceneKey}`)
  this.game.scene.start(sceneKey)
}
```

**Key Changes:**
- Explicitly stop the current scene first using `this.game.scene.stop(currentKey)`
- Then start the new scene using `this.game.scene.start(sceneKey)`
- Added detailed logging for debugging scene transitions
- Ensures only one scene is active at a time

### 2. Fixed MenuScene Test Auto-Start
**File**: `/Users/tim/Projects/Socca2/client/src/scenes/MenuScene.ts` (line 257)

```typescript
// BEFORE
this.scene.start('GameScene')

// AFTER
sceneRouter.navigateTo('GameScene')
```

### 3. Fixed BaseGameScene Match End Screen
**File**: `/Users/tim/Projects/Socca2/client/src/scenes/BaseGameScene.ts` (line 502)

```typescript
// BEFORE
this.scene.start('MenuScene')

// AFTER
sceneRouter.navigateTo('MenuScene')
```

## Verification

### Build Verification
- Client builds successfully with no TypeScript errors
- All scene transition code now routes through SceneRouter
- No direct `this.scene.start()` calls bypass the router

### Test Coverage
Added comprehensive scene overlap prevention tests to `/Users/tim/Projects/Socca2/tests/responsive-ui-navigation.spec.ts`:

1. **only one scene active at a time - menu to game**
   - Verifies menu disappears when navigating to game scene
   - Confirms back button appears in game scene
   - No overlap detected

2. **only one scene active at a time - game to menu**
   - Verifies game scene elements disappear when returning to menu
   - Confirms menu appears properly
   - No overlap detected

3. **rapid scene transitions handle correctly**
   - Tests rapid navigation between scenes
   - Ensures no scene overlap during quick transitions
   - Validates proper cleanup

4. **browser back/forward does not cause scene overlap**
   - Tests browser navigation controls
   - Confirms proper scene switching with browser back/forward
   - No overlap with browser-triggered navigation

## Technical Details

### Phaser Scene Manager Behavior
The fix leverages proper Phaser scene management:

1. **scene.stop(key)**: Stops a scene by key, triggering its shutdown lifecycle
2. **scene.start(key)**: Starts a scene, initializing it fresh
3. **Lifecycle order**: stop() → shutdown() → create() → start()

### Scene Router Flow
```
User Action → sceneRouter.navigateTo()
  → navigateToPath()
    → stop current scene
    → start new scene
  → URL hash updated
```

### Benefits of Fix
1. **Clean transitions**: Only one scene active at a time
2. **Proper cleanup**: Old scene resources are freed via shutdown()
3. **Consistent behavior**: All scene transitions go through router
4. **Browser navigation**: Back/forward buttons work correctly
5. **URL synchronization**: Hash-based routing stays in sync

## Testing Results

### Manual Testing
- Menu → Single Player: Clean transition, no overlap
- Single Player → Menu: Clean transition, no overlap
- Menu → AI-Only: Clean transition, no overlap
- Browser back/forward: Works correctly, no overlap
- Rapid transitions: Handles correctly, no flickering

### Automated Tests
- All existing navigation tests pass
- New scene overlap tests pass
- No regression in other test suites

## Prevention Recommendations

### Code Standards Going Forward
1. **Always use sceneRouter.navigateTo()** for scene transitions
2. **Never use this.scene.start() directly** outside of SceneRouter
3. **Test scene transitions** when adding new navigation paths
4. **Verify no overlap** visually during development

### Code Review Checklist
- [ ] All scene transitions use sceneRouter
- [ ] No direct this.scene.start() calls
- [ ] Scene cleanup is properly implemented in shutdown()
- [ ] URL hash updates correctly
- [ ] No visual overlap during transitions

## Files Modified

1. `/Users/tim/Projects/Socca2/client/src/utils/SceneRouter.ts`
   - Fixed navigateToPath() to properly stop scenes before starting new ones

2. `/Users/tim/Projects/Socca2/client/src/scenes/MenuScene.ts`
   - Updated test auto-start to use sceneRouter

3. `/Users/tim/Projects/Socca2/client/src/scenes/BaseGameScene.ts`
   - Updated match end screen to use sceneRouter

4. `/Users/tim/Projects/Socca2/tests/responsive-ui-navigation.spec.ts`
   - Added comprehensive scene overlap prevention tests

## Summary

The scene overlap issue has been completely resolved by:
1. Fixing the core scene transition logic in SceneRouter
2. Ensuring all scene transitions route through the SceneRouter
3. Adding comprehensive tests to prevent regression
4. Documenting proper patterns for future development

The fix is minimal, focused, and addresses the root cause without introducing side effects. All scene transitions now properly stop the current scene before starting the next one, ensuring clean visual transitions and proper resource cleanup.
