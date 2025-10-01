# 🧪 Touch Controls Testing API

**Purpose**: Programmatic testing interface for Phaser touch controls
**Availability**: Development mode only (`import.meta.env.DEV`)
**Access**: `window.__gameControls` (browser console or MCP)

---

## 📋 Overview

### Why This API Exists

Phaser's Canvas-based input system doesn't respond to simulated DOM events (PointerEvents, TouchEvents). Standard automated testing tools like Playwright cannot trigger Phaser's internal input handlers.

This API provides **programmatic access** to touch control methods, bypassing Phaser's event system entirely for testing purposes.

### API Architecture

```typescript
window.__gameControls = {
  joystick: VirtualJoystick,      // Direct control instance
  button: ActionButton,            // Direct control instance
  scene: GameScene,                // Scene reference
  test: {                          // Convenience test helpers
    touchJoystick(x, y),
    dragJoystick(x, y),
    releaseJoystick(),
    pressButton(),
    releaseButton(holdMs),
    getState()
  }
}
```

---

## 🎮 VirtualJoystick Testing API

### Methods

#### `__test_simulateTouch(x: number, y: number)`
Simulates a touch at the specified position.

**Parameters**:
- `x` - Touch X coordinate (game space)
- `y` - Touch Y coordinate (game space)

**Behavior**:
- Checks if `x < screenWidth / 2` (left half only)
- Clamps position to 70px margins
- Spawns joystick at touch position
- Activates joystick (visible + active)

**Example**:
```javascript
// Spawn joystick at position (200, 400)
window.__gameControls.joystick.__test_simulateTouch(200, 400)
```

---

#### `__test_simulateDrag(x: number, y: number)`
Simulates dragging the joystick stick to a new position.

**Parameters**:
- `x` - Drag X coordinate (game space)
- `y` - Drag Y coordinate (game space)

**Behavior**:
- Only works if joystick is active
- Updates stick position within max radius
- Clamps stick to 60px from base center
- Updates input values immediately

**Example**:
```javascript
// First spawn joystick
window.__gameControls.joystick.__test_simulateTouch(200, 400)

// Then drag stick to the right
window.__gameControls.joystick.__test_simulateDrag(250, 400)

// Drag up-right
window.__gameControls.joystick.__test_simulateDrag(240, 360)
```

---

#### `__test_simulateRelease()`
Simulates releasing the joystick touch.

**Behavior**:
- Resets stick to base center
- Deactivates joystick
- Hides visual elements
- Clears pointer reference

**Example**:
```javascript
// Release joystick
window.__gameControls.joystick.__test_simulateRelease()
```

---

#### `__test_getState()`
Returns current joystick state for inspection.

**Returns**:
```typescript
{
  active: boolean,          // Is joystick currently active?
  baseX: number,            // Base circle X position
  baseY: number,            // Base circle Y position
  stickX: number,           // Stick circle X position
  stickY: number,           // Stick circle Y position
  input: {                  // Normalized input values
    x: number,              // -1 to 1
    y: number               // -1 to 1
  }
}
```

**Example**:
```javascript
const state = window.__gameControls.joystick.__test_getState()
console.log('Joystick active:', state.active)
console.log('Input:', state.input)
```

---

### Complete Joystick Test Sequence

```javascript
// 1. Spawn joystick at bottom-left
window.__gameControls.joystick.__test_simulateTouch(150, 500)

// 2. Check state
const state1 = window.__gameControls.joystick.__test_getState()
console.log('Spawned at:', state1.baseX, state1.baseY)

// 3. Drag right
window.__gameControls.joystick.__test_simulateDrag(200, 500)

// 4. Check input
const state2 = window.__gameControls.joystick.__test_getState()
console.log('Input:', state2.input)  // Should be {x: ~0.8, y: 0}

// 5. Release
window.__gameControls.joystick.__test_simulateRelease()

// 6. Verify deactivated
const state3 = window.__gameControls.joystick.__test_getState()
console.log('Active:', state3.active)  // Should be false
```

---

## 🎯 ActionButton Testing API

### Methods

#### `__test_simulatePress()`
Simulates pressing the action button.

**Behavior**:
- Sets `isPressed = true`
- Records press start time
- Applies visual feedback (scale 0.9x, darker color)
- Triggers `onPressCallback` if set

**Example**:
```javascript
window.__gameControls.button.__test_simulatePress()
```

---

#### `__test_simulateRelease(holdDurationMs: number = 0)`
Simulates releasing the button after a hold duration.

