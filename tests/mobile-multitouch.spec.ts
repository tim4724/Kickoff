/**
 * Verifies we can press the action button while holding the joystick (multi-touch).
 * Uses real TouchEvents to exercise Phaser's touch pipeline instead of test shims.
 */
import { test, expect } from './fixtures'

// Enable touch emulation so Phaser's TouchManager is active
test.use({ hasTouch: true })

const JOYSTICK_FRACTION_X = 0.25
const BUTTON_FRACTION_X = 0.75
const TOUCH_FRACTION_Y = 0.8

// Helper function to perform the multitouch test logic
async function performMultitouchTest(page: any) {
  // Wait for test API to be available
  await page.waitForFunction(() => (window as any).__gameControls?.test)

  // Dismiss fullscreen splash if it appears (mobile touch devices)
  const splashButton = page.locator('#fullscreen-splash button')
  if (await splashButton.count()) {
    await splashButton.click({ trial: false }).catch(() => { })
  }

  const canvas = await page.$('canvas')
  if (!canvas) throw new Error('Game canvas not found')

  // Compute coordinates in left/right halves of the canvas
  const coords = await canvas.evaluate((c: any, [jx, bx, ty]: any) => {
    const rect = c.getBoundingClientRect()
    const left = rect.left + rect.width * jx
    const right = rect.left + rect.width * bx
    const y = rect.top + rect.height * ty
    return { left, right, y }
  }, [JOYSTICK_FRACTION_X, BUTTON_FRACTION_X, TOUCH_FRACTION_Y])

  // Helper to build a Touch object inside the page
  const createTouch = (id: number, x: number, y: number) =>
    page.evaluateHandle(
      ({ touchId, x, y }: any) =>
        new Touch({
          identifier: touchId,
          target: document.querySelector('canvas')!,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
          screenX: x,
          screenY: y,
        }),
      { touchId: id, x, y }
    )

  // Touch 1: spawn joystick on the left
  const touch1 = await createTouch(1, coords.left, coords.y)
  await canvas.evaluate(
    (c: any, t: any) => {
      const e = new TouchEvent('touchstart', { touches: [t], changedTouches: [t] })
      c.dispatchEvent(e)
    },
    touch1
  )

  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__gameControls?.test.getState().joystick.active)
    )
    .toBeTruthy()

  // Touch 2: press action button on the right while joystick is held
  const touch2 = await createTouch(2, coords.right, coords.y)
  await canvas.evaluate(
    (c: any, [t1, t2]: any) => {
      const e = new TouchEvent('touchstart', { touches: [t1, t2], changedTouches: [t2] })
      c.dispatchEvent(e)
    },
    [touch1, touch2]
  )

  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__gameControls?.test.getState().button.pressed)
    )
    .toBeTruthy()

  // Clean up both touches
  await canvas.evaluate(
    (c: any, [t1, t2]: any) => {
      c.dispatchEvent(new TouchEvent('touchend', { touches: [t2], changedTouches: [t1] }))
      c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t2] }))
    },
    [touch1, touch2]
  )
}

test('supports simultaneous joystick + action button touches', async ({ page }) => {
  await page.goto('/#/singleplayer')

  // Skip gracefully if the browser cannot construct Touch events
  const hasTouch = await page.evaluate(() => typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined')
  test.skip(!hasTouch, 'Touch constructor unavailable in this browser')

  // Perform the test for the first time
  await performMultitouchTest(page)

  // --- Test scene transitions ---
  const sceneLoads = 3
  for (let i = 0; i < sceneLoads; i++) {
    console.log(`🔄 Navigating to menu and back, iteration ${i + 1}/${sceneLoads}`)

    // Navigate to menu
    await page.evaluate(() => (window as any).__gameControls.backButton.emit('pointerdown'))
    await page.waitForURL('**/#/menu')
    // Wait for menu test API to be available
    await page.waitForFunction(() => (window as any).__menuControls?.test)

    // Navigate back to single player
    await page.evaluate(async () => {
      const button = (window as any).__menuControls.test.getMenuElements().singlePlayerButton
      button.emit('pointerdown')
      // Add a short delay to ensure the pointerup is registered correctly
      await new Promise(resolve => setTimeout(resolve, 50))
      button.emit('pointerup')
    })
    await page.waitForURL('**/#/singleplayer')


    // Perform the multitouch test again
    await performMultitouchTest(page)
  }
})
