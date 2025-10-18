/**
 * Test Environment Configuration
 *
 * Separates test ports from development ports to prevent conflicts.
 * Tests run on ports 5174/3001, dev runs on 5173/3000.
 */

export const TEST_ENV = {
  CLIENT_PORT: 5174,
  SERVER_PORT: 3001,
  CLIENT_URL: 'http://localhost:5174',
  SERVER_URL: 'http://localhost:3001',
} as const

export const DEV_ENV = {
  CLIENT_PORT: 5173,
  SERVER_PORT: 3000,
  CLIENT_URL: 'http://localhost:5173',
  SERVER_URL: 'http://localhost:3000',
} as const
