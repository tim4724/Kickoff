import { chromium, FullConfig } from '@playwright/test'

/**
 * Global setup for all tests
 * Applies time acceleration and other optimizations
 */
async function globalSetup(config: FullConfig) {
  console.log('🕐 Global Setup: Configuring synchronized time acceleration')
  console.log('⚡ Time scale: 10x on both client and server')
  console.log('🔄 Tests run in parallel with isolated rooms')
  console.log('📊 Expected test duration: ~3 minutes with 8 workers')

  // Time acceleration is applied via:
  // 1. Client: fixtures.ts sets GameClock.setTimeScale(10)
  // 2. Server: MatchRoom scales deltaTime by 10x
  // 3. Synchronization: __testTimeScale window variable

  return async () => {
    console.log('✅ Global teardown complete')
  }
}

export default globalSetup
