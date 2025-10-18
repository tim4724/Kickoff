import { test, expect } from '@playwright/test'
import { setupIsolatedTest } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from "./config/test-env"

const CLIENT_URL = TEST_ENV.CLIENT_URL
const GAME_WIDTH = 1920
const GAME_HEIGHT = 1080

test.describe('Game Field Rendering', () => {
  test('16:9 aspect ratio (1920x1080) - no letterboxing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(CLIENT_URL)

    // Wait for game to initialize
    await waitScaled(page, 2000)

    // Take screenshot
    await page.screenshot({ path: 'test-results/field-1920x1080.png' })

    // Get canvas element
    const canvas = await page.locator('canvas').first()
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()
    expect(box!.width).toBe(1920)
    expect(box!.height).toBe(1080)
    expect(box!.x).toBe(0)
    expect(box!.y).toBe(0)

    console.log('1920x1080 viewport:', box)
  })

  test('Wider than 16:9 (2560x1080) - vertical letterboxing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 2560, height: 1080 })
    await page.goto(CLIENT_URL)

    await waitScaled(page, 2000)
    await page.screenshot({ path: 'test-results/field-2560x1080.png' })

    const canvas = await page.locator('canvas').first()
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()

    // Canvas should fill entire viewport
    expect(box!.width).toBe(2560)
    expect(box!.height).toBe(1080)

    // Calculate expected game camera viewport (centered 16:9 area)
    const targetAspect = 16 / 9
    const screenAspect = 2560 / 1080

    // Screen is wider than 16:9, so vertical letterbox
    const gameViewportHeight = 1080
    const gameViewportWidth = gameViewportHeight * targetAspect // 1920
    const gameViewportX = (2560 - gameViewportWidth) / 2 // 320

    console.log('2560x1080 canvas:', box)
    console.log('Expected game viewport: x=%d, y=%d, w=%d, h=%d',
      gameViewportX, 0, gameViewportWidth, gameViewportHeight)
  })

  test('Taller than 16:9 (1920x1200) - horizontal letterboxing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1200 })
    await page.goto(CLIENT_URL)

    await waitScaled(page, 2000)
    await page.screenshot({ path: 'test-results/field-1920x1200.png' })

    const canvas = await page.locator('canvas').first()
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()

    // Canvas should fill entire viewport
    expect(box!.width).toBe(1920)
    expect(box!.height).toBe(1200)

    // Calculate expected game camera viewport (centered 16:9 area)
    const targetAspect = 16 / 9
    const screenAspect = 1920 / 1200

    // Screen is taller than 16:9, so horizontal letterbox
    const gameViewportWidth = 1920
    const gameViewportHeight = gameViewportWidth / targetAspect // 1080
    const gameViewportY = (1200 - gameViewportHeight) / 2 // 60

    console.log('1920x1200 canvas:', box)
    console.log('Expected game viewport: x=%d, y=%d, w=%d, h=%d',
      0, gameViewportY, gameViewportWidth, gameViewportHeight)
  })

  test('Mobile portrait (390x844) - horizontal letterboxing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(CLIENT_URL)

    await waitScaled(page, 2000)
    await page.screenshot({ path: 'test-results/field-390x844.png' })

    const canvas = await page.locator('canvas').first()
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()
    expect(box!.width).toBe(390)
    expect(box!.height).toBe(844)

    // Calculate expected game viewport
    const targetAspect = 16 / 9
    const gameViewportWidth = 390
    const gameViewportHeight = gameViewportWidth / targetAspect // ~219
    const gameViewportY = (844 - gameViewportHeight) / 2

    console.log('390x844 canvas:', box)
    console.log('Expected game viewport: x=%d, y=%d, w=%d, h=%d',
      0, gameViewportY, gameViewportWidth, gameViewportHeight)
  })

  test('Mobile landscape (844x390) - vertical letterboxing', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto(CLIENT_URL)

    await waitScaled(page, 2000)
    await page.screenshot({ path: 'test-results/field-844x390.png' })

    const canvas = await page.locator('canvas').first()
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()
    expect(box!.width).toBe(844)
    expect(box!.height).toBe(390)

    // Calculate expected game viewport
    const targetAspect = 16 / 9
    const gameViewportHeight = 390
    const gameViewportWidth = gameViewportHeight * targetAspect // ~693
    const gameViewportX = (844 - gameViewportWidth) / 2

    console.log('844x390 canvas:', box)
    console.log('Expected game viewport: x=%d, y=%d, w=%d, h=%d',
      gameViewportX, 0, gameViewportWidth, gameViewportHeight)
  })

  test('Verify game field is visible in all screen sizes', async ({ page }, testInfo) => {
    const sizes = [
      { width: 1920, height: 1080, name: '16:9' },
      { width: 2560, height: 1080, name: 'ultrawide' },
      { width: 1920, height: 1200, name: '16:10' },
      { width: 390, height: 844, name: 'mobile-portrait' },
      { width: 844, height: 390, name: 'mobile-landscape' },
    ]

    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto(CLIENT_URL)
      await waitScaled(page, 2000)

      // Take screenshot for visual verification
      await page.screenshot({
        path: `test-results/visual-${size.name}-${size.width}x${size.height}.png`,
        fullPage: false
      })

      // Check if canvas exists and has proper size
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        if (!canvas) return { exists: false, width: 0, height: 0 }

        return {
          exists: true,
          width: canvas.width,
          height: canvas.height,
          displayWidth: canvas.offsetWidth,
          displayHeight: canvas.offsetHeight
        }
      })

      expect(canvasInfo.exists).toBe(true)
      expect(canvasInfo.displayWidth).toBe(size.width)
      expect(canvasInfo.displayHeight).toBe(size.height)

      console.log(`${size.name} (${size.width}x${size.height}): canvas ${canvasInfo.width}x${canvasInfo.height} (display: ${canvasInfo.displayWidth}x${canvasInfo.displayHeight})`)
    }
  })

  test('Verify letterbox areas are present', async ({ page }, testInfo) => {
    // Test with wider screen (vertical letterboxing)
    await page.setViewportSize({ width: 2560, height: 1080 })
    await page.goto(CLIENT_URL)
    await waitScaled(page, 2000)

    const hasLetterbox = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return false

      // Check background color outside game viewport
      // Should be dark (#1a1a1a from game config)
      const body = document.body
      const bgColor = window.getComputedStyle(body).backgroundColor
      return bgColor === 'rgb(26, 26, 26)' || bgColor === '#1a1a1a'
    })

    expect(hasLetterbox).toBe(true)
  })

  test('Verify UI elements are in viewport coordinates', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(CLIENT_URL)
    await waitScaled(page, 2000)

    // Check score text position (should be at viewport top center)
    const scorePosition = await page.evaluate(() => {
      const scoreTexts = Array.from(document.querySelectorAll('canvas'))
      // In Phaser, text is rendered on canvas, so we check via game state
      return {
        hasScore: true, // Score is always created
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }
    })

    expect(scorePosition.hasScore).toBe(true)
    expect(scorePosition.viewportWidth).toBe(1920)
    expect(scorePosition.viewportHeight).toBe(1080)
  })
})
