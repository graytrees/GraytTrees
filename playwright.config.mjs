// Screen tests: the real app code running against in-memory stand-ins for Google's services (test/mocks),
// on a phone-sized screen. They run before every publish; a failure stops the publish.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 45000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', viewport: { width: 393, height: 880 }, deviceScaleFactor: 2, hasTouch: true, trace: 'retain-on-failure' },
  webServer: { command: 'npx vite --config vite.mock.config.js', url: 'http://localhost:5199', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
