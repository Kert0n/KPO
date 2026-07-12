import { expect, test } from './fixtures'
import {
  LAYOUT_VIEWPORTS,
  UI_FIXTURE_ROUTE,
  resetComponentStorage,
  stubUiServiceAskAiContext,
  waitForMermaid
} from './helpers/kpoTestSupport'

test('keyboard Ask AI menu owns focus and restores the invoking control', async ({ page }) => {
  await resetComponentStorage(page)
  await stubUiServiceAskAiContext(page)
  await page.goto(UI_FIXTURE_ROUTE)

  const initiator = page.locator('.kpo-sidebar-toggle')
  await initiator.focus()
  await page.evaluate(() => {
    const paragraph = [...document.querySelectorAll<HTMLElement>('.vp-doc p')].find((node) =>
      node.textContent?.includes('This page is intentionally hidden from navigation.')
    )
    const selection = window.getSelection()
    if (!paragraph || !selection) throw new Error('Missing fixture text')
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    selection.removeAllRanges()
    selection.addRange(range)
    paragraph.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0 })
    )
  })

  await expect(page.locator('.kpo-ai-menu')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)
  await expect(initiator).toBeFocused()
})

test('code tabs and panels expose stable accessible relationships', async ({ page }) => {
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)

  const switcher = page.locator('.kpo-switcher').first()
  const tabs = switcher.getByRole('tab')
  await expect.poll(() => tabs.count()).toBeGreaterThan(1)
  for (const tab of await tabs.all()) {
    const panelId = await tab.getAttribute('aria-controls')
    const tabId = await tab.getAttribute('id')
    expect(panelId).toBeTruthy()
    expect(tabId).toBeTruthy()
    const panel = switcher.locator(`[id="${panelId}"]`)
    await expect(panel).toHaveAttribute('role', 'tabpanel')
    await expect(panel).toHaveAttribute('aria-labelledby', tabId!)
  }

  await tabs.filter({ hasText: 'Java' }).click()
  await expect(tabs.filter({ hasText: 'Java' })).toHaveAttribute('aria-selected', 'true')
  const activePanelId = await tabs.filter({ hasText: 'Java' }).getAttribute('aria-controls')
  await expect(switcher.locator(`[id="${activePanelId}"]`)).toHaveAttribute('aria-hidden', 'false')
})

test('overflow regions expose accessible names and keyboard focus only when scrollable', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const wideMermaid = page.locator('.kpo-mermaid--has-overflow .kpo-mermaid__viewport').first()
  await expect(wideMermaid).toHaveAttribute('role', 'img')
  await expect(wideMermaid).toHaveAttribute('aria-label', 'Диаграмма Mermaid')
  await expect(wideMermaid).toHaveAttribute('tabindex', '0')

  const smallMermaid = page.locator('.kpo-mermaid:not(.kpo-mermaid--has-overflow)').first()
  await expect(smallMermaid.locator('.kpo-mermaid__viewport')).not.toHaveAttribute('tabindex', '0')

  const scrollTable = page.locator('.kpo-content-block--table.kpo-table--scroll').first()
  await expect(scrollTable).toHaveAttribute('role', 'region')
  await expect(scrollTable).toHaveAttribute('aria-label', 'Прокручиваемая таблица')
  await expect(scrollTable).toHaveAttribute('tabindex', '0')
})

test('reduced motion disables KPO transitions without changing normal mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)

  for (const selector of [
    '.kpo-sidebar-toggle',
    '.kpo-switcher__tab',
    '.kpo-switcher__playground-toggle'
  ]) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .first()
          .evaluate((node) => getComputedStyle(node).transitionDuration)
      )
      .toMatch(/^(?:0s(?:, 0s)*)$/)
  }
})
