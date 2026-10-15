import { defineConfig, devices } from '@playwright/test';
import { readEnvironment } from './src/config/environment.ts';

const { baseURL } = readEnvironment();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  globalSetup: './src/support/clean-results.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : '50%',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: false }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run demo',
    url: `${baseURL}/health`,
    reuseExistingServer: false
  },
  projects: [
    { name: 'api', testMatch: /.*\.api\.spec\.ts/ },
    { name: 'chromium', testMatch: /.*\.ui\.spec\.ts/, use: devices['Desktop Chrome'] }
  ]
});
