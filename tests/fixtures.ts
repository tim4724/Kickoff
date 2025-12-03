import { test as base } from '@playwright/test'
import { setTimeScale } from './helpers/time-control'

/**
 * Custom test fixture that applies time acceleration automatically
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Run tests at real-time speed for stability
    const TIME_SCALE = 1

    try {
      // Set time scale window variable BEFORE navigation for server-side acceleration
      await page.addInitScript((timeScale) => {
        ;(window as any).__testTimeScale = timeScale
      }, TIME_SCALE)

      console.log(`⏱️  Time acceleration enabled: ${TIME_SCALE}x (client + server)`)
    } catch (error) {
      // Ignore errors if page not ready
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
