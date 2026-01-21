import { test, expect } from './fixtures'
import { movePlayer, getPlayerPosition } from './helpers/test-utils'
import { navigateToSinglePlayer } from './helpers/room-utils'

test.describe('Gameplay Mechanics (Single Player)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToSinglePlayer(page)
  });

  test('Player movement', async ({ page }) => {
    const startPos = await getPlayerPosition(page)

    // Move Right
    await movePlayer(page, 'ArrowRight', 500)

    const endPos = await getPlayerPosition(page)

    expect(endPos.x).toBeGreaterThan(startPos.x)
    expect(endPos.y).toBeCloseTo(startPos.y, 1) // Should barely move Y
  });

})