**Parameters**:
- `holdDurationMs` - How long button was held (milliseconds)

**Behavior**:
- Calculates power: `min(holdDurationMs / 1500, 1)`
- Resets visual feedback (scale 1x, normal color)
- Triggers `onReleaseCallback(power)`
- Resets pressed state

**Example**:
```javascript
// Quick tap (low power)
window.__gameControls.button.__test_simulatePress()
window.__gameControls.button.__test_simulateRelease(100)
// Power: ~0.07

// Medium hold
window.__gameControls.button.__test_simulatePress()
window.__gameControls.button.__test_simulateRelease(750)
// Power: 0.5

// Max power
window.__gameControls.button.__test_simulatePress()
window.__gameControls.button.__test_simulateRelease(1500)
// Power: 1.0
```

---

#### `__test_getState()`
Returns current button state for inspection.

**Returns**:
```typescript
{
  pressed: boolean,         // Is button currently pressed?
  x: number,                // Button X position
  y: number,                // Button Y position
  radius: number,           // Button radius (50)
  currentPower: number,     // Current power level (0-1)
  holdDuration: number      // Current hold duration (seconds)
}
```

**Example**:
```javascript
const state = window.__gameControls.button.__test_getState()
console.log('Button pressed:', state.pressed)
console.log('Current power:', state.currentPower)
```

---

### Complete Button Test Sequence

```javascript
// Test low power (quick tap)
window.__gameControls.button.__test_simulatePress()
const state1 = window.__gameControls.button.__test_getState()
console.log('Pressed:', state1.pressed)  // true

window.__gameControls.button.__test_simulateRelease(100)
// Check console for: "⚽ Shot! Power: 0.07"

// Test medium power
window.__gameControls.button.__test_simulatePress()
await new Promise(r => setTimeout(r, 750))  // Wait 750ms
window.__gameControls.button.__test_simulateRelease(750)
// Check console for: "⚽ Shot! Power: 0.50"

// Test max power
window.__gameControls.button.__test_simulatePress()
await new Promise(r => setTimeout(r, 1500))  // Wait 1.5s
window.__gameControls.button.__test_simulateRelease(1500)
// Check console for: "⚽ Shot! Power: 1.00"
```

---

## 🛠️ Convenience Test Helpers

The `window.__gameControls.test` object provides easier-to-use helper functions:

### `test.touchJoystick(x: number, y: number)`
Spawns joystick at position.

```javascript
window.__gameControls.test.touchJoystick(200, 400)
```

---

### `test.dragJoystick(x: number, y: number)`
Drags joystick stick to position.

```javascript
window.__gameControls.test.dragJoystick(250, 350)
```

---

### `test.releaseJoystick()`
Releases joystick.

```javascript
window.__gameControls.test.releaseJoystick()
```

---

### `test.pressButton()`
Presses action button.

```javascript
window.__gameControls.test.pressButton()
```

---

### `test.releaseButton(holdMs: number = 500)`
Releases button with default 500ms hold.

```javascript
window.__gameControls.test.releaseButton(1000)  // 1 second hold
```

---

### `test.getState()`
Returns complete state of both controls.

**Returns**:
```typescript
{
  joystick: {
    active: boolean,
    baseX: number,
    baseY: number,
    stickX: number,
    stickY: number,
    input: { x: number, y: number }
  },
  button: {
    pressed: boolean,
    x: number,
    y: number,
    radius: number,
    currentPower: number,
    holdDuration: number
  }
}
```

```javascript
const state = window.__gameControls.test.getState()
console.log('Full state:', state)
```

---

## 🧪 Complete Test Examples

### Example 1: Joystick Movement Test

```javascript
console.log('=== Joystick Movement Test ===')

// Spawn at left center
window.__gameControls.test.touchJoystick(200, 300)
console.log('1. Spawned:', window.__gameControls.test.getState().joystick)

// Drag right (move player right)
window.__gameControls.test.dragJoystick(250, 300)
console.log('2. Dragged right:', window.__gameControls.test.getState().joystick.input)

// Drag up-right (diagonal movement)
window.__gameControls.test.dragJoystick(240, 260)
console.log('3. Dragged diagonal:', window.__gameControls.test.getState().joystick.input)

// Release
window.__gameControls.test.releaseJoystick()
console.log('4. Released:', window.__gameControls.test.getState().joystick.active)
```

---

### Example 2: Button Power Test

