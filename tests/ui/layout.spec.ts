import { expect, test } from './fixtures'
import {
  LAYOUT_VIEWPORTS,
  UI_FIXTURE_ROUTE,
  expectMermaidThemeSynchronized,
  expectNoGlobalOverflowMask,
  expectNoPageOverflowFromVpDoc,
  resetComponentStorage,
  setStorage,
  waitForMermaid
} from './helpers/kpoTestSupport'

test('fixture text code blocks keep overflow local on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const textBlock = page.locator('.language-text').filter({
    hasText: 'Пример функционального тестирования'
  })

  await expect(textBlock).toHaveCount(1)
  const state = await textBlock.evaluate((node) => {
    const element = node as HTMLElement
    const rect = element.getBoundingClientRect()
    return {
      right: Math.round(rect.right),
      viewport: document.documentElement.clientWidth,
      hasLocalScroll: element.scrollWidth > element.clientWidth + 1,
      overflowX: getComputedStyle(element).overflowX
    }
  })

  expect(state.right).toBeLessThanOrEqual(state.viewport)
  if (state.hasLocalScroll) {
    expect(['auto', 'scroll']).toContain(state.overflowX)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('fixture theme switch does not create page overflow or rely on global overflow masking', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await expectMermaidThemeSynchronized(page)

  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await expectMermaidThemeSynchronized(page)

  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)
})

test('special content elements are viewport-contained on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await setStorage(page, { 'kpo:playground-mode': '1' })
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await page.locator('.kpo-switcher').first().getByRole('tab', { name: 'Kotlin' }).click()

  for (const selector of [
    '.kpo-content-block--table',
    '.kpo-mermaid',
    '.kpo-switcher',
    '.kpo-playground',
    '.custom-block',
    '.vp-doc blockquote',
    '.vp-doc img',
    '.vp-doc code:not(pre code)',
    '.kpo-content-block--code',
    '.vp-doc h1, .vp-doc h2, .vp-doc h3'
  ]) {
    await expect.poll(async () => page.locator(selector).count()).toBeGreaterThan(0)
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('tablet viewport has no horizontal page overflow', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(overflow).toBe(false)
})
