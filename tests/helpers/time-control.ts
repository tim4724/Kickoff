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
    return new Promise<void>((resolve, reject) => {
      const app = (window as any).game
      if (!app?.ticker) {
        reject(new Error('PixiJS app not ready'))
        return
      }

      const timeoutMs = Math.max(n * 100, 5000)
      const timer = setTimeout(() => {
        app.ticker.remove(onTick)
        reject(new Error(`waitForFrames(${n}) timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      let remaining = n
      const onTick = () => {
        if (--remaining <= 0) {
          clearTimeout(timer)
          app.ticker.remove(onTick)
          resolve()
        }
      }
      app.ticker.add(onTick)
    })
  }, frameCount)
}