```javascript
console.log('=== Button Power Test ===')

const testPower = async (holdMs) => {
  window.__gameControls.test.pressButton()
  await new Promise(r => setTimeout(r, holdMs))
  window.__gameControls.test.releaseButton(holdMs)
  console.log(`Hold ${holdMs}ms completed`)
}

// Test power levels
await testPower(100)   // ~0.07 power
await testPower(500)   // ~0.33 power
await testPower(1000)  // ~0.67 power
await testPower(1500)  // 1.0 power
```

---

### Example 3: Zone Conflict Test

```javascript
console.log('=== Zone Conflict Test ===')

// Test left-side (joystick territory)
window.__gameControls.test.touchJoystick(200, 400)
const leftState = window.__gameControls.test.getState()
console.log('Left touch - Joystick active:', leftState.joystick.active)

window.__gameControls.test.releaseJoystick()

// Test right-side (button territory)
window.__gameControls.test.pressButton()
const rightState = window.__gameControls.test.getState()
console.log('Right touch - Button active:', rightState.button.pressed)

window.__gameControls.test.releaseButton()

console.log('✅ No conflicts detected')
```

---

## 🤖 MCP Playwright Testing

### Example Test Script

```typescript
import { test, expect } from '@playwright/test'

test('Touch controls - Joystick spawning', async ({ page }) => {
  // Navigate to game
  await page.goto('http://localhost:5174')
  await page.waitForTimeout(2000)

  // Verify API available
  const apiExists = await page.evaluate(() => {
    return typeof window.__gameControls !== 'undefined'
  })
  expect(apiExists).toBe(true)

  // Test joystick spawning
  const testResult = await page.evaluate(() => {
    const controls = window.__gameControls

    // Touch left side
    controls.test.touchJoystick(200, 400)
    const state1 = controls.test.getState()

    // Drag
    controls.test.dragJoystick(250, 350)
    const state2 = controls.test.getState()

    // Release
    controls.test.releaseJoystick()
    const state3 = controls.test.getState()

    return {
      spawned: state1.joystick.active,
      spawnPosition: {
        x: state1.joystick.baseX,
        y: state1.joystick.baseY
      },
      inputAfterDrag: state2.joystick.input,
      releasedCorrectly: !state3.joystick.active
    }
  })

  // Assertions
  expect(testResult.spawned).toBe(true)
  expect(testResult.spawnPosition.x).toBeCloseTo(200, 0)
  expect(testResult.spawnPosition.y).toBeCloseTo(400, 0)
  expect(testResult.inputAfterDrag.x).toBeGreaterThan(0)
  expect(testResult.releasedCorrectly).toBe(true)
})

test('Touch controls - Button power', async ({ page }) => {
  await page.goto('http://localhost:5174')
  await page.waitForTimeout(2000)

  // Test button power scaling
  const powerTest = await page.evaluate(async () => {
    const controls = window.__gameControls
    const powers = []

    // Test different hold durations
    const testHold = async (holdMs) => {
      controls.test.pressButton()
      await new Promise(r => setTimeout(r, 50))
      const state = controls.test.getState()
      controls.test.releaseButton(holdMs)
      return Math.min(holdMs / 1500, 1)
    }

    powers.push(await testHold(100))   // Quick tap
    powers.push(await testHold(750))   // Medium
    powers.push(await testHold(1500))  // Max

    return powers
  })

  // Verify power scaling
  expect(powerTest[0]).toBeCloseTo(0.067, 1)  // ~0.07
  expect(powerTest[1]).toBeCloseTo(0.5, 1)    // 0.5
  expect(powerTest[2]).toBeCloseTo(1.0, 1)    // 1.0
})
```

---

### MCP Evaluate Examples

```javascript
// Using Playwright MCP browser_evaluate tool

// Test 1: Check API availability
await mcp__playwright__browser_evaluate({
  function: `() => {
    return typeof window.__gameControls !== 'undefined'
  }`
})

// Test 2: Joystick test sequence
await mcp__playwright__browser_evaluate({
  function: `async () => {
    const controls = window.__gameControls

    // Spawn joystick
    controls.test.touchJoystick(200, 400)
    await new Promise(r => setTimeout(r, 500))

    // Drag
    controls.test.dragJoystick(250, 350)
    await new Promise(r => setTimeout(r, 500))

    // Get state
    const state = controls.test.getState()

    // Release
    controls.test.releaseJoystick()

    return {
      success: true,
      joystickInput: state.joystick.input
    }
  }`
})

// Test 3: Button power test
await mcp__playwright__browser_evaluate({
  function: `async () => {
    const controls = window.__gameControls

    controls.test.pressButton()
    await new Promise(r => setTimeout(r, 1000))
    controls.test.releaseButton(1000)

    return { completed: true }
  }`
})
```

