import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30_000, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser.json' }]],
  use: { baseURL: 'http://127.0.0.1:5183', viewport: { width: 1100, height: 850 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5183 --strictPort', url: 'http://127.0.0.1:5183', reuseExistingServer: false }
});
