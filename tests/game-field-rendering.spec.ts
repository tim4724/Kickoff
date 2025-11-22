import { test, expect } from '@playwright/test'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

async function expectCanvasSize(page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto(CLIENT_URL)
  await waitScaled(page, 800)
  const box = await page.locator('canvas').first().boundingBox()
  expect(box).toBeTruthy()
  expect(Math.round(box!.width)).toBe(width)
  expect(Math.round(box!.height)).toBe(height)
}

test.describe('Game field rendering (smoke)', () => {
  test('desktop 16:9 fills viewport', async ({ page }) => {
    await expectCanvasSize(page, 1920, 1080)
  })

  test('mobile portrait fills viewport', async ({ page }) => {
    await expectCanvasSize(page, 390, 844)
  })
})
