import { expect, type Page } from '@playwright/test'

export const UI_FIXTURE_ROUTE = 'service-pages/ui-contract'
export const BREAKPOINTS = [390, 767, 768, 769, 800, 959, 960, 1279, 1280, 1440] as const

export async function resetBrowserState(page: Page, entries: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((stored) => {
    localStorage.clear()
    sessionStorage.clear()
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value)
  }, entries)
}

export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((value) => {
    localStorage.setItem('vitepress-theme-appearance', value)
    document.documentElement.classList.toggle('dark', value === 'dark')
  }, theme)
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
}

export async function waitForStableUi(page: Page): Promise<void> {
  await page.locator('.vp-doc').first().waitFor({ state: 'attached' })
  await page.waitForFunction(() => {
    const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
    return diagrams.every((diagram) => diagram.querySelector('svg, .kpo-mermaid__error'))
  })
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

export async function hideSidebar(page: Page): Promise<void> {
  const html = page.locator('html')
  if (!await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))) {
    await page.locator('.kpo-sidebar-toggle').click()
  }
  await expect(html).toHaveClass(/kpo-sidebar-hidden/)
}

export async function selectText(page: Page, text: string): Promise<void> {
  await page.evaluate((targetText) => {
    const root = [...document.querySelectorAll('.vp-doc *')]
      .filter((node) => node.textContent?.includes(targetText))
      .sort((left, right) => (left.textContent?.length ?? 0) - (right.textContent?.length ?? 0))[0]
    if (!root) throw new Error(`Text not found: ${targetText}`)

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let all = ''
    while (walker.nextNode()) {
      nodes.push(walker.currentNode as Text)
      all += walker.currentNode.nodeValue ?? ''
    }
    const start = all.indexOf(targetText)
    if (start < 0) throw new Error(`Text node not found: ${targetText}`)
    const end = start + targetText.length
    let cursor = 0
    let startNode: Text | undefined
    let endNode: Text | undefined
    let startOffset = 0
    let endOffset = 0
    for (const node of nodes) {
      const next = cursor + (node.nodeValue?.length ?? 0)
      if (!startNode && start >= cursor && start <= next) {
        startNode = node
        startOffset = start - cursor
      }
      if (!endNode && end >= cursor && end <= next) {
        endNode = node
        endOffset = end - cursor
        break
      }
      cursor = next
    }
    if (!startNode || !endNode) throw new Error(`Range not found: ${targetText}`)
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const rect = range.getBoundingClientRect()
    ;(startNode.parentElement ?? root).dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: rect.left + 4,
      clientY: rect.top + 4
    }))
  }, text)
  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
}

export async function normalizeForScreenshot(page: Page): Promise<void> {
  await page.addStyleTag({ content: `
    *, *::before, *::after { caret-color: transparent !important; }
    .VPNavBarAppearance, .VPNavScreenAppearance { transition: none !important; }
  ` })
}
