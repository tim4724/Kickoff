import { Page } from '@playwright/test'

/**
 * Wait for N actual PixiJS ticker frames to process.
 * Each frame runs the full update loop (physics, AI, rendering).
 *
 * Use this only for small settle delays (1-5 frames after teleport).
 * For "wait until X happens", prefer page.waitForFunction() instead —
 * it's faster (resolves immediately) and more reliable.
 *
 * @param page Playwright page
 * @param frameCount Number of PixiJS frames to wait for
 */
export async function waitForFrames(page: Page, frameCount: number): Promise<void> {
  await page.evaluate((n) => {
    return new Promise<void>(resolve => {
      const app = (window as any).game
      let remaining = n
      const onTick = () => {
        if (--remaining <= 0) {
          app.ticker.remove(onTick)
          resolve()
        }
      }
      app.ticker.add(onTick)
    })
  }, frameCount)
}
