import { expect, test } from '@playwright/test'
import {
  normalizeForScreenshot,
  resetBrowserState,
  selectText,
  UI_FIXTURE_ROUTE,
  waitForStableUi
} from './helpers'

const VISUAL_COMPONENT_FIXTURE_ROUTE = 'service-pages/visual-components'

test.describe('Linux Chromium golden master', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page, {
      'kpo:playground-mode': '0',
      'vitepress-theme-appearance': 'light'
    })
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`desktop ${theme} fixture shell`, async ({ page }) => {
      await resetBrowserState(page, {
        'kpo:playground-mode': '0',
        'vitepress-theme-appearance': theme
      })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(UI_FIXTURE_ROUTE)
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
      await waitForStableUi(page)
      await normalizeForScreenshot(page)
      await expect(page).toHaveScreenshot(`desktop-${theme}-fixture-shell.png`, {
        fullPage: true
      })
    })
  }

  for (const width of [768, 800] as const) {
    test(`tablet ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(UI_FIXTURE_ROUTE)
      await waitForStableUi(page)
      await normalizeForScreenshot(page)
      await expect(page).toHaveScreenshot(`tablet-${width}.png`, { fullPage: true })
    })
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`mobile ${theme}`, async ({ page }) => {
      await resetBrowserState(page, {
        'kpo:playground-mode': '0',
        'vitepress-theme-appearance': theme
      })
      await page.setViewportSize({ width: 375, height: 844 })
      await page.goto(UI_FIXTURE_ROUTE)
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
      await waitForStableUi(page)
      await normalizeForScreenshot(page)
      await expect(page).toHaveScreenshot(`mobile-${theme}.png`, { fullPage: true })
    })
  }

  for (const fixture of [
    { name: 'multi-code', selector: '.kpo-switcher', route: VISUAL_COMPONENT_FIXTURE_ROUTE },
    { name: 'mermaid', selector: '.kpo-mermaid', route: UI_FIXTURE_ROUTE }
  ] as const) {
    test(fixture.name, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(fixture.route)
      await waitForStableUi(page)
      await normalizeForScreenshot(page)
      await expect(page.locator(fixture.selector).first()).toHaveScreenshot(`${fixture.name}.png`)
    })
  }

  test('Mermaid after theme toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForStableUi(page)
    await page.locator('.VPSwitchAppearance:visible').first().click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await waitForStableUi(page)
    await normalizeForScreenshot(page)
    await expect(page.locator('.kpo-mermaid').first()).toHaveScreenshot('mermaid-dark.png')
  })

  test('Playground', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(VISUAL_COMPONENT_FIXTURE_ROUTE)
    await waitForStableUi(page)
    const switcher = page.locator('.kpo-switcher').filter({ hasText: 'Fixture Kotlin Playground' })
    await switcher.locator('.kpo-switcher__playground-toggle').click()
    await expect(switcher.locator('.kpo-playground')).toBeVisible()
    await page.addStyleTag({
      content: `
      .kpo-playground { height: 214px !important; overflow: hidden !important; }
      .kpo-playground > * { visibility: hidden !important; }
    `
    })
    await normalizeForScreenshot(page)
    await expect(switcher).toHaveScreenshot('playground.png')
  })

  test('Ask AI selection menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForStableUi(page)
    await selectText(page, 'This page is intentionally hidden from navigation.')
    await normalizeForScreenshot(page)
    await expect(page).toHaveScreenshot('ask-ai.png')
  })

  test('manual prompt dialog', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException('blocked', 'NotAllowedError')
          }
        }
      })
      document.execCommand = (() => false) as typeof document.execCommand
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForStableUi(page)
    await selectText(page, 'This page is intentionally hidden from navigation.')
    const item = page.locator('.kpo-ai-menu__item')
    await expect(item).toBeEnabled()
    await item.click()
    await expect(page.locator('.kpo-ai-manual')).toBeVisible()
    await page.addStyleTag({
      content: '.kpo-ai-toast { visibility: hidden !important; }'
    })
    await normalizeForScreenshot(page)
    await expect(page).toHaveScreenshot('manual-prompt.png')
  })

  test('logo and title crop guard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForStableUi(page)
    await normalizeForScreenshot(page)
    await expect(page.locator('.VPNavBarTitle')).toHaveScreenshot('logo-title-mobile.png')
  })
})
