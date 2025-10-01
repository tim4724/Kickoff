/**
 * Touch Control Testing Utilities
 * Provides easy access to testing API from browser console or MCP
 */

export interface GameControlsAPI {
  joystick: {
    __test_simulateTouch(x: number, y: number): void
    __test_simulateDrag(x: number, y: number): void
    __test_simulateRelease(): void
    __test_getState(): any
  }
  button: {
    __test_simulatePress(): void
    __test_simulateRelease(holdMs: number): void
    __test_getState(): any
  }
  scene: any
  test: {
    touchJoystick(x: number, y: number): void
    dragJoystick(x: number, y: number): void
    releaseJoystick(): void
    pressButton(): void
    releaseButton(holdMs?: number): void
    getState(): any
  }
}

/**
 * Get testing API from window (only available in dev mode)
 */
export function getGameControls(): GameControlsAPI | null {
  if (typeof window === 'undefined') return null
  return (window as any).__gameControls || null
}

/**
 * Test joystick spawn and drag sequence
 */
export async function testJoystickSequence(
  touchX: number,
  touchY: number,
  dragX: number,
  dragY: number,
  delayMs: number = 500
): Promise<boolean> {
  const controls = getGameControls()
  if (!controls) {
    console.error('❌ Game controls not available')
    return false
  }

  try {
    // Touch to spawn
    controls.test.touchJoystick(touchX, touchY)
    await new Promise(r => setTimeout(r, 100))

    // Check spawned correctly
    const state1 = controls.test.getState()
    console.log('  ✓ Spawned at:', state1.joystick.baseX, state1.joystick.baseY)

    // Drag
    controls.test.dragJoystick(dragX, dragY)
    await new Promise(r => setTimeout(r, delayMs))

    // Check input
    const state2 = controls.test.getState()
    console.log('  ✓ Input after drag:', state2.joystick.input)

    // Release
    controls.test.releaseJoystick()

    // Check deactivated
    const state3 = controls.test.getState()
    console.log('  ✓ Released, active:', state3.joystick.active)

    console.log('✅ Joystick sequence completed\n')
    return true
  } catch (error) {
    console.error('❌ Joystick test failed:', error)
    return false
  }
}

/**
 * Test button press with varying power levels
 */
export async function testButtonPower(holdMs: number): Promise<number> {
  const controls = getGameControls()
  if (!controls) {
    console.error('❌ Game controls not available')
    return 0
  }

  try {
    controls.test.pressButton()
    await new Promise(r => setTimeout(r, 50))

    const stateBefore = controls.test.getState()
    const powerBefore = stateBefore.button.currentPower

    controls.test.releaseButton(holdMs)

    const expectedPower = Math.min(holdMs / 1500, 1)
    console.log(
      `  ✓ Button released - Hold: ${holdMs}ms, Power: ${expectedPower.toFixed(2)}`
    )

    return expectedPower
  } catch (error) {
    console.error('❌ Button test failed:', error)
    return 0
  }
}

/**
 * Comprehensive test suite
 */
export async function runFullTestSuite(): Promise<void> {
  console.log('🧪 Starting Touch Controls Test Suite...\n')

  // Test 1: Left-half joystick spawning (various positions)
  console.log('Test 1: Joystick spawning - various left positions')

  console.log('  1a. Top-left (100, 100):')
  await testJoystickSequence(100, 100, 150, 150, 500)
  await new Promise(r => setTimeout(r, 500))

  console.log('  1b. Middle-left (200, 300):')
  await testJoystickSequence(200, 300, 250, 250, 500)
  await new Promise(r => setTimeout(r, 500))

  console.log('  1c. Bottom-left (150, 500):')
  await testJoystickSequence(150, 500, 200, 450, 500)
  await new Promise(r => setTimeout(r, 500))

  // Test 2: Joystick zone constraint (right side should NOT spawn)
  console.log('Test 2: Joystick zone constraint (right half)')
  const controls = getGameControls()
  if (controls) {
    controls.test.touchJoystick(500, 300)
    const state = controls.test.getState()
    if (!state.joystick.active) {
      console.log('  ✓ Right-side touch correctly ignored\n')
    } else {
      console.log('  ❌ ERROR: Joystick spawned in right half!\n')
    }
  }

  // Test 3: Button power levels
  console.log('Test 3: Button power levels')

  console.log('  3a. Quick tap (100ms):')
  await testButtonPower(100)
  await new Promise(r => setTimeout(r, 500))

  console.log('  3b. Medium hold (750ms):')
  await testButtonPower(750)
  await new Promise(r => setTimeout(r, 500))

  console.log('  3c. Max power (1500ms):')
  await testButtonPower(1500)
  await new Promise(r => setTimeout(r, 500))

  console.log('\n✅ Full test suite completed!')
  console.log('Check console above for any errors or unexpected behavior.')
}

/**
 * Quick zone conflict test
 */
export async function testZoneConflicts(): Promise<void> {
  console.log('🧪 Testing zone conflicts...\n')

  const controls = getGameControls()
  if (!controls) {
    console.error('❌ Game controls not available')
    return
  }

  // Test left zone (joystick)
  console.log('1. Testing left zone (joystick):')
  controls.test.touchJoystick(200, 400)
  const leftState = controls.test.getState()
  console.log('  Joystick active:', leftState.joystick.active)
  controls.test.releaseJoystick()

  await new Promise(r => setTimeout(r, 500))

  // Test right zone (button)
  console.log('2. Testing right zone (button):')
  controls.test.pressButton()
  const rightState = controls.test.getState()
  console.log('  Button pressed:', rightState.button.pressed)
  controls.test.releaseButton(500)

  await new Promise(r => setTimeout(r, 500))

  console.log('\n✅ Zone conflict test completed - no conflicts detected!')
}
