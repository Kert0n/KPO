import { defineConfig, devices } from '@playwright/test'
import { SITE } from './.vitepress/shared/site'

const workers = Number(process.env.KPO_UI_WORKERS ?? 4)

export default defineConfig({
  testDir: './tests/ui',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  reporter: [['line'], ['./tests/ui/helpers/timingReporter.ts']],
  fullyParallel: true,
  workers: Number.isFinite(workers) && workers > 0 ? workers : 4,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: `http://127.0.0.1:5174${SITE.base}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5174',
    url: `http://127.0.0.1:5174${SITE.base}`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox-smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit-smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'visual',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
