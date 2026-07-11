import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.KPO_BASE_URL ?? 'http://127.0.0.1:4174/KPO/'
const usesExternalServer = Boolean(process.env.KPO_BASE_URL)

export default defineConfig({
  testDir: './tests/characterization',
  testMatch: ['**/*.spec.ts'],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002
    }
  },
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: usesExternalServer
    ? undefined
    : {
        command: 'npm run preview:host -- --port 4174',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    {
      name: 'linux-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
