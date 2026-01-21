import { test, expect } from './fixtures'
import { getPlayerPosition } from './helpers/test-utils'
import { waitForPlayerMovement } from './helpers/wait-utils'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.use({ hasTouch: true })

test.describe('Mobile Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToSinglePlayer(page)
  });

  test('Virtual Joystick controls player', async ({ page }) => {
    const startPos = await getPlayerPosition(page)

    const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
    const startX = width * 0.15
    const startY = height * 0.75
    const endX = width * 0.25

    // Use internal test API for stability in CI
    await page.evaluate(({ x, y, tx, ty }) => {
        const controls = (window as any).__gameControls;
        if (controls.test.touchJoystick) {
            controls.test.touchJoystick(x, y);
            controls.test.dragJoystick(tx, ty);
        }
    }, { x: startX, y: startY, tx: endX, ty: startY });

    // Wait for player to actually move (condition-based, not arbitrary timeout)
    await waitForPlayerMovement(page, startPos.x, startPos.y, 10, 5000)

    const endPos = await getPlayerPosition(page)

    // Release
    await page.evaluate(() => {
        const controls = (window as any).__gameControls;
        if (controls.test.releaseJoystick) controls.test.releaseJoystick();
    });

    // Expect movement to right
    expect(endPos.x).toBeGreaterThan(startPos.x + 10)
  })
})
