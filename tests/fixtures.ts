import { test as base } from '@playwright/test'
import { setTimeScale } from './helpers/time-control'

/**
 * Custom test fixture that applies time acceleration automatically
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Apply 5x time acceleration to all tests
    const TIME_SCALE = 5

    try {
      // Set time scale window variable BEFORE navigation for server-side acceleration
      await page.addInitScript((timeScale) => {
        ;(window as any).__testTimeScale = timeScale
      }, TIME_SCALE)

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded')

      // Apply client-side time acceleration
      await setTimeScale(page, TIME_SCALE).catch(() => {
        // Silently fail if GameClock not available yet
      })

      console.log(`⏱️  Time acceleration enabled: ${TIME_SCALE}x (client + server)`)
    } catch (error) {
      // Ignore errors if page not ready
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
