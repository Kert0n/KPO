import { expect, type Page } from '@playwright/test'

type OpenAskAiMenuOptions = {
  activate?: boolean
  allowManualFallback?: boolean
  expectedConsoleErrors?: RegExp[]
}

type BrowserIssue = {
  kind: 'console' | 'pageerror'
  message: string
}

/**
 * Re-establishes the range on every attempt because client hydration may replace
 * the selected text node between navigation readiness and the contextmenu event.
 */
export async function openAskAiMenuWhenReady(
  page: Page,
  text: string,
  options: OpenAskAiMenuOptions = {}
): Promise<void> {
  const issues: BrowserIssue[] = []
  const onPageError = (error: Error) => issues.push({ kind: 'pageerror', message: error.message })
  const onConsole = (message: { type(): string; text(): string }) => {
    const expected = options.expectedConsoleErrors?.some((pattern) => pattern.test(message.text()))
    if (message.type() === 'error' && !expected) {
      issues.push({ kind: 'console', message: message.text() })
    }
  }
  page.on('pageerror', onPageError)
  page.on('console', onConsole)

  try {
    await page.locator('.vp-doc [data-kpo-ask-block-id]').first().waitFor({ state: 'attached' })
    await page.evaluate((targetText) => {
      const root = [...document.querySelectorAll<HTMLElement>('.vp-doc *')]
        .filter((node) => node.textContent?.includes(targetText))
        .sort((left, right) => {
          return (left.textContent?.length ?? 0) - (right.textContent?.length ?? 0)
        })[0]
      root?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }, text)

    const dispatchSelection = async () => {
      return page.evaluate((targetText) => {
        const root = [...document.querySelectorAll<HTMLElement>('.vp-doc *')]
          .filter((node) => node.textContent?.includes(targetText))
          .sort((left, right) => {
            return (left.textContent?.length ?? 0) - (right.textContent?.length ?? 0)
          })[0]
        if (!root) return 'text-missing'

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        let combined = ''
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          nodes.push(node)
          combined += node.nodeValue ?? ''
        }

        const start = combined.indexOf(targetText)
        if (start < 0) return 'range-missing'
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
        if (!startNode || !endNode) return 'range-missing'

        const range = document.createRange()
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        const rect = range.getBoundingClientRect()
        ;(startNode.parentElement ?? root).dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: rect.left + Math.min(12, Math.max(2, rect.width / 2)),
            clientY: rect.top + Math.min(10, Math.max(2, rect.height / 2))
          })
        )

        const menu = document.querySelector<HTMLElement>('.kpo-ai-menu')
        const manual = document.querySelector<HTMLElement>('.kpo-ai-manual')
        if (manual && manual.getClientRects().length > 0) return 'manual'
        if (menu && menu.getClientRects().length > 0) return 'menu'
        return 'pending'
      }, text)
    }

    await expect
      .poll(dispatchSelection)
      .toMatch(options.allowManualFallback ? /^(menu|manual)$/ : /^menu$/)

    if (options.activate) {
      const item = page.locator('.kpo-ai-menu__item')
      await expect
        .poll(async () => {
          if ((await item.isVisible()) && (await item.isEnabled())) return true
          await dispatchSelection()
          return false
        })
        .toBe(true)
      await item.click()
    }

    expect(issues, `Ask AI emitted browser errors: ${JSON.stringify(issues)}`).toEqual([])
  } finally {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
  }
}
