import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { getContentCatalog } from '../../.vitepress/shared/content/contentCatalog'
import { registerConsoleGuard } from './helpers/consoleGuard'

registerConsoleGuard(test)

const catalog = getContentCatalog()
const contentRoutes = [
  catalog.pages.find((page) => page.kind === 'intro'),
  catalog.pages.find((page) => page.kind === 'service'),
  catalog.pages.find((page) => page.kind === 'lecture')
].flatMap((page) => (page ? [page.route.replace(/^\//, '')] : []))

for (const route of contentRoutes) {
  test(`accessibility: ${route}`, async ({ page }) => {
    await page.goto(route)
    await page.locator('.vp-doc').waitFor({ state: 'attached' })
    if (route === 'service-pages/ui-contract') {
      await page.locator('.kpo-mermaid svg').first().waitFor({ state: 'visible' })
    }
    await expectNoSeriousViolations(page, '.vp-doc')
  })
}

test('accessibility: Ask AI context menu', async ({ page }) => {
  await page.goto('lectures/10')
  await page
    .getByText('RESTful API', { exact: false })
    .first()
    .evaluate((element) => {
      const text = element.firstChild
      if (!text) throw new Error('Selection target has no text node')
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      element.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })
      )
    })
  await page.locator('.kpo-ai-menu').waitFor({ state: 'visible' })
  await expectNoSeriousViolations(page, '.kpo-ai-menu')
})

test('accessibility: mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('intro')
  await page.getByRole('button', { name: 'mobile navigation' }).click()
  await page.locator('.VPNavScreen').waitFor({ state: 'visible' })
  await expectNoSeriousViolations(page, '.VPNavScreen')
})

async function expectNoSeriousViolations(page: Page, selector: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  )
  expect(seriousOrCritical).toEqual([])
}
