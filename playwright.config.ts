import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Kickoff multiplayer testing
 *
 * Performance characteristics with synchronized 10x time acceleration:
 * - 10x time acceleration enabled on BOTH client and server
 * - Tests run ~10x faster with synchronized physics simulation
 * - 8 workers: Optimal parallelism (tests complete in ~3 minutes)
 * - 4 workers: CI configuration (more conservative, ~5 minutes)
 *
 * Time acceleration implementation:
 * - Client: GameClock.setTimeScale(10) via test fixtures
 * - Server: deltaTime scaling in MatchRoom update loop
 * - Both synchronized via __testTimeScale window variable
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

  // Optimal worker configuration with 10x time acceleration
  // 4 workers achieves good parallelism while avoiding severe CPU throttling
  workers: 2, // Reduced from 8 for test stability with browser throttling

  // Global timeout to prevent hanging tests
  // With 10x time acceleration: 30s real-time = 5 minutes game-time
  timeout: 30000, // 30 seconds per test at 10x speed

  // Expect timeout for assertions
  expect: {
    timeout: 5000, // 5 seconds for expect assertions (was 10s, now 10x faster)
  },

  // Multiple reporters for better visibility
  // HTML report is generated but not auto-opened (use npm run test:e2e:report to view)
  reporter: [
    ['html', { open: 'never' }], // Don't auto-open HTML report
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'], // Console output
  ],

  use: {
    baseURL: 'http://localhost:5174', // Test port (dev uses 5173)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    hasTouch: false, // Disable touch emulation to prevent fullscreen splash overlay

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
        hasTouch: false, // Disable touch emulation to prevent fullscreen splash overlay
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
            '--disable-background-timer-throttling', // Prevent requestAnimationFrame throttling
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
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
        hasTouch: false, // Disable touch emulation to prevent fullscreen splash overlay
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
            '--disable-background-timer-throttling', // Prevent requestAnimationFrame throttling
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
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
        hasTouch: false, // Disable touch emulation to prevent fullscreen splash overlay
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-gpu',
            '--disable-background-timer-throttling', // Prevent requestAnimationFrame throttling
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],

  // Auto-start test servers with isolated ports
  // Note: Servers will automatically shut down after tests complete
  // Port cleanup runs automatically via pretest:e2e script
  webServer: [
    {
      command: 'npm run dev:server:test',
      url: 'http://localhost:3001/health',
      timeout: 60 * 1000,
      // Always start fresh servers to avoid stale state issues
      // Use `npm run dev:test` for manual development with persistent servers
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:client:test',
      url: 'http://localhost:5174',
      timeout: 120 * 1000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Test commands:
  // - npm run test:e2e                 # Run all tests (auto-starts servers)
  // - npm run test:e2e:ui              # Run with UI mode
  // - npm run test:e2e:report          # View last report
  // - npm run clean:test               # Clean test artifacts

})
