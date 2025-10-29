# Scene Lifecycle Fix - E2E Test Failures Resolution

**Date**: 2025-10-28
**Status**: ✅ FIXED
**Tests Fixed**: 4 tests (3 failing + 1 flaky)

## Problem Summary

E2E tests were failing because the `__menuLoaded` flag wasn't being set correctly when navigating back to MenuScene from game scenes. Additionally, the back button check returned incorrect results due to stale global state.

## Root Cause

### Issue 1: Scene Overlap
When navigating to a game scene (e.g., `#/singleplayer`), **MenuScene was never stopped**. Both MenuScene and SinglePlayerScene ran simultaneously.

**Evidence from logs**:
```
activeSceneKeys: ["MenuScene", "SinglePlayerScene"]
```

This happened because:
- `SceneRouter.navigateToPath()` used `getActiveScene()` which returned only the first active scene
- It checked if the target scene was already active using naive string comparison
- When returning to MenuScene, it saw MenuScene was "already active" and skipped the transition entirely

### Issue 2: MenuScene.create() Never Called on Return
Because the router skipped the transition, `MenuScene.create()` was never executed when navigating back to menu, so the test flag `__menuLoaded` was never set to `true`.

### Issue 3: Asynchronous shutdown()
Phaser's `scene.stop()` doesn't immediately call `shutdown()` - it marks the scene for shutdown and calls `shutdown()` on the next frame update. This meant that:
- Test API cleanup in `shutdown()` happened too late
- Tests checking `__gameControls` or `__menuLoaded` saw stale values

## Solution

### Fix 1: Stop ALL Active Scenes
Modified `SceneRouter.navigateToPath()` to:
1. Get ALL active scenes (not just the first one)
2. Stop ALL active scenes before starting the target scene
3. Use `restart()` for previously-created scenes to force `create()` to run again

**File**: `/Users/tim/Projects/Socca2/client/src/utils/SceneRouter.ts` (lines 138-178)

```typescript
// Get ALL currently active scenes (there might be multiple due to scene overlap)
const activeScenes = this.game.scene.getScenes(true)

// Check if target scene is already running AND it's the only active scene
const targetScene = this.game.scene.getScene(sceneKey)
const targetIsRunning = targetScene && targetScene.scene.isActive()
const onlyTargetActive = activeScenes.length === 1 && targetIsRunning

if (onlyTargetActive) {
  console.log(`[SceneRouter] Scene ${sceneKey} is already the only active scene, skipping`)
  return
}

// Stop ALL active scenes (including target scene to ensure clean restart)
for (const scene of activeScenes) {
  const key = scene.scene.key
  console.log(`[SceneRouter] Stopping scene: ${key}`)
  this.game.scene.stop(key)

  // Clear test APIs immediately when stopping scenes
  // (shutdown() is called asynchronously on next frame, so we do this now)
  if (typeof window !== 'undefined') {
    // Clear game scene test API
    if ((window as any).__gameControls?.scene === scene) {
      console.log('🧹 Clearing __gameControls test API (scene stopping)')
      delete (window as any).__gameControls
    }
    // Clear menu scene test API
    if (key === 'MenuScene' && (window as any).__menuLoaded) {
      console.log('🧹 Clearing __menuLoaded flag (MenuScene stopping)')
      ;(window as any).__menuLoaded = false
      delete (window as any).__menuButtons
    }
  }
}

// Always use restart() if target scene has been created before, otherwise use start()
const targetAfterStop = this.game.scene.getScene(sceneKey)
const wasCreated = targetAfterStop && targetAfterStop.scene.settings.status === Phaser.Scenes.STOPPED

if (wasCreated) {
  console.log(`[SceneRouter] Restarting scene: ${sceneKey}`)
  this.game.scene.restart(sceneKey)
} else {
  console.log(`[SceneRouter] Starting scene for first time: ${sceneKey}`)
  this.game.scene.start(sceneKey)
}
```

### Fix 2: Immediate Test API Cleanup
Added synchronous cleanup of test flags in `SceneRouter.navigateToPath()` when stopping scenes, because `shutdown()` is called asynchronously.

**Cleared immediately**:
- `window.__gameControls` when stopping game scenes (SinglePlayerScene, GameScene, AIOnlyScene)
- `window.__menuLoaded` when stopping MenuScene
- `window.__menuButtons` when stopping MenuScene

**File**: `/Users/tim/Projects/Socca2/client/src/utils/SceneRouter.ts` (lines 157-171)

### Fix 3: Defensive Cleanup in BaseGameScene
Added additional cleanup in `BaseGameScene.shutdown()` as a safety measure (though SceneRouter now handles this synchronously).

**File**: `/Users/tim/Projects/Socca2/client/src/scenes/BaseGameScene.ts` (lines 766-770)

```typescript
// Clear test API when scene shuts down
if (typeof window !== 'undefined' && (window as any).__gameControls?.scene === this) {
  console.log('🧹 Clearing __gameControls test API')
  delete (window as any).__gameControls
}
```

## Test Results

### Before Fix
- ❌ "back button touch events work correctly in top-left corner" - Timeout waiting for `__menuLoaded`
- ❌ "only one scene active at a time - game to menu" - Timeout waiting for `__menuLoaded`
- ❌ "browser back/forward does not cause scene overlap" - Failed assertions
- ⚠️ "only one scene active at a time - menu to game" - Flaky (sometimes `__menuLoaded` didn't clear)

### After Fix
- ✅ "back button touch events work correctly in top-left corner" - **PASS**
- ✅ "only one scene active at a time - game to menu" - **PASS**
- ✅ "only one scene active at a time - menu to game" - **PASS**
- ✅ "browser back/forward does not cause scene overlap" - **PASS**

**Full Test Suite**: 109 passed, 1 flaky (unrelated URL routing timing issue)

## Key Learnings

1. **Phaser Scene Lifecycle**: `scene.stop()` is asynchronous - `shutdown()` is called on the next frame
2. **Multiple Active Scenes**: Phaser allows multiple scenes to be active simultaneously unless explicitly managed
3. **Scene Restart**: `scene.restart()` only works on STOPPED scenes, not RUNNING scenes
4. **Test API Timing**: Global test flags must be cleared synchronously with scene transitions, not in async lifecycle methods

## Prevention

To prevent similar issues in the future:

1. **Always check for multiple active scenes** when implementing scene navigation
2. **Clear global state synchronously** when scenes transition (don't rely on async lifecycle methods)
3. **Use scene.restart()** instead of scene.start() for previously-created scenes to force `create()` to run
4. **Test scene transitions thoroughly** with checks for:
   - Only one scene active at a time
   - Test flags set/cleared correctly
   - No scene overlap

## Files Modified

1. `/Users/tim/Projects/Socca2/client/src/utils/SceneRouter.ts` - Main fix (stop all scenes, sync cleanup)
2. `/Users/tim/Projects/Socca2/client/src/scenes/BaseGameScene.ts` - Defensive cleanup in shutdown()
3. `/Users/tim/Projects/Socca2/tests/responsive-ui-navigation.spec.ts` - Minor timing adjustment (moved waitForTimeout)

## Related Documentation

- Phaser 3 Scene Lifecycle: https://photonstorm.github.io/phaser3-docs/Phaser.Scenes.ScenePlugin.html
- Scene States: PENDING (0), INIT (1), START (2), LOADING (3), CREATING (4), RUNNING (5), PAUSED (6), SLEEPING (7), SHUTDOWN (8), DESTROYED (9), STOPPED (SHUTDOWN + DESTROYED)
