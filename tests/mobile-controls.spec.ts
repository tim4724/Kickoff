import { test, expect } from './fixtures'
import { disableAI, disableAutoSwitch, getPlayerPosition } from './helpers/test-utils'

test.use({ hasTouch: true })

test.describe('Mobile Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout: 30000 })

    // Simulate tap on Single Player button via internal event
    await page.evaluate(() => {
        (window as any).__menuButtons.singlePlayer.emit('pointerup');
    })

    await page.waitForFunction(() => (window as any).__gameControls?.scene?.sceneKey === 'SinglePlayerScene', { timeout: 30000 })
    await disableAI(page)
    await disableAutoSwitch(page)
  });

  test('Virtual Joystick controls player', async ({ page }) => {
    const startPos = await getPlayerPosition(page)

    const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
    const startX = width * 0.15
    const startY = height * 0.75
    const endX = width * 0.25

    // Joystick spawns on touch in left half.
    // Use mouse emulation which triggers pointer events

    // Move to start position (Left side)
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Drag to right
    await page.mouse.move(endX, startY, { steps: 10 });

    // Hold to allow movement accumulation
    await page.waitForTimeout(1000);

    const endPos = await getPlayerPosition(page)

    await page.mouse.up();

    // Expect movement to right
    expect(endPos.x).toBeGreaterThan(startPos.x + 10)
  })
})