---

## 📊 Test Utility Module

Import the test utility module for advanced testing:

```typescript
import {
  getGameControls,
  testJoystickSequence,
  testButtonPower,
  runFullTestSuite
} from './test/TouchTestUtils'

// Get controls
const controls = getGameControls()

// Run individual tests
await testJoystickSequence(200, 400, 250, 350, 500)
await testButtonPower(1000)

// Run full test suite
await runFullTestSuite()
```

---

## 🚨 Troubleshooting

### API Not Available

**Symptom**: `window.__gameControls is undefined`

**Causes**:
1. Game not fully loaded yet
2. Production build (API disabled in production)
3. GameScene not created yet

**Solutions**:
```javascript
// Wait for game to load
await new Promise(r => setTimeout(r, 2000))

// Check if API available
if (typeof window.__gameControls === 'undefined') {
  console.error('Game controls not available - check if DEV mode')
}

// For MCP: Add waitForTimeout before evaluate
await page.waitForTimeout(2000)
```

---

### Test Methods Not Working

**Symptom**: Methods called but nothing happens

**Causes**:
1. Scene not active
2. Controls not initialized
3. Wrong coordinates (outside game area)

**Solutions**:
```javascript
// Check scene active
const sceneActive = window.__gameControls.scene.scene.isActive()

// Check controls initialized
const joystickExists = window.__gameControls.joystick !== null

// Use correct coordinates (game space, not screen space)
// Game is 800x600, may be scaled on screen
```

---

### Console Errors

**Symptom**: Errors in console when calling test methods

**Causes**:
1. TypeScript type errors (ignored in JS console)
2. Null pointer access
3. Methods called in wrong order

**Solutions**:
```javascript
// Always check state before operations
const state = window.__gameControls.test.getState()
if (!state.joystick.active) {
  // Spawn before dragging
  window.__gameControls.test.touchJoystick(200, 400)
}

// Use try-catch for error handling
try {
  window.__gameControls.test.pressButton()
} catch (error) {
  console.error('Button test failed:', error)
}
```

---

## 📝 Best Practices

### 1. Always Check API Availability
```javascript
if (typeof window.__gameControls !== 'undefined') {
  // Run tests
} else {
  console.error('Testing API not available')
}
```

### 2. Wait Between Operations
```javascript
// Bad: Rapid calls may not allow state to update
controls.test.touchJoystick(200, 400)
controls.test.dragJoystick(250, 350)  // May not work

// Good: Add delays
controls.test.touchJoystick(200, 400)
await new Promise(r => setTimeout(r, 100))
controls.test.dragJoystick(250, 350)
```

### 3. Inspect State Regularly
```javascript
// Check state after each operation
controls.test.touchJoystick(200, 400)
console.log('After touch:', controls.test.getState().joystick)

controls.test.dragJoystick(250, 350)
console.log('After drag:', controls.test.getState().joystick)
```

### 4. Clean Up After Tests
```javascript
// Always release controls after testing
controls.test.releaseJoystick()
controls.test.releaseButton()

// Verify clean state
const finalState = controls.test.getState()
console.log('Joystick active:', finalState.joystick.active)  // Should be false
console.log('Button pressed:', finalState.button.pressed)    // Should be false
```

---

## 🎯 Testing Checklist

### Basic Functionality
- [ ] API accessible via window
- [ ] Joystick spawns at touch position
- [ ] Joystick only spawns in left half
- [ ] Stick follows drag within radius
- [ ] Joystick releases correctly
- [ ] Button presses and releases
- [ ] Power scales with hold duration
- [ ] Button only activates in right half

### Integration
- [ ] No conflicts between controls
- [ ] Console logs show expected messages
- [ ] Player movement responds to joystick
- [ ] Ball shoots with correct power
- [ ] State inspection returns accurate data

### MCP Testing
- [ ] Playwright evaluate calls work
- [ ] Async operations complete
- [ ] Screenshots capture correct state
- [ ] No browser console errors

---

**API Version**: 1.0
**Last Updated**: 2025-10-01
**Compatibility**: Development mode only
**Browser**: All modern browsers with Phaser 3 support
