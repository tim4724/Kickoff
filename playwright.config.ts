import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Socca2 multiplayer testing
 *
 * Performance characteristics:
 * - 1 worker: 100% pass rate (slow)
 * - 4 workers: 85% pass rate
 * - 8 workers: ~90% pass rate (balanced)
 * - 24 workers: 64% pass rate (too aggressive)
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true, // Enable parallel execution with isolated test rooms
  forbidOnly: !!process.env.CI,

  // Global setup/teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  // Smart retry strategy: retry on network/timeout errors only
  retries: process.env.CI ? 2 : 1, // Changed from 0 to 1 locally for flaky physics tests

  // Optimal worker configuration for physics-sensitive tests
  // With 10x time acceleration, tests run much faster
  workers: process.env.CI ? 4 : 8, // CI: conservative, Local: balanced performance

  // Global timeout to prevent hanging tests
  // Reduced due to 10x time acceleration
  timeout: 30000, // 30 seconds per test (was 60s, now 10x faster)

  // Expect timeout for assertions
  expect: {
    timeout: 5000, // 5 seconds for expect assertions (was 10s, now 10x faster)
  },

  // Multiple reporters for better visibility
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'], // Console output
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Action timeout for clicks, typing, etc
    actionTimeout: 15000, // 15 seconds

    // Navigation timeout
    navigationTimeout: 30000, // 30 seconds for page loads
  },

  projects: [
    // Physics-sensitive tests with lower parallelism
    {
      name: 'physics-tests',
      testMatch: /.*\/(ball-capture|shooting-mechanics|client-server-.*-sync)\.spec\.ts/,
      retries: process.env.CI ? 2 : 1,
      timeout: 90000, // Physics tests need more time
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
          ],
        },
      },
    },

    // Stable tests with standard parallelism
    {
      name: 'stable-tests',
      testMatch: /.*\/(game-over|rendering|room-selection|two-player).*\.spec\.ts/,
      retries: process.env.CI ? 1 : 0, // Stable tests need fewer retries
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
          ],
        },
      },
    },

    // All other tests
    {
      name: 'chromium',
      testIgnore: /.*\/(ball-capture|shooting-mechanics|client-server-.*-sync|game-over|rendering|room-selection|two-player).*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
          ],
        },
      },
    },
  ],

  // Note: Dev servers must be running before tests
  // Run: npm run dev
  //
  // Test commands:
  // - npm run test:e2e                 # Run all tests
  // - npm run test:e2e:ui              # Run with UI mode
  // - npm run test:e2e:report          # View last report
  // - npm run clean:test               # Clean test artifacts

})
