import { Page } from '@playwright/test'
import { setTimeScale } from './time-control'

/**
 * Global test setup utilities
 * Applies time acceleration and other optimizations to all tests
 */

// Default time scale for all tests (can be overridden per test)
export const DEFAULT_TIME_SCALE = 10

/**
 * Setup function to call at the start of every test
 * Applies time acceleration and other optimizations
 */
export async function setupTest(pages: Page | Page[], timeScale: number = DEFAULT_TIME_SCALE): Promise<void> {
  const pageArray = Array.isArray(pages) ? pages : [pages]

  // Apply time scale to all pages in parallel
  await Promise.all(
    pageArray.map(page => setTimeScale(page, timeScale))
  )
}

/**
 * Quick setup for single page tests
 */
export async function setupSingleTest(page: Page, timeScale: number = DEFAULT_TIME_SCALE): Promise<void> {
  await setTimeScale(page, timeScale)
}

/**
 * Quick setup for multi-page tests
 */
export async function setupMultiTest(pages: Page[], timeScale: number = DEFAULT_TIME_SCALE): Promise<void> {
  await Promise.all(
    pages.map(page => setTimeScale(page, timeScale))
  )
}
