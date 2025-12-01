import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Kickoff multiplayer testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true, // Enable parallel execution with isolated test rooms
  forbidOnly: !!process.env.CI,

  // Global setup/teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  // Smart retry strategy
  retries: process.env.CI ? 2 : 1,

  // Workers
  workers: 2,

  // Global timeout
  timeout: 90000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Multiple reporters
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5174', // Test port (dev uses 5173)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    hasTouch: false,

    // Action timeout
    actionTimeout: 30000,

    // Navigation timeout
    navigationTimeout: 60000,
  },

  projects: [
    {
      name: 'chromium',
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
  webServer: [
    {
      command: 'npm run dev:server:test',
      url: 'http://localhost:3001/health',
      timeout: 60 * 1000,
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
})
