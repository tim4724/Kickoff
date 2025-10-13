import { chromium, FullConfig } from '@playwright/test'

/**
 * Global setup for all tests
 * Applies time acceleration and other optimizations
 */
async function globalSetup(config: FullConfig) {
  console.log('🕐 Global Setup: Configuring time acceleration for all tests')
  console.log('⚡ Default time scale: 10x (tests run 10x faster)')
  console.log('🔄 Tests run in parallel with isolated rooms')

  // Note: Actual time scale is applied per-test via browser context
  // This setup just logs the configuration

  return async () => {
    console.log('✅ Global teardown complete')
  }
}

export default globalSetup
