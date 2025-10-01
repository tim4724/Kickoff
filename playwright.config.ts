import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Socca2 multiplayer testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for multiplayer coordination
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid port conflicts
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Note: Dev servers must be running before tests
  // Run: npm run dev

})
