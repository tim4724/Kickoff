/**
 * Orientation resilience smoke tests.
 * Verifies UI survives portrait/landscape flips and back button works.
 */
import { test, expect, Page } from '@playwright/test'

const CLIENT_URL = 'http://localhost:5174'

async function waitForMenuLoaded(page: Page, timeout = 8000) {
  await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout })
}

async function clickMenuButton(page: Page, name: 'singlePlayer' | 'multiplayer') {
  const button = await page.evaluate((n: string) => (window as any).__menuButtons?.[n], name)
  if (!button) throw new Error(`Menu button ${name} not found`)
  for (let i = 0; i < 2; i++) {
    await page.mouse.click(button.x, button.y)
    try {
      await page.waitForFunction(
        (n) => {
          const hash = window.location.hash
          return n === 'singlePlayer' ? hash === '#/singleplayer' : hash === '#/multiplayer'
        },
        name,
        { timeout: 800 }
      )
      return
    } catch {
      if (i === 1) throw new Error(`Navigation failed for ${name}`)
      await page.waitForTimeout(100)
    }
  }
}

async function backButtonExists(page: Page) {
  return await page.evaluate(() => {
    const scene = (window as any).__gameControls?.scene
    return !!scene?.backButton
  })
}

async function clickBackButton(page: Page) {
  await page.mouse.click(60, 30)
}

test.describe('Orientation Changes During Gameplay', () => {
  test('Singleplayer survives orientation flips and back button works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(CLIENT_URL)
    await waitForMenuLoaded(page)

    await clickMenuButton(page, 'singlePlayer')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('#/singleplayer')
    expect(await backButtonExists(page)).toBe(true)

    await page.setViewportSize({ width: 667, height: 375 })
    await page.waitForTimeout(200)
    expect(await backButtonExists(page)).toBe(true)

    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(200)
    expect(await backButtonExists(page)).toBe(true)

    await clickBackButton(page)
    await waitForMenuLoaded(page)
  })

  test('Multiplayer scene stays active after rotation', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(CLIENT_URL)
    await waitForMenuLoaded(page)

    await clickMenuButton(page, 'multiplayer')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('#/multiplayer')

    await page.setViewportSize({ width: 740, height: 360 })
    await page.waitForTimeout(200)

    const activeScene = await page.evaluate(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.scene?.key
    })
    expect(activeScene).toBe('MultiplayerScene')
  })
})
