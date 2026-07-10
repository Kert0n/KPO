import type { Page } from '@playwright/test'
import { registerConsoleGuard } from './helpers/consoleGuard'
import { expect, test } from './helpers/fixtures'
import { waitForMermaid } from './helpers/themeSuite'

registerConsoleGuard(test)
test.use({ mermaidMode: 'on' })

const fixtureRoute = 'service-pages/ui-contract'

test('visual: desktop light with sidebar', async ({ page }) => {
  await preparePage(page, 'intro', { width: 1440, height: 900 })
  await expect(page).toHaveScreenshot('desktop-light-sidebar.png', screenshotOptions(page))
})

test('visual: desktop dark with hidden sidebar', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vitepress-theme-appearance', 'dark'))
  await preparePage(page, fixtureRoute, { width: 1440, height: 900 })
  await page.locator('.kpo-sidebar-toggle').click()
  await expect(page.locator('html')).toHaveClass(/kpo-sidebar-hidden/)
  await expect(page).toHaveScreenshot('desktop-dark-sidebar-hidden.png', screenshotOptions(page))
})

test('visual: tablet', async ({ page }) => {
  await preparePage(page, 'intro', { width: 800, height: 900 })
  await expect(page).toHaveScreenshot('tablet.png', screenshotOptions(page))
})

for (const theme of ['light', 'dark'] as const) {
  test(`visual: mobile ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('vitepress-theme-appearance', value), theme)
    await preparePage(page, 'intro', { width: 390, height: 844 })
    await expect(page).toHaveScreenshot(`mobile-${theme}.png`, screenshotOptions(page))
  })
}

test('visual: multi-code', async ({ page }) => {
  await preparePage(page, fixtureRoute, { width: 1200, height: 900 })
  await expect(page.locator('.kpo-switcher').first()).toHaveScreenshot('multi-code.png', {
    animations: 'disabled',
    caret: 'hide'
  })
})

test('visual: Mermaid', async ({ page }) => {
  await preparePage(page, fixtureRoute, { width: 1200, height: 900 })
  await expect(page.locator('.kpo-mermaid').first()).toHaveScreenshot('mermaid.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.02
  })
})

test.describe('Playground visual', () => {
  test.use({ playgroundMode: 'on' })
  test('visual: Playground', async ({ page }) => {
    await preparePage(page, fixtureRoute, { width: 1200, height: 900 })
    const switcher = page.locator('.kpo-switcher').filter({ hasText: 'Fixture Kotlin Playground' })
    await switcher.getByRole('tab', { name: 'Kotlin' }).click()
    await expect(switcher.locator('.kpo-playground')).toHaveClass(/kpo-playground--ready/)
    await expect(switcher.locator('.kpo-playground')).toHaveScreenshot('playground.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02
    })
  })
})

test('visual: Ask AI context menu', async ({ page }) => {
  await preparePage(page, 'intro', { width: 1200, height: 900 })
  await selectFirstParagraph(page)
  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
  await expect(page).toHaveScreenshot('ask-ai-menu.png', screenshotOptions(page))
})

test('visual: manual prompt dialog', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('visual clipboard failure')) }
    })
    document.execCommand = () => false
  })
  await preparePage(page, 'intro', { width: 1200, height: 900 })
  await selectFirstParagraph(page)
  await page.locator('.kpo-ai-menu__item').click()
  await expect(page.locator('.kpo-ai-manual')).toBeVisible()
  await expect(page).toHaveScreenshot('ask-ai-manual-dialog.png', screenshotOptions(page))
})

async function preparePage(
  page: Page,
  route: string,
  viewport: { width: number; height: number }
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto(route)
  await page.locator('.vp-doc').waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      * { caret-color: transparent !important; }
    `
  })
  await waitForMermaid(page)
}

async function selectFirstParagraph(page: Page): Promise<void> {
  await page
    .locator('.vp-doc p')
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 420,
          clientY: 320
        })
      )
    })
}

function screenshotOptions(page: Page) {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    mask: [page.locator('.VPLastUpdated')],
    maxDiffPixelRatio: 0.02
  }
}
