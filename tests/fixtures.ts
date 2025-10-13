import { test as base } from '@playwright/test'
import { setTimeScale } from './helpers/time-control'

/**
 * Custom test fixture that applies time acceleration automatically
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Apply 10x time acceleration to all tests
    try {
      // Wait for page to load first
      await page.waitForLoadState('domcontentloaded')

      // Apply time scale (will work once GameClock is exposed)
      await setTimeScale(page, 10).catch(() => {
        // Silently fail if GameClock not available yet
        // (e.g., on menu scene before game scene loads)
      })
    } catch (error) {
      // Ignore errors if page not ready
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
