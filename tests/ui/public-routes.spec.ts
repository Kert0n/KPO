import { getContentCatalog, getUiSweepPages } from '../../.vitepress/shared/content/contentCatalog'
import { LAYOUT_VIEWPORTS } from '../../.vitepress/theme/lib/contentLayoutTokens'
import { expect, test } from './helpers/fixtures'
import {
  expectNoGlobalOverflowMask,
  expectNoPageOverflowFromVpDoc,
  getMermaidClipIssues,
  getMermaidLabelContrasts,
  waitForAdaptiveTables,
  waitForMermaid
} from './helpers/themeSuite'
import { waitForDocumentAnimations, waitForStableRect } from './helpers/viewport'

const publicRoutes = getUiSweepPages(getContentCatalog())
test.use({ mermaidMode: 'on' })

for (const contentPage of publicRoutes) {
  const route = contentPage.route.replace(/^\//, '')

  test(`public route contract: ${contentPage.route}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vitepress-theme-appearance', 'dark'))
    await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
    await page.goto(route)
    await expect(page.locator('.vp-doc')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    const lastUpdated = page.locator('.VPLastUpdated')
    for (let index = 0; index < (await lastUpdated.count()); index += 1) {
      await expect(lastUpdated.nth(index)).toContainText(
        /Обновлено:\s+\d{2}\.\d{2}\.\d{2},\s+\d{2}:\d{2}\s+(AM|PM)/
      )
    }

    await waitForMermaid(page)
    await waitForDocumentAnimations(page)
    await waitForAdaptiveTables(page)
    await expect(page.locator('.kpo-mermaid__error')).toHaveCount(0)
    expect(await getMermaidClipIssues(page), contentPage.route).toEqual([])
    await expectAdaptiveTableContract(page)
    await expectNoGlobalOverflowMask(page)
    await expectNoPageOverflowFromVpDoc(page)
    for (const label of await getMermaidLabelContrasts(page)) {
      expect(label.contrast, JSON.stringify({ route, label }, null, 2)).toBeGreaterThanOrEqual(4.5)
      expect(label.color).not.toBe('rgb(0, 0, 0)')
    }

    expect(await page.locator('html').evaluate((node) => node.classList.contains('dark'))).toBe(true)
    await expectNoPageOverflowFromVpDoc(page)

    await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
    await waitForAdaptiveTables(page)
    await waitForStableRect(page.locator('.vp-doc'))
    await expectAdaptiveTableContract(page)
    await expectNoPageOverflowFromVpDoc(page)
    await expectLocalOverflowOnly(page)
  })
}

async function expectAdaptiveTableContract(page: import('@playwright/test').Page): Promise<void> {
  const result = await page.evaluate(() => ({
    orphanTables: [...document.querySelectorAll('.vp-doc table')].filter(
      (table) => !table.closest('.kpo-content-block--table')
    ).length,
    unresolvedTables: [...document.querySelectorAll('.kpo-content-block--table')].filter(
      (block) => !/kpo-table--(?:fit|wrap|scroll)/.test(block.className)
    ).length
  }))
  expect(result).toEqual({ orphanTables: 0, unresolvedTables: 0 })
}

async function expectLocalOverflowOnly(page: import('@playwright/test').Page): Promise<void> {
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll('.vp-doc *')]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .filter(
        (node) => !node.closest('.kpo-mermaid__viewport, .kpo-content-block--table, pre, .vp-code-group')
      )
      .map((node) => `${node.tagName.toLowerCase()}.${String(node.className)}`)
      .slice(0, 20)
  )
  expect(offenders, contentPageSafeName(page)).toEqual([])
}

function contentPageSafeName(page: import('@playwright/test').Page): string {
  return `Unexpected non-local overflow at ${page.url()}`
}
