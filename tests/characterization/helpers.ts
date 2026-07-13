import { expect, type Page } from '@playwright/test'
import { openAskAiMenuWhenReady } from '../helpers/askAi'

export const UI_FIXTURE_ROUTE = 'service-pages/ui-contract'
export const BREAKPOINTS = [390, 767, 768, 769, 800, 959, 960, 1279, 1280, 1440] as const

export async function resetBrowserState(
  page: Page,
  entries: Record<string, string> = {}
): Promise<void> {
  await page.addInitScript((stored) => {
    localStorage.clear()
    sessionStorage.clear()
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value)
  }, entries)
}

export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const isDark = await page
    .locator('html')
    .evaluate((element) => element.classList.contains('dark'))
  if (isDark !== (theme === 'dark')) {
    await page.locator('.VPSwitchAppearance:visible').first().click()
  }
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
}

export async function waitForStableUi(page: Page): Promise<void> {
  await page.locator('.vp-doc').first().waitFor({ state: 'attached' })
  await page.waitForFunction(() => {
    const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
    return diagrams.every((diagram) => diagram.querySelector('svg, .kpo-mermaid__error'))
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
}

export async function hideSidebar(page: Page): Promise<void> {
  const html = page.locator('html')
  const toggle = page.locator('.kpo-sidebar-toggle')
  if (!(await toggle.isVisible())) return
  if (!(await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden')))) {
    await toggle.click()
  }
  await expect(html).toHaveClass(/kpo-sidebar-hidden/)
}

export async function selectText(page: Page, text: string): Promise<void> {
  await openAskAiMenuWhenReady(page, text)
}

export async function normalizeForScreenshot(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
    *, *::before, *::after { caret-color: transparent !important; }
    .VPNavBarAppearance, .VPNavScreenAppearance { transition: none !important; }
  `
  })
}
