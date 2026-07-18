import { defineConfig, devices } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:3011';
const WEB = process.env.E2E_WEB_URL || 'http://localhost:5173';

/**
 * Critical browser flows against temporary environment only.
 * Start API (temp Neon) + Vite before running, or rely on webServer below.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: WEB,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: WEB,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          // Proxy API through Vite — set VITE proxy target via env if needed
        },
      },
});

// Re-export API base for tests
export const E2E_API_URL = API;
