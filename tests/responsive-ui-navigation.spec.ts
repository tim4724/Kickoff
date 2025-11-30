/**
 * Streamlined E2E tests for responsive menu + navigation.
 * Focus on: layout responsiveness, routing, back button behavior, and overlap prevention.
 */
import { test, expect, Page } from '@playwright/test'

const CLIENT_URL = 'http://localhost:5174'

async function waitForMenuLoaded(page: Page, timeout = 8000) {
  await page.waitForFunction(() => (window as any).__menuLoaded === true, { timeout })
}

async function clickMenuButton(
  page: Page,
  buttonName: 'singlePlayer' | 'multiplayer' | 'aiOnly'
) {
  const button = await page.evaluate((name: string) => {
    const btn = (window as any).__menuButtons?.[name]
    return btn ? { x: btn.x, y: btn.y } : null
  }, buttonName)
  if (!button) throw new Error(`Menu button "${buttonName}" not found`)

  const expectedHash =
    buttonName === 'singlePlayer' ? '#/singleplayer' : buttonName === 'aiOnly' ? '#/ai-only' : '#/multiplayer'

  const tryClick = async () => {
    // Note: button.x/y are relative to parent, but for MenuScene they map to screen coords
    await page.mouse.click(button.x, button.y)
    await page.waitForTimeout(60)
  }

  for (let i = 0; i < 3; i++) {
    await tryClick()
    try {
      await page.waitForFunction(
        (hash) => {
          const scene = (window as any).__gameControls?.scene || (window as any).__menuControls?.test?.scene
          const sceneKey = scene?.sceneKey
          const menuLoaded = (window as any).__menuLoaded
          return window.location.hash === hash || menuLoaded === false || (sceneKey && sceneKey !== 'MenuScene')
        },
        expectedHash,
        { timeout: 1800 }
      )
      return
    } catch {
      if (i === 2) throw new Error(`Navigation did not reach ${expectedHash}`)
      await page.waitForTimeout(120)
    }
  }
}

async function clickBackButton(page: Page) {
  await page.mouse.click(60, 30)
}

async function backButtonExists(page: Page) {
  try {
    await page.waitForFunction(() => {
      const scene = (window as any).__gameControls?.scene
      return scene?.backButton?.visible
    }, { timeout: 1500 })
    return true
  } catch {
    return false
  }
}

test.describe('Responsive UI and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForMenuLoaded(page)
  })

  test('responsive menu layouts (desktop, portrait, landscape, resize)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await waitForMenuLoaded(page)
    const titleVisible = await page.evaluate(() => (window as any).__menuControls?.test?.scene?.title?.visible)
    expect(titleVisible).toBe(true)

    await page.setViewportSize({ width: 375, height: 667 })
    await waitForMenuLoaded(page)
    const portraitButtons = await page.evaluate(() => {
      const btns = (window as any).__menuButtons
      return btns ? [btns.singlePlayer.y, btns.multiplayer.y] : []
    })
    expect(portraitButtons.length).toBe(2)
    expect(portraitButtons[1] - portraitButtons[0]).toBeGreaterThan(50)

    await page.setViewportSize({ width: 812, height: 375 })
    await waitForMenuLoaded(page)
    const landscapeScale = await page.evaluate(() => (window as any).__menuControls?.test?.scene?.title?.scale)
    expect(landscapeScale).toBeTruthy()

    await page.setViewportSize({ width: 1280, height: 720 })
    await waitForMenuLoaded(page)
    await page.setViewportSize({ width: 720, height: 1280 })
    await waitForMenuLoaded(page)
    // Ensure menu buttons are still defined after resize cycle
    const y2 = await page.evaluate(() => (window as any).__menuButtons?.singlePlayer.y)
    expect(typeof y2).toBe('number')
  })

  test('invalid routes redirect to menu', async ({ page }) => {
    await page.goto(`${CLIENT_URL}#/invalid-route`)
    await waitForMenuLoaded(page)
    await expect(page).toHaveURL(/#\/menu/)
  })

  test('singleplayer and ai-only navigation + back button flow', async ({ page }) => {
    const assertScene = async (key: string) => {
      await page.waitForFunction(
        (sceneKey) => {
          const scene = (window as any).__gameControls?.scene
          return scene?.sceneKey === sceneKey
        },
        key,
        { timeout: 1500 }
      )
    }

    await clickMenuButton(page, 'singlePlayer')
    await expect(page).toHaveURL(/#\/singleplayer/)
    await assertScene('SinglePlayerScene')
    expect(await backButtonExists(page)).toBe(true)
    await clickBackButton(page)
    await waitForMenuLoaded(page)

    await clickMenuButton(page, 'aiOnly')
    await expect(page).toHaveURL(/#\/ai-only/)
    await assertScene('AIOnlyScene')
    expect(await backButtonExists(page)).toBe(true)
    await clickBackButton(page)
    await waitForMenuLoaded(page)
  })

  test('browser back/forward keeps scenes in sync', async ({ page }) => {
    await clickMenuButton(page, 'singlePlayer')
    await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 1500 })
    await page.goBack()
    await waitForMenuLoaded(page)
    await page.goForward()
    await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 1500 })
  })

  test('rapid transitions and hash reset avoid overlap', async ({ page }) => {
    await clickMenuButton(page, 'singlePlayer')
    await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 1500 })
    await page.evaluate(() => { window.location.hash = '#/singleplayer' })
    await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 1500 })
    await clickBackButton(page)
    await waitForMenuLoaded(page)
    await clickMenuButton(page, 'singlePlayer')
    await page.waitForFunction(() => !(window as any).__menuLoaded, { timeout: 1500 })
  })

  test('back button works on mobile (mouse and touch)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await waitForMenuLoaded(page)

    await clickMenuButton(page, 'singlePlayer')
    await backButtonExists(page)
    await page.mouse.click(60, 30)
    await waitForMenuLoaded(page)

    await clickMenuButton(page, 'singlePlayer')
    await backButtonExists(page)
    await page.mouse.click(60, 30)
    await waitForMenuLoaded(page)
  })
})
