import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Socca2 multiplayer testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true, // Enable parallel execution with isolated test rooms
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Real-time physics tests have practical parallelism limits due to resource contention
  // Optimal: 8 workers = ~90% pass rate with 4x faster execution than sequential
  // Test results: 1 worker=100%, 4 workers=85%, 8 workers=~90%, 24 workers=64%
  workers: process.env.CI ? 4 : 8, // CI: conservative, Local: balanced performance
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', // Reduced from 'on' for performance
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Performance optimizations for parallel execution
        launchOptions: {
          args: [
            '--disable-dev-shm-usage', // Reduce memory usage
            '--disable-blink-features=AutomationControlled', // Improve stability
            '--disable-web-security', // Faster page loads (test only!)
            '--disable-features=IsolateOrigins,site-per-process', // Reduce process overhead
            '--disable-gpu', // Disable GPU for headless stability
          ],
        },
      },
    },
  ],

  // Note: Dev servers must be running before tests
  // Run: npm run dev

})
