import { defineConfig, devices } from '@playwright/test'
import { SITE } from './.vitepress/shared/site'

const crossBrowser = process.env.KPO_CROSS_BROWSER === '1'

export default defineConfig({
  testDir: './tests/ui',
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: `http://127.0.0.1:5174${SITE.base}`,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5174',
    url: `http://127.0.0.1:5174${SITE.base}`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    ...(crossBrowser
      ? [
          {
            name: 'firefox-smoke',
            testMatch: /smoke\.spec\.ts/,
            use: { ...devices['Desktop Firefox'] }
          },
          {
            name: 'webkit-smoke',
            testMatch: /smoke\.spec\.ts/,
            use: { ...devices['Desktop Safari'] }
          }
        ]
      : [])
  ]
})
