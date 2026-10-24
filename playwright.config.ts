import { defineConfig } from '@playwright/test';

const channel = (process.env.PLAYWRIGHT_CHANNEL ?? 'msedge') as 'msedge';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173/src/newtab/',
    viewport: { width: 1440, height: 900 },
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/src/newtab/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
