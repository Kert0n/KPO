import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  CONTENT_LAYOUT_TOKENS,
  LAYOUT_VIEWPORTS
} from '../../.vitepress/theme/lib/contentLayoutTokens'
import { contentPagesFor } from '../../.vitepress/shared/content/contentCatalog'

const CENTER_TOLERANCE_PX = 2
const SCALE_TOLERANCE = 0.05
const ANCHOR_TOLERANCE_PX = 4
const DESKTOP_PROSE_TOLERANCE_PX = 12
const MERMAID_FOREIGN_OBJECT_TOLERANCE_PX = 2
const MERMAID_VIEWBOX_TOLERANCE_PX = 8
const MIN_READABLE_MERMAID_HEIGHT_PX = CONTENT_LAYOUT_TOKENS.mermaidMinHeight
const UI_FIXTURE_ROUTE = 'service-pages/ui-contract'
const PUBLIC_CONTENT_ROUTES = contentPagesFor('uiSweep')
  .filter((page) => page.kind !== 'home' && page.kind !== 'service')
  .map((page) => page.route.replace(/^\//, ''))

type AdaptiveTableMode = 'fit' | 'wrap' | 'scroll'

async function clearStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear()
  })
}

async function setStorage(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, value)
    }
  }, entries)
}

async function expectActiveTab(switcher: Locator, language: string): Promise<void> {
  await expect(switcher.locator('.kpo-switcher__tab--active')).toHaveText(language)
}

async function searchFor(page: Page, query: string): Promise<void> {
  await page.locator('.DocSearch-Button').first().click()
  const input = page.locator('.VPLocalSearchBox .search-input')
  await input.fill(query)
  await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible()
}

async function waitForMermaid(
  page: Page,
  options: { requireDiagrams?: boolean } = {}
): Promise<void> {
  await page.locator('.vp-doc').first().waitFor({ state: 'attached' })

  if (!options.requireDiagrams) {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })

    if ((await page.locator('.kpo-mermaid').count()) === 0) return
  }

  await page.waitForFunction((requireDiagrams) => {
    const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
    if (diagrams.length === 0) return !requireDiagrams

    return diagrams.every((diagram) => {
      const svg = diagram.querySelector('svg')
      if (diagram.querySelector('.kpo-mermaid__error')) return true
      if (!svg) return false

      const rect = svg.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  }, options.requireDiagrams ?? false)

  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function waitForAdaptiveTables(page: Page): Promise<void> {
  await page.locator('.vp-doc').first().waitFor({ state: 'attached' })

  await page.waitForFunction(() => {
    const tableBlocks = [...document.querySelectorAll('.kpo-content-block--table')]
    return tableBlocks.every((block) => {
      return (
        block.classList.contains('kpo-table--fit') ||
        block.classList.contains('kpo-table--wrap') ||
        block.classList.contains('kpo-table--scroll')
      )
    })
  })

  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function expectNoPageOverflowFromVpDoc(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth

    const offenders = [...document.querySelectorAll('.vp-doc *')]
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          className: String(el.getAttribute('class') || ''),
          display: style.display,
          overflowX: style.overflowX,
          whiteSpace: style.whiteSpace,
          text: String(el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        }
      })
      .filter((item) => {
        return item.width > 0 && item.right > document.documentElement.clientWidth + 1
      })
      .slice(0, 20)

    return { overflow, offenders }
  })

  expect(result.overflow, JSON.stringify(result.offenders, null, 2)).toBe(0)
}

async function getAdaptiveTableStates(page: Page): Promise<
  Array<{
    mode: AdaptiveTableMode | 'none'
    display: string
    tableLayout: string
    cellOverflowWrap: string
    blockOverflowX: string
    blockScrollWidth: number
    blockClientWidth: number
    hasLocalScroll: boolean
    right: number
    viewport: number
    columnCount: number
  }>
> {
  return page.locator('.kpo-content-block--table').evaluateAll((nodes) => {
    return nodes.map((node) => {
      const block = node as HTMLElement
      const table = block.querySelector('table') as HTMLTableElement | null
      const firstCell = table?.querySelector('th, td') as HTMLElement | null
      const rect = block.getBoundingClientRect()
      const mode = block.classList.contains('kpo-table--fit')
        ? 'fit'
        : block.classList.contains('kpo-table--wrap')
          ? 'wrap'
          : block.classList.contains('kpo-table--scroll')
            ? 'scroll'
            : 'none'
      const row = table?.tHead?.rows.item(0) ?? table?.rows.item(0) ?? null
      const columnCount = row
        ? [...row.cells].reduce((count, cell) => count + Math.max(1, cell.colSpan || 1), 0)
        : 0

      return {
        mode,
        display: table ? getComputedStyle(table).display : '',
        tableLayout: table ? getComputedStyle(table).tableLayout : '',
        cellOverflowWrap: firstCell ? getComputedStyle(firstCell).overflowWrap : '',
        blockOverflowX: getComputedStyle(block).overflowX,
        blockScrollWidth: block.scrollWidth,
        blockClientWidth: block.clientWidth,
        hasLocalScroll: block.scrollWidth > block.clientWidth + 1,
        right: Math.round(rect.right),
        viewport: document.documentElement.clientWidth,
        columnCount
      }
    })
  })
}

async function expectNoGlobalOverflowMask(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)

    return {
      htmlOverflowX: html.overflowX,
      bodyOverflowX: body.overflowX
    }
  })

  expect(result.htmlOverflowX).not.toBe('hidden')
  expect(result.bodyOverflowX).not.toBe('hidden')
}

async function getMermaidMetrics(page: Page): Promise<
  Array<{
    index: number
    containerClientWidth: number
    containerScrollWidth: number
    containerClientHeight: number
    containerScrollHeight: number
    svgWidth: number
    svgHeight: number
    viewBoxWidth: number
    viewBoxHeight: number
    scaleX: number
    scaleY: number
    hasLocalXScroll: boolean
  }>
> {
  return page.evaluate(() => {
    return [...document.querySelectorAll('.kpo-mermaid')].map((root, index) => {
      const element = (root.querySelector('.kpo-mermaid__viewport') ?? root) as HTMLElement
      const svg = root.querySelector('svg')
      const rect = svg?.getBoundingClientRect()
      const viewBox = svg?.getAttribute('viewBox') ?? ''
      const [, , viewW, viewH] = viewBox.split(/\s+/).map(Number)
      const viewBoxWidth = Number.isFinite(viewW) ? viewW : 0
      const viewBoxHeight = Number.isFinite(viewH) ? viewH : 0

      return {
        index,
        containerClientWidth: element.clientWidth,
        containerScrollWidth: element.scrollWidth,
        containerClientHeight: element.clientHeight,
        containerScrollHeight: element.scrollHeight,
        svgWidth: rect?.width ?? 0,
        svgHeight: rect?.height ?? 0,
        viewBoxWidth,
        viewBoxHeight,
        scaleX: rect && viewBoxWidth > 0 ? rect.width / viewBoxWidth : 1,
        scaleY: rect && viewBoxHeight > 0 ? rect.height / viewBoxHeight : 1,
        hasLocalXScroll: element.scrollWidth > element.clientWidth + 1
      }
    })
  })
}

type MermaidLabelContrast = {
  color: string
  background: string
  contrast: number
}

async function getMermaidLabelContrasts(page: Page): Promise<MermaidLabelContrast[]> {
  return page.evaluate(() => {
    function parseRgb(value: string): [number, number, number] | null {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (!match) return null
      return [Number(match[1]), Number(match[2]), Number(match[3])]
    }

    function luminance(rgb: [number, number, number]): number {
      const values = rgb.map((channel) => {
        const value = channel / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    }

    function contrast(first: string, second: string): number {
      const left = parseRgb(first)
      const right = parseRgb(second)
      if (!left || !right) return 21
      const l1 = luminance(left)
      const l2 = luminance(right)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }

    const rootStyle = getComputedStyle(document.documentElement)
    const pageBackground = rootStyle.getPropertyValue('--vp-c-bg').trim()

    return [
      ...document.querySelectorAll('.kpo-mermaid svg .nodeLabel, .kpo-mermaid svg .edgeLabel span')
    ].map((node) => {
      const style = getComputedStyle(node)
      const background =
        style.backgroundColor === 'rgba(0, 0, 0, 0)' ? pageBackground : style.backgroundColor
      return {
        color: style.color,
        background,
        contrast: contrast(style.color, background)
      }
    })
  })
}

type MermaidClipIssue = {
  diagramIndex: number
  reason: string
  text: string
}

async function getMermaidClipIssues(page: Page): Promise<MermaidClipIssue[]> {
  return page.evaluate(
    (tolerances) => {
      return [...document.querySelectorAll('.kpo-mermaid svg')].flatMap((svg, diagramIndex) => {
        const svgIssues: Array<{ diagramIndex: number; reason: string; text: string }> = []
        const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number) ?? []
        const [viewMinX, viewMinY, viewWidth, viewHeight] = viewBox

        for (const node of [...svg.querySelectorAll('foreignObject')]) {
          const child = node.firstElementChild
          if (!child) continue

          const containerRect = node.getBoundingClientRect()
          const childRect = child.getBoundingClientRect()
          const text = String(node.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80)
          if (childRect.width > containerRect.width + tolerances.foreignObject) {
            svgIssues.push({ diagramIndex, reason: 'foreignObject-x', text })
          }
          if (childRect.height > containerRect.height + tolerances.foreignObject) {
            svgIssues.push({ diagramIndex, reason: 'foreignObject-y', text })
          }
        }

        if (Number.isFinite(viewWidth) && Number.isFinite(viewHeight)) {
          try {
            const box = (svg as SVGSVGElement).getBBox()
            if (
              box.x < viewMinX - tolerances.viewBox ||
              box.y < viewMinY - tolerances.viewBox ||
              box.x + box.width > viewMinX + viewWidth + tolerances.viewBox ||
              box.y + box.height > viewMinY + viewHeight + tolerances.viewBox
            ) {
              svgIssues.push({ diagramIndex, reason: 'svg-viewbox', text: '' })
            }
          } catch {
            // Some SVG fragments may not expose getBBox while hidden during route changes.
          }
        }

        return svgIssues
      })
    },
    {
      foreignObject: MERMAID_FOREIGN_OBJECT_TOLERANCE_PX,
      viewBox: MERMAID_VIEWBOX_TOLERANCE_PX
    }
  )
}

async function hideSidebar(page: Page): Promise<void> {
  const html = page.locator('html')
  const isHidden = await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
  if (!isHidden) {
    await page.locator('.kpo-sidebar-toggle').click()
    await expect
      .poll(async () => {
        return html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
      })
      .toBe(true)
  }
  await page.waitForTimeout(350)
}

async function measureWideLane(page: Page): Promise<{
  paragraphWidth: number
  mermaidWideBlockWidth: number
  contentContainerWidth: number
}> {
  return page.evaluate(() => {
    const width = (selector: string): number => {
      const element = document.querySelector(selector)
      return Math.round(element?.getBoundingClientRect().width ?? 0)
    }

    return {
      paragraphWidth: width('.vp-doc p'),
      mermaidWideBlockWidth: width('.kpo-wide-block--mermaid'),
      contentContainerWidth: width('.VPDoc .content-container')
    }
  })
}

async function measureFirstWidth(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => {
      return Math.round(node.getBoundingClientRect().width)
    })
}

async function measureViewportRelativeTo(locator: Locator): Promise<number> {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return Math.round(window.scrollY - (rect.top + window.scrollY))
  })
}

async function waitForPageLayoutReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function expectViewportAnchorStable(
  before: number,
  after: number,
  tolerance = ANCHOR_TOLERANCE_PX
): Promise<void> {
  expect(
    Math.abs(after - before),
    `viewport anchor moved from ${before}px to ${after}px`
  ).toBeLessThanOrEqual(tolerance)
}

async function waitForScopedPlayground(
  page: Page,
  switcher: Locator,
  options: { transaction?: boolean } = {}
): Promise<void> {
  if (options.transaction ?? true) {
    await expect(switcher).toHaveAttribute('data-kpo-anchor-pending', 'true')
  }
  const playground = switcher.locator('.kpo-playground:visible')
  await expect(playground).toHaveClass(/kpo-playground--ready/, { timeout: 12_000 })
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let frames = 4
      const next = () => {
        frames -= 1
        if (frames === 0) resolve()
        else requestAnimationFrame(next)
      }
      requestAnimationFrame(next)
    })
  })
  if (options.transaction ?? true) {
    await expect(switcher).not.toHaveAttribute('data-kpo-anchor-pending', 'true')
  }
}

async function expectCenteredAgainstPage(page: Page, locator: Locator): Promise<void> {
  const result = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return {
      centerDelta: Math.abs(
        (rect.left + rect.right) / 2 - document.documentElement.clientWidth / 2
      ),
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth
    }
  })

  expect(result.centerDelta, JSON.stringify(result)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  expect(result.left).toBeGreaterThanOrEqual(-CENTER_TOLERANCE_PX)
  expect(result.right).toBeLessThanOrEqual(result.viewport + CENTER_TOLERANCE_PX)
}

async function selectTextAndOpenAskAiMenu(
  page: Page,
  text: string,
  activate = false
): Promise<void> {
  await page.locator('.vp-doc [data-kpo-ask-block-id]').first().waitFor({ state: 'attached' })
  await page.evaluate(
    async ({ targetText, activateMenuItem }) => {
      const root = [...document.querySelectorAll('.vp-doc *')]
        .filter((node) => node.textContent?.includes(targetText))
        .sort((left, right) => {
          return (left.textContent?.length ?? 0) - (right.textContent?.length ?? 0)
        })[0]

      if (!root) throw new Error(`Text not found: ${targetText}`)
      root.scrollIntoView({ block: 'center', inline: 'nearest' })
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      await new Promise<void>((resolve) => window.setTimeout(resolve, 120))

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let combinedText = ''
      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text
        textNodes.push(textNode)
        combinedText += textNode.nodeValue ?? ''
      }

      const start = combinedText.indexOf(targetText)
      if (start === -1) throw new Error(`Text node not found: ${targetText}`)

      const end = start + targetText.length
      let cursor = 0
      let startNode: Text | null = null
      let endNode: Text | null = null
      let startOffset = 0
      let endOffset = 0

      for (const textNode of textNodes) {
        const value = textNode.nodeValue ?? ''
        const nextCursor = cursor + value.length
        if (!startNode && start >= cursor && start <= nextCursor) {
          startNode = textNode
          startOffset = start - cursor
        }
        if (!endNode && end >= cursor && end <= nextCursor) {
          endNode = textNode
          endOffset = end - cursor
          break
        }
        cursor = nextCursor
      }

      if (!startNode || !endNode) throw new Error(`Text range not found: ${targetText}`)

      const range = document.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(endNode, endOffset)

      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      const rect = range.getBoundingClientRect()
      const target = startNode.parentElement ?? root
      const dispatchContextMenu = () => {
        target.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: rect.left + Math.min(12, Math.max(2, rect.width / 2)),
            clientY: rect.top + Math.min(10, Math.max(2, rect.height / 2))
          })
        )
      }

      dispatchContextMenu()

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        if (document.querySelector('.kpo-ai-menu__item')) break
        dispatchContextMenu()
        await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
      }

      if (activateMenuItem) {
        let button: HTMLElement | null = null
        for (let attempt = 0; attempt < 50; attempt += 1) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
          button = document.querySelector<HTMLElement>('.kpo-ai-menu__item')
          if (button && !(button as HTMLButtonElement).disabled) break

          if (!button) {
            dispatchContextMenu()
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
        }

        if (!button || (button as HTMLButtonElement).disabled)
          throw new Error('Ask AI menu item is not ready')
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    },
    { targetText: text, activateMenuItem: activate }
  )

  if (!activate) {
    await expect(page.locator('.kpo-ai-menu')).toBeVisible()
  }
}

async function selectTextAndClickAskAiMenuItem(page: Page, text: string): Promise<void> {
  await selectTextAndOpenAskAiMenu(page, text, true)
}

async function stubAskAiSideEffects(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          ;(window as unknown as { __kpoCopiedPrompts: string[] }).__kpoCopiedPrompts ??= []
          ;(window as unknown as { __kpoCopiedPrompts: string[] }).__kpoCopiedPrompts.push(text)
        }
      }
    })

    window.open = ((url?: string | URL) => {
      ;(window as unknown as { __kpoOpenedUrls: string[] }).__kpoOpenedUrls ??= []
      if (url) {
        ;(window as unknown as { __kpoOpenedUrls: string[] }).__kpoOpenedUrls.push(String(url))
      }

      const fakeLocation = {}
      Object.defineProperty(fakeLocation, 'href', {
        set(value: string) {
          ;(window as unknown as { __kpoOpenedUrls: string[] }).__kpoOpenedUrls.push(String(value))
        },
        get() {
          return ''
        }
      })

      return {
        opener: null,
        close: () => undefined,
        location: fakeLocation
      } as Window
    }) as typeof window.open
  })
}

async function selectAskAiProviderDesktop(page: Page, providerLabel: string): Promise<void> {
  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  await expect(flyout.locator('.VPMenu')).toBeVisible()
  await flyout.locator('.KpoAskAiProviderMenu__item', { hasText: providerLabel }).click()
}

test('desktop ask ai provider uses vitepress flyout pattern', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('')

  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Введение' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Лекции' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Дополнения' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Заключение' })).toBeVisible()
  await expect(page.locator('.VPNavBar .KpoAskAiProvider')).toBeVisible()
  await expect(page.locator('.VPNavBar .kpo-ai-provider__trigger')).toHaveCount(0)

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await expect(flyout).toHaveClass(/VPFlyout/)
  const button = flyout.locator('button[aria-label="Спросить ИИ"]')
  await expect(button).toBeVisible()
  await expect(button.locator('.vpi-sparkles')).toBeVisible()

  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('СПРОСИТЬ ИИ')
  await expect(menu).toContainText('ChatGPT')
  await expect(menu).toContainText('Claude')
  await expect(menu).toContainText('DeepSeek')
  await expect(menu).toContainText('Копировать промпт')
})

test('desktop ask ai flyout uses default vitepress hover and open behavior', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('intro')

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  const button = flyout.locator('button[aria-label="Спросить ИИ"]')
  const menu = flyout.locator('.VPMenu')

  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()

  await flyout.hover()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()

  await page.mouse.move(1, 1)
  await expect
    .poll(async () => {
      return button.getAttribute('aria-expanded')
    })
    .toBe('false')
  await expect(menu).toBeHidden()
})

test('ask ai provider selected from vitepress flyout persists', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('conclusion')

  await selectAskAiProviderDesktop(page, 'Claude')

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  const chatGpt = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'ChatGPT' })
  const claude = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  const deepSeek = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(menu).toBeVisible()
  await expect(claude).toHaveAttribute('aria-checked', 'true')
  await expect(chatGpt).toHaveAttribute('aria-checked', 'false')
  await expect(deepSeek).toHaveAttribute('aria-checked', 'false')
  await expect(claude.locator('.KpoAskAiProviderMenu__check')).toBeVisible()
  await expect(menu.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('desktop ask ai flyout has a vertical divider separating it from navigation', async ({
  page
}) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('')

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await expect(flyout).toBeVisible()

  const pseudo = await flyout.evaluate((node) => {
    const style = getComputedStyle(node, '::before')
    return {
      content: style.content,
      width: style.width,
      height: style.height,
      backgroundColor: style.backgroundColor
    }
  })

  expect(pseudo.content).toBe('""')
  expect(pseudo.width).toBe('1px')
  expect(pseudo.height).toBe('24px')
  expect(pseudo.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
})

test('medium breakpoint hides ask ai flyout and shows it inside extra menu', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto('')

  await expect(page.locator('.VPNavBar .KpoAskAiProvider')).toBeHidden()

  const extra = page.locator('.VPNavBar .KpoNavBarExtra')
  await expect(extra).toBeVisible()

  await expect(page.locator('.VPNavBar .VPNavBarExtra.extra')).toBeHidden()

  await extra.hover()
  const menu = extra.locator('.VPMenu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('СПРОСИТЬ ИИ')
  await expect(menu).toContainText('ChatGPT')
  await expect(menu).toContainText('Claude')
  await expect(menu).toContainText('DeepSeek')
  await expect(menu).toContainText('Копировать промпт')

  await expect(extra.locator('.VPSwitchAppearance')).toBeVisible()
})

test('medium breakpoint ask ai provider selection syncs with desktop flyout', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto('')

  const extra = page.locator('.VPNavBar .KpoNavBarExtra')
  await extra.hover()
  await extra.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' }).click()

  await page.setViewportSize({ width: 1600, height: 900 })
  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const deepSeek = flyout.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(deepSeek).toHaveAttribute('aria-checked', 'true')
  await expect(flyout.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('tablet navbar has correct element ordering', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  const search = page.locator('.VPNavBar .VPNavBarSearch')
  const menu = page.locator('.VPNavBar .VPNavBarMenu')
  const extra = page.locator('.VPNavBar .KpoNavBarExtra')

  await expect(search).toBeVisible()
  await expect(menu).toBeVisible()
  await expect(extra).toBeVisible()

  const searchOrder = await search.evaluate((n) => getComputedStyle(n).order)
  const menuOrder = await menu.evaluate((n) => getComputedStyle(n).order)
  const extraOrder = await extra.evaluate((n) => getComputedStyle(n).order)

  expect(Number(searchOrder)).toBeLessThan(Number(menuOrder))
  expect(Number(menuOrder)).toBeLessThan(Number(extraOrder))
})

test('tablet search is compact and does not expand', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  const search = page.locator('.VPNavBar .VPNavBarSearch')
  const flexGrow = await search.evaluate((n) => getComputedStyle(n).flexGrow)
  const paddingLeft = await search.evaluate((n) => getComputedStyle(n).paddingLeft)

  expect(flexGrow).toBe('0')
  expect(paddingLeft).toBe('0px')
})

test('tablet DocSearch button uses KPO compact styling', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  const btn = page.locator('.VPNavBar .DocSearch-Button')
  const height = await btn.evaluate((n) => getComputedStyle(n).height)
  const borderRadius = await btn.evaluate((n) => getComputedStyle(n).borderRadius)
  const width = await btn.evaluate((n) => getComputedStyle(n).width)

  expect(parseInt(height)).toBe(28)
  expect(borderRadius).toBe('6px')
  expect(width).not.toBe(`${LAYOUT_VIEWPORTS.tablet.width}px`)
})

test('tablet nav links have KPO styling', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  const link = page.locator('.VPNavBar .VPNavBarMenuLink').first()
  const fontSize = await link.evaluate((n) => getComputedStyle(n).fontSize)
  const fontWeight = await link.evaluate((n) => getComputedStyle(n).fontWeight)

  expect(fontSize).toBe('14px')
  expect(Number(fontWeight)).toBeGreaterThanOrEqual(650)
})

test('tablet hides native VPNavBarExtra and hamburger', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  await expect(page.locator('.VPNavBar .VPNavBarExtra.extra')).toBeHidden()
  await expect(page.locator('.VPNavBar .VPNavBarHamburger')).toBeHidden()
  await expect(page.locator('.VPNavBar .KpoNavBarExtra')).toBeVisible()
})

test('tablet viewport has no horizontal page overflow', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto('')

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(overflow).toBe(false)
})

test('ask ai provider menu keeps selected and hover states clear', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('conclusion')

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  const chatGpt = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'ChatGPT' })
  const claude = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  const deepSeek = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(chatGpt).toHaveAttribute('aria-checked', 'true')
  await expect(claude).toHaveAttribute('aria-checked', 'false')
  await expect(chatGpt.locator('.KpoAskAiProviderMenu__check')).toBeVisible()

  const menuBackground = await menu.evaluate((node) => getComputedStyle(node).backgroundColor)
  const selectedBackground = await chatGpt.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  const selectedColor = await chatGpt.evaluate((node) => getComputedStyle(node).color)
  const claudeBackground = await claude.evaluate((node) => getComputedStyle(node).backgroundColor)
  const claudeColor = await claude.evaluate((node) => getComputedStyle(node).color)
  const deepSeekBackground = await deepSeek.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  expect(selectedBackground).toBe(claudeBackground)
  expect(deepSeekBackground).toBe(claudeBackground)
  expect(selectedColor).not.toBe(claudeColor)

  await claude.hover()
  await expect
    .poll(async () => {
      return claude.evaluate((node) => getComputedStyle(node).backgroundColor)
    })
    .not.toBe(claudeBackground)
  await deepSeek.hover()
  await expect
    .poll(async () => {
      return deepSeek.evaluate((node) => getComputedStyle(node).backgroundColor)
    })
    .not.toBe(menuBackground)
  const deepSeekHoverBackground = await deepSeek.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  expect(deepSeekHoverBackground).not.toBe(menuBackground)
})

test('mobile nav uses default vitepress screen and includes ask ai provider', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('lectures/01')

  await page.locator('.VPNavBarHamburger').click()

  await expect(page.locator('.VPNavScreen')).toBeVisible()
  await expect(page.locator('.VPNavScreen .VPNavScreenMenu')).toBeVisible()
  await expect(page.locator('.VPNavScreen .kpo-mobile-sheet-handle')).toHaveCount(0)
  await expect(page.locator('.VPNavScreen .kpo-mobile-nav-tiles')).toHaveCount(0)
  await expect(page.locator('.VPNavScreen')).toContainText('Введение')
  await expect(page.locator('.VPNavScreen')).toContainText('Лекции')
  await expect(page.locator('.VPNavScreen')).toContainText('Дополнения')
  await expect(page.locator('.VPNavScreen')).toContainText('Заключение')

  const provider = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  await expect(provider).toBeVisible()
  await expect(provider).toContainText('СПРОСИТЬ ИИ')
  await expect(provider).toContainText('ChatGPT')
  await expect(provider).toContainText('Claude')
  await expect(provider).toContainText('DeepSeek')
  await expect(provider).toContainText('Копировать промпт')
  await expect(page.locator('.VPNavScreen .VPSwitchAppearance')).toBeVisible()
})

test('mobile ask ai provider changes and persists in default vitepress screen', async ({
  page
}) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('intro')

  await page.locator('.VPNavBarHamburger').click()
  const provider = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  await provider.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' }).click()

  await page.locator('.VPNavBarHamburger').click()
  await page.locator('.VPNavBarHamburger').click()
  const reopened = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  const claude = reopened.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  await expect(claude).toHaveAttribute('aria-checked', 'true')
  await expect(claude.locator('.KpoAskAiProviderMenu__check')).toBeVisible()
  await expect(reopened.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('intro documents ask ai workflow', async ({ page }) => {
  await clearStorage(page)
  await page.goto('intro')

  await expect(page.getByRole('heading', { name: 'Спросить ИИ о фрагменте' })).toBeVisible()
  await expect(page.locator('.vp-doc')).toContainText('ChatGPT')
  await expect(page.locator('.vp-doc')).toContainText('Claude')
  await expect(page.locator('.vp-doc')).toContainText('DeepSeek')
  await expect(page.locator('.vp-doc')).toContainText('не вызывает AI API')
  await expect(page.locator('.vp-doc')).toContainText('не отправляет текст на сервер')
  await expect(page.locator('.vp-doc')).toContainText('правой кнопкой')
  await expect(page.locator('.vp-doc')).toContainText('на мобильном')
})

test('local search shows matching excerpts by default', async ({ page }) => {
  await clearStorage(page)
  await page.goto('intro')
  await searchFor(page, 'customerTier')

  const result = page.locator('.VPLocalSearchBox .result').first()
  await expect(result).toHaveAttribute('href', /\/extras\/01#runnable-kotlin-playground/)

  await expect(
    page
      .locator('.VPLocalSearchBox .excerpt mark[data-markjs="true"]')
      .filter({ hasText: /customerTier|CustomerTier/ })
      .first()
  ).toBeVisible()
})

test('local search result navigates to the matched section', async ({ page }) => {
  await clearStorage(page)
  await page.goto('intro')
  await searchFor(page, 'customerTier')
  const result = page.locator('.VPLocalSearchBox .result').first()

  await expect(result).toHaveAttribute('href', /\/extras\/01#runnable-kotlin-playground/)
  await result.click()

  await expect(page).toHaveURL(/\/extras\/01#runnable-kotlin-playground/)
  await expect(page.getByRole('heading', { name: 'Runnable Kotlin Playground' })).toBeVisible()
})

test('ask ai context menu appears for selected document text', async ({ page }) => {
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)

  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')

  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
  await expect(page.locator('.kpo-ai-menu')).toContainText('Ask ChatGPT about this')
})

test('ask ai waits for prompt preparation before first clipboard copy', async ({ page }) => {
  await clearStorage(page)
  let releaseContext!: () => void
  const contextGate = new Promise<void>((resolve) => {
    releaseContext = resolve
  })

  await page.addInitScript(() => {
    ;(window as unknown as { __kpoAllowCopy: boolean }).__kpoAllowCopy = false
    ;(
      window as unknown as { __kpoCopyAttempts: Array<Record<string, unknown>> }
    ).__kpoCopyAttempts = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          const state = window as unknown as {
            __kpoAllowCopy: boolean
            __kpoCopyAttempts: Array<Record<string, unknown>>
          }
          state.__kpoCopyAttempts.push({
            method: 'clipboard-api',
            allowed: state.__kpoAllowCopy,
            active: navigator.userActivation?.isActive ?? false,
            focus: document.hasFocus(),
            length: text.length
          })
          if (!state.__kpoAllowCopy) {
            throw new DOMException('copy not allowed yet', 'NotAllowedError')
          }
        }
      }
    })
  })

  await page.route('**/__ask-ai-context/**', async (route) => {
    await contextGate
    await route.continue()
  })

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Копировать промпт')
  await selectTextAndOpenAskAiMenu(page, 'RESTful API')

  const menuItem = page.locator('.kpo-ai-menu__item')
  await expect(menuItem).toBeDisabled()
  await expect(menuItem).toHaveText('Preparing prompt...')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as unknown as { __kpoAllowCopy: boolean }).__kpoAllowCopy = true
  })
  releaseContext()
  await expect(menuItem).toBeEnabled()
  await menuItem.click()

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const attempts = await page.evaluate(() => {
    return (window as unknown as { __kpoCopyAttempts: Array<Record<string, unknown>> })
      .__kpoCopyAttempts
  })
  expect(attempts).toHaveLength(1)
  expect(attempts[0]).toMatchObject({
    method: 'clipboard-api',
    allowed: true,
    focus: true
  })
})

test('ask ai starts clipboard copy before opening provider tab', async ({ page }) => {
  await clearStorage(page)
  await page.addInitScript(() => {
    ;(window as unknown as { __kpoSideEffectOrder: string[] }).__kpoSideEffectOrder = []
    ;(window as unknown as { __kpoOpenedUrls: string[] }).__kpoOpenedUrls = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          ;(window as unknown as { __kpoSideEffectOrder: string[] }).__kpoSideEffectOrder.push(
            'copy'
          )
        }
      }
    })

    window.open = ((url?: string | URL) => {
      const state = window as unknown as {
        __kpoSideEffectOrder: string[]
        __kpoOpenedUrls: string[]
      }
      state.__kpoSideEffectOrder.push('open')
      if (url) state.__kpoOpenedUrls.push(String(url))

      const fakeLocation = {}
      Object.defineProperty(fakeLocation, 'href', {
        set(value: string) {
          state.__kpoSideEffectOrder.push('navigate')
          state.__kpoOpenedUrls.push(String(value))
        },
        get() {
          return ''
        }
      })

      return {
        opener: null,
        close: () => undefined,
        location: fakeLocation
      } as Window
    }) as typeof window.open
  })

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Claude')
  await selectTextAndClickAskAiMenuItem(page, 'RESTful API')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened Claude')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const result = await page.evaluate(() => {
    const state = window as unknown as {
      __kpoSideEffectOrder: string[]
      __kpoOpenedUrls: string[]
    }
    return {
      order: state.__kpoSideEffectOrder,
      openedUrls: state.__kpoOpenedUrls
    }
  })
  expect(result.order.slice(0, 2)).toEqual(['copy', 'open'])
  expect(result.openedUrls).toContain('https://claude.ai/new')
})

test('ask ai manual prompt appears only after clipboard methods fail', async ({ page }) => {
  await clearStorage(page)
  await page.addInitScript(() => {
    ;(window as unknown as { __kpoCopyAttempts: string[] }).__kpoCopyAttempts = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          ;(window as unknown as { __kpoCopyAttempts: string[] }).__kpoCopyAttempts.push(
            'clipboard-api'
          )
          throw new DOMException('blocked', 'NotAllowedError')
        }
      }
    })
    document.execCommand = ((command: string) => {
      ;(window as unknown as { __kpoCopyAttempts: string[] }).__kpoCopyAttempts.push(
        `textarea-${command}`
      )
      return false
    }) as typeof document.execCommand
  })

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Копировать промпт')
  await selectTextAndClickAskAiMenuItem(page, 'RESTful API')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Copy prompt manually')
  await expect(page.locator('.kpo-ai-manual')).toBeVisible()

  const attempts = await page.evaluate(() => {
    return (window as unknown as { __kpoCopyAttempts: string[] }).__kpoCopyAttempts
  })
  expect(attempts).toEqual(['clipboard-api', 'textarea-copy'])
})

test('ask ai copies full page context without duplicating VitePress base', async ({ page }) => {
  await clearStorage(page)
  const contextPaths: string[] = []

  await stubAskAiSideEffects(page)

  await page.route('**/__ask-ai-context/**', async (route) => {
    contextPaths.push(new URL(route.request().url()).pathname)
    await route.continue()
  })

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  const selectedText =
    'idempotency: повтор некоторых запросов должен быть безопасен для итогового состояния;'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied')
  expect(contextPaths).toContain('/KPO/__ask-ai-context/lectures/10.json')
  expect(contextPaths).not.toContain('/KPO/__ask-ai-context/KPO/lectures/10.json')

  const copiedPrompt = await page.evaluate(() => {
    return (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
  })

  expect(copiedPrompt).toContain('[Контекст после]\nПример REST-дизайна')
  expect(copiedPrompt).toContain('Основные идеи RESTful API:')
  expect(copiedPrompt).toContain('- idempotency: повтор некоторых запросов')
  expect(copiedPrompt).toContain(`[Выделенный фрагмент]\n${selectedText}`)
})

test('ask ai keeps clipboard fallback when page context is unavailable', async ({ page }) => {
  await clearStorage(page)

  await stubAskAiSideEffects(page)

  await page.route('**/__ask-ai-context/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'missing context'
    })
  })

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  const selectedText =
    'idempotency: повтор некоторых запросов должен быть безопасен для итогового состояния;'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied without page context')

  const copiedPrompt = await page.evaluate(() => {
    return (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
  })

  expect(copiedPrompt).toContain(`[Текущий блок]\n${selectedText}`)
  expect(copiedPrompt).toContain(`[Выделенный фрагмент]\n${selectedText}`)
})

test('ask ai copies prompt and opens base ChatGPT without query parameter', async ({ page }) => {
  await clearStorage(page)
  await stubAskAiSideEffects(page)

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'ChatGPT')

  const selectedText = 'string status = 2;'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened ChatGPT')

  const result = await page.evaluate(() => {
    return {
      prompt:
        (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? '',
      openedUrls: (window as unknown as { __kpoOpenedUrls?: string[] }).__kpoOpenedUrls ?? []
    }
  })

  expect(result.openedUrls).toContain('https://chatgpt.com/')
  expect(result.openedUrls.some((url) => url.startsWith('https://chatgpt.com/?q='))).toBe(false)
  expect(result.prompt).toContain('message OrderResponse')
  expect(result.prompt).toContain(selectedText)
})

test('ask ai includes bridge and HTTP response after report endpoint selection', async ({
  page
}) => {
  await clearStorage(page)
  await stubAskAiSideEffects(page)

  await page.goto('lectures/10')
  await waitForAdaptiveTables(page)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  const selectedText = '/api/v1/reports/jobs/{jobId}'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied')

  const copiedPrompt = await page.evaluate(() => {
    return (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
  })

  expect(copiedPrompt).toContain('[Текущий блок]')
  expect(copiedPrompt).toContain('| Проверить задачу | `/api/v1/reports/jobs/{jobId}`')
  expect(copiedPrompt).toContain('Ответ на запуск может выглядеть так:')
  expect(copiedPrompt).toContain('HTTP/1.1 202 Accepted')
  expect(copiedPrompt).toContain('Location: /api/v1/reports/jobs/job-7')
})

test('ask ai copies and opens Claude without showing manual prompt', async ({ page }) => {
  await clearStorage(page)
  await stubAskAiSideEffects(page)

  await page.goto('lectures/10')
  await selectAskAiProviderDesktop(page, 'Claude')

  await selectTextAndClickAskAiMenuItem(page, 'RESTful API')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened Claude')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const result = await page.evaluate(() => {
    return {
      prompt:
        (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? '',
      openedUrls: (window as unknown as { __kpoOpenedUrls?: string[] }).__kpoOpenedUrls ?? []
    }
  })

  expect(result.prompt).toContain('RESTful API')
  expect(result.openedUrls).toContain('https://claude.ai/new')
})

test('ask ai mobile bubble appears after text selection', async ({ page }) => {
  await clearStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(UI_FIXTURE_ROUTE)
  await page.locator('.KpoAskAiProvider').waitFor({ state: 'attached' })
  await waitForMermaid(page, { requireDiagrams: true })
  await waitForAdaptiveTables(page)
  await waitForPageLayoutReady(page)

  await page
    .locator('.vp-doc p')
    .first()
    .evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })

  const mobileMenu = page.locator('.kpo-ai-menu--mobile')
  await expect(mobileMenu).toBeVisible()
  await expect(mobileMenu).toContainText('Ask AI')
})

test('code switchers without author defaults follow the latest global language', async ({
  page
}) => {
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  await switchers.nth(0).getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switchers.nth(0), 'Java')
  await expectActiveTab(switchers.nth(1), 'Java')
  await expectActiveTab(switchers.nth(2), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switchers.nth(0), 'Kotlin')
  await expectActiveTab(switchers.nth(1), 'Kotlin')
  await expectActiveTab(switchers.nth(2), 'Kotlin')
})

test('public lecture switchers honor persisted global language without boilerplate defaults', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'java',
    'kpo:playground-mode': '0'
  })
  await page.goto('lectures/02')

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  const compatible = switchers.filter({
    has: page.getByRole('tab', { name: 'Java' })
  })
  const compatibleCount = Math.min(5, await compatible.count())

  expect(compatibleCount).toBeGreaterThan(0)

  for (let index = 0; index < compatibleCount; index += 1) {
    await expectActiveTab(compatible.nth(index), 'Java')
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('author default beats restored language until that block is clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const switcher = page.locator('.kpo-switcher').nth(3)
  await expectActiveTab(switcher, 'Go')
  await expectNoPageOverflowFromVpDoc(page)

  await switcher.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switcher, 'Kotlin')
  await expectNoPageOverflowFromVpDoc(page)
})

test('released author-default block follows subsequent global language changes', async ({
  page
}) => {
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)

  const switchers = page.locator('.kpo-switcher')
  const authorDefault = switchers.nth(3)

  await expectActiveTab(authorDefault, 'Go')

  await authorDefault.getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(authorDefault, 'Java')
  await expectActiveTab(switchers.nth(0), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(authorDefault, 'Kotlin')
  await expectActiveTab(switchers.nth(0), 'Kotlin')
})

test('intentional author default remains protected on intro until clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto('intro')

  const authorDefault = page.locator('.kpo-switcher').filter({
    hasText: 'Авторский default: Go'
  })
  const firstSwitcher = page.locator('.kpo-switcher').first()

  await expectActiveTab(authorDefault, 'Go')
  await expectActiveTab(firstSwitcher, 'Kotlin')

  await authorDefault.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expectActiveTab(authorDefault, 'Kotlin')

  await firstSwitcher.getByRole('tab', { name: 'Go' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expectActiveTab(authorDefault, 'Go')
})

test('language-only text follows global language used by ordinary code switchers', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'java',
    'kpo:playground-mode': '0'
  })
  await page.goto('intro')

  const firstSwitcher = page.locator('.kpo-switcher').first()
  await expectActiveTab(firstSwitcher, 'Java')

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.kpoLang ?? ''))
    .toBe('java')
  await expect(page.locator('.kpo-only--java').filter({ hasText: 'System.exit' })).toBeVisible()
  await expect(page.locator('.kpo-only--kotlin').filter({ hasText: 'exitProcess' })).toBeHidden()
  await expectNoPageOverflowFromVpDoc(page)
})

test('playground toggle is only rendered for the active kotlin tab', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const playgroundSwitcher = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture Kotlin Playground'
  })

  await expectActiveTab(playgroundSwitcher, 'Kotlin')
  await expect(playgroundSwitcher.locator('.kpo-switcher__playground-toggle')).toHaveCount(1)

  await playgroundSwitcher.getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expect(playgroundSwitcher.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)

  await playgroundSwitcher.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expect(playgroundSwitcher.locator('.kpo-switcher__playground-toggle')).toHaveCount(1)

  const playgroundOff = page.locator('.kpo-switcher').filter({ hasText: 'Fixture playground off' })
  await expect(playgroundOff.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
})

test('fixture renders mermaid and keeps playground disabled for marked blocks', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  await waitForMermaid(page, { requireDiagrams: true })

  await expect.poll(async () => page.locator('.kpo-mermaid').count()).toBeGreaterThan(0)
  await expect(page.locator('.kpo-mermaid__error')).toHaveCount(0)

  const playgroundOff = page.locator('.kpo-switcher').filter({ hasText: 'Fixture playground off' })
  await expect(playgroundOff).toHaveCount(1)
  await expect(playgroundOff.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
  await expect(playgroundOff.locator('.kpo-playground')).toHaveCount(0)
})

test('fixture text code blocks keep overflow local on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await clearStorage(page)
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

test('sidebar toggle does not navigate away from the current page', async ({ page }) => {
  await page.goto(UI_FIXTURE_ROUTE)

  const beforeUrl = page.url()
  const html = page.locator('html')
  const wasHidden = await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))

  await page.locator('.kpo-sidebar-toggle').click()

  await expect(page).toHaveURL(beforeUrl)
  await expect
    .poll(async () => {
      return html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
    })
    .toBe(!wasHidden)
  await expectNoPageOverflowFromVpDoc(page)
})

test('last updated footer uses european date with AM PM time', async ({ page }) => {
  let checkedFooters = 0

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await page.locator('.vp-doc').first().waitFor({ state: 'attached' })
    const footers = page.locator('.VPLastUpdated')
    const count = await footers.count()

    for (let index = 0; index < count; index += 1) {
      await expect(footers.nth(index)).toContainText(
        /Обновлено:\s+\d{2}\.\d{2}\.\d{2},\s+\d{2}:\d{2}\s+(AM|PM)/
      )
      checkedFooters += 1
    }
  }

  expect(checkedFooters).toBeGreaterThan(0)
})

test('hidden sidebar expands wide content lane but keeps prose narrow', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const open = await measureWideLane(page)
  const beforeUrl = page.url()

  await hideSidebar(page)
  await expectNoPageOverflowFromVpDoc(page)

  const hidden = await measureWideLane(page)

  await expect(page).toHaveURL(beforeUrl)
  expect(hidden.contentContainerWidth).toBeGreaterThan(open.contentContainerWidth + 200)
  expect(hidden.mermaidWideBlockWidth).toBeGreaterThan(open.mermaidWideBlockWidth + 200)
  expect(hidden.paragraphWidth).toBeLessThanOrEqual(
    Number.parseInt(CONTENT_LAYOUT_TOKENS.proseWidth, 10) + DESKTOP_PROSE_TOLERANCE_PX
  )
  await expectNoPageOverflowFromVpDoc(page)
})

test('moderately wide mermaid diagrams fit the expanded lane when sidebar is hidden', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  const fitted = []

  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  const openMetrics = await getMermaidMetrics(page)

  await hideSidebar(page)
  await expectNoPageOverflowFromVpDoc(page)

  const hiddenMetrics = await getMermaidMetrics(page)
  fitted.push(
    ...hiddenMetrics.filter((item) => {
      return openMetrics[item.index]?.hasLocalXScroll && !item.hasLocalXScroll
    })
  )

  expect(fitted.length, JSON.stringify({ openMetrics, hiddenMetrics }, null, 2)).toBeGreaterThan(0)

  for (const item of fitted) {
    expect(item.hasLocalXScroll).toBe(false)
    expect(item.svgWidth).toBeLessThanOrEqual(item.containerClientWidth + 1)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('small mermaid diagrams are not auto-upscaled on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await expect.poll(async () => page.locator('.kpo-mermaid').count()).toBeGreaterThan(0)
  await waitForMermaid(page, { requireDiagrams: true })

  const metrics = await getMermaidMetrics(page)
  const small = metrics.filter((item) => item.viewBoxWidth <= item.containerClientWidth)
  expect(small.length).toBeGreaterThan(0)

  for (const item of small) {
    expect(item.scaleX, JSON.stringify(item)).toBeLessThanOrEqual(1 + SCALE_TOLERANCE)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('very wide mermaid diagrams stay readable and scroll locally on desktop', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await hideSidebar(page)
  await expectNoPageOverflowFromVpDoc(page)

  const metrics = await getMermaidMetrics(page)
  const veryWide = metrics.filter((item) => {
    return (
      item.viewBoxWidth > item.containerClientWidth / CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale
    )
  })

  expect(veryWide.length).toBeGreaterThan(0)

  for (const item of veryWide) {
    expect(item.scaleX).toBeGreaterThanOrEqual(CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale - 0.01)
    expect(item.svgHeight).toBeGreaterThanOrEqual(MIN_READABLE_MERMAID_HEIGHT_PX)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
    expect(item.hasLocalXScroll).toBe(true)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('public mermaid viewports use automatic height and horizontal-only local overflow', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  const mermaidRoutes = PUBLIC_CONTENT_ROUTES.filter((route) => {
    return route === 'intro' || route.startsWith('lectures/')
  })

  for (const route of mermaidRoutes) {
    await page.goto(route)
    await waitForMermaid(page, { requireDiagrams: true })

    const states = await page.locator('.kpo-mermaid').evaluateAll((nodes) => {
      return nodes.map((root) => {
        const viewport = root.querySelector('.kpo-mermaid__viewport') as HTMLElement | null
        const svg = root.querySelector('svg')
        const viewportRect = viewport?.getBoundingClientRect()
        const svgRect = svg?.getBoundingClientRect()
        return {
          hasViewport: Boolean(viewport),
          clientHeight: viewport?.clientHeight ?? 0,
          scrollHeight: viewport?.scrollHeight ?? 0,
          viewportHeight: viewportRect?.height ?? 0,
          svgHeight: svgRect?.height ?? 0,
          hasLocalXScroll: Boolean(viewport && viewport.scrollWidth > viewport.clientWidth + 1),
          successfulSourceDetails: root.querySelectorAll(':scope > details, .kpo-mermaid__source')
            .length
        }
      })
    })

    expect(states.length, route).toBeGreaterThan(0)
    for (const state of states) {
      expect(state.hasViewport, JSON.stringify({ route, state })).toBe(true)
      expect(state.scrollHeight, JSON.stringify({ route, state })).toBe(state.clientHeight)
      expect(
        Math.abs(state.viewportHeight - state.svgHeight),
        JSON.stringify({ route, state })
      ).toBeLessThanOrEqual(1)
      expect(state.successfulSourceDetails, JSON.stringify({ route, state })).toBe(0)
    }

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('a taller mermaid SVG expands the page while horizontal overflow remains local', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const diagram = page.locator('.kpo-mermaid').first()
  const before = await diagram.evaluate((root) => {
    const viewport = root.querySelector('.kpo-mermaid__viewport') as HTMLElement
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: viewport.clientHeight
    }
  })

  await diagram.getByRole('button', { name: 'Увеличить диаграмму' }).click()
  await expect
    .poll(async () =>
      diagram.locator('.kpo-mermaid__viewport').evaluate((viewport) => {
        return (viewport as HTMLElement).clientHeight
      })
    )
    .toBeGreaterThan(before.viewportHeight)

  const after = await diagram.evaluate((root) => {
    const viewport = root.querySelector('.kpo-mermaid__viewport') as HTMLElement
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      hasLocalXScroll: viewport.scrollWidth > viewport.clientWidth + 1
    }
  })

  expect(after.documentHeight).toBeGreaterThan(before.documentHeight)
  expect(after.scrollHeight).toBe(after.viewportHeight)
  expect(after.hasLocalXScroll).toBe(true)
  await expectNoPageOverflowFromVpDoc(page)
})

test('hidden sidebar enters focused-wide mode and removes the outline from layout', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await hideSidebar(page)

  const state = await page.evaluate(() => {
    const aside = document.querySelector('.VPDoc.has-aside > .container > .aside')
    const contentContainer = document.querySelector(
      '.VPDoc.has-aside > .container > .content > .content-container'
    )
    const rect = contentContainer?.getBoundingClientRect()
    const style = aside ? getComputedStyle(aside) : null
    return {
      asideDisplay: style?.display ?? null,
      centerDelta: rect
        ? Math.abs((rect.left + rect.right) / 2 - document.documentElement.clientWidth / 2)
        : Number.NaN
    }
  })

  expect(state.asideDisplay).toBe('none')
  expect(state.centerDelta).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  await expectCenteredAgainstPage(page, page.locator('.kpo-content-block--table').first())
  await expectNoPageOverflowFromVpDoc(page)
})

test('mermaid zoom controls adjust scale without page overflow', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const diagram = page.locator('.kpo-mermaid').first()
  const svg = diagram.locator('svg')
  const width = async () => {
    return svg.evaluate((node) => node.getBoundingClientRect().width)
  }

  const autoWidth = await width()

  await diagram.getByRole('button', { name: 'Увеличить диаграмму' }).click()
  await expect.poll(width).toBeGreaterThan(autoWidth)
  await expectNoPageOverflowFromVpDoc(page)

  const zoomedWidth = await width()
  await diagram.getByRole('button', { name: 'Уменьшить диаграмму' }).click()
  await expect.poll(width).toBeLessThan(zoomedWidth)
  await expectNoPageOverflowFromVpDoc(page)

  await diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' }).click()
  await expect.poll(width).toBeCloseTo(autoWidth, 0)

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
  await page.waitForTimeout(500)

  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await page.waitForTimeout(500)

  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)
})

test('public theme switch keeps pages viewport-contained', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await waitForMermaid(page)
    await waitForAdaptiveTables(page)

    await expectNoGlobalOverflowMask(page)
    await expectNoPageOverflowFromVpDoc(page)

    await page.locator('.VPSwitchAppearance').first().click()
    await page.waitForTimeout(250)

    await expectNoGlobalOverflowMask(page)
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('language click preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(1)
  await waitForPageLayoutReady(page)
  await switcher.evaluate((node) => node.scrollIntoView({ block: 'center' }))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('tab', { name: 'Java' }).click()
  await waitForPageLayoutReady(page)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('keyboard language switch preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(1)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 260))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('tab', { name: 'Kotlin' }).focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(150)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('playground toggle preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(4)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 260))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('button', { name: /Playground/ }).click()
  await page.waitForTimeout(250)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('enabling a public playground preserves its viewport anchor through initialization', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto('lectures/02')
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(6)
  const toggle = switcher.getByRole('button', { name: /Playground/ })
  await toggle.evaluate((node) => node.scrollIntoView({ block: 'center' }))

  const before = await measureViewportRelativeTo(switcher)
  await toggle.click()
  await waitForScopedPlayground(page, switcher)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('Home and End language navigation preserves the anchor around async playground state', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'go',
    'kpo:playground-mode': '1'
  })
  await page.goto('lectures/02')

  const switcher = page.locator('.kpo-switcher').nth(6)
  const goTab = switcher.getByRole('tab', { name: 'Go' })
  await goTab.focus()

  const beforeHome = await measureViewportRelativeTo(switcher)
  await page.keyboard.press('Home')
  await waitForScopedPlayground(page, switcher)
  const afterHome = await measureViewportRelativeTo(switcher)
  await expectViewportAnchorStable(beforeHome, afterHome)

  const beforeEnd = await measureViewportRelativeTo(switcher)
  await page.keyboard.press('End')
  await expectActiveTab(switcher, 'Go')
  const afterEnd = await measureViewportRelativeTo(switcher)
  await expectViewportAnchorStable(beforeEnd, afterEnd)
  await expectNoPageOverflowFromVpDoc(page)
})

test('user scroll takes ownership while a delayed playground is initializing', async ({ page }) => {
  await page.route('**/*kotlin-playground*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await route.continue()
  })
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'go',
    'kpo:playground-mode': '1'
  })
  await page.goto('lectures/02')

  const switcher = page.locator('.kpo-switcher').nth(6)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 240))
  await switcher.getByRole('tab', { name: 'Go' }).focus()

  const playgroundRequest = page.waitForRequest('**/*kotlin-playground*')
  await page.keyboard.press('Home')
  await playgroundRequest
  await page.mouse.wheel(0, 360)
  const userOwnedScroll = await page.evaluate(() => window.scrollY)

  await waitForScopedPlayground(page, switcher)
  const settledScroll = await page.evaluate(() => window.scrollY)
  expect(settledScroll).toBeGreaterThanOrEqual(userOwnedScroll - ANCHOR_TOLERANCE_PX)
})

test('persisted language hydration stays stable across responsive breakpoints', async ({
  page
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __kpoSwitcherLayoutShift: number }).__kpoSwitcherLayoutShift = 0
    const observer = new PerformanceObserver((list) => {
      for (const rawEntry of list.getEntries()) {
        const entry = rawEntry as PerformanceEntry & {
          value: number
          hadRecentInput: boolean
          sources?: Array<{ node?: Node }>
        }
        if (entry.hadRecentInput) continue
        const affectsSwitcher = entry.sources?.some(({ node }) => {
          const element = node instanceof Element ? node : node?.parentElement
          return Boolean(element?.closest('.kpo-switcher'))
        })
        if (affectsSwitcher) {
          ;(window as unknown as { __kpoSwitcherLayoutShift: number }).__kpoSwitcherLayoutShift +=
            entry.value
        }
      }
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('')

  const scenarios = [
    { viewport: { width: 390, height: 844 }, language: 'java', playgroundMode: '1' },
    { viewport: { width: 768, height: 900 }, language: 'go', playgroundMode: '0' },
    { viewport: { width: 800, height: 900 }, language: 'java', playgroundMode: '0' },
    { viewport: { width: 1440, height: 1000 }, language: 'kotlin', playgroundMode: '1' }
  ] as const

  for (const scenario of scenarios) {
    await page.setViewportSize(scenario.viewport)
    await page.evaluate(({ language, playgroundMode }) => {
      localStorage.setItem('kpo:code-language', language)
      localStorage.setItem('kpo:playground-mode', playgroundMode)
    }, scenario)
    await page.goto('extras/01')

    const switcher = page.locator('.kpo-switcher').first()
    await expectActiveTab(
      switcher,
      scenario.language === 'kotlin' ? 'Kotlin' : scenario.language === 'java' ? 'Java' : 'Go'
    )
    if (scenario.language === 'kotlin' && scenario.playgroundMode === '1') {
      await waitForScopedPlayground(page, switcher, { transaction: false })
    } else {
      await expect(switcher.locator('.kpo-playground:visible')).toHaveCount(0)
      await expect(switcher.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
    }

    await expectNoPageOverflowFromVpDoc(page)
    const layoutShift = await page.evaluate(() => {
      return (window as unknown as { __kpoSwitcherLayoutShift: number }).__kpoSwitcherLayoutShift
    })
    expect(layoutShift, JSON.stringify(scenario)).toBeLessThanOrEqual(0.001)
  }
})

test('overflowing mermaid diagrams start centered in their local viewport', async ({ page }) => {
  for (const viewport of [LAYOUT_VIEWPORTS.mobilePhone, LAYOUT_VIEWPORTS.narrowDesktop]) {
    await page.setViewportSize(viewport)
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForMermaid(page, { requireDiagrams: true })

    await expect
      .poll(async () => {
        return page.locator('.kpo-mermaid__viewport').evaluateAll((nodes) => {
          return nodes
            .map((node) => {
              const element = node as HTMLElement
              return {
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                scrollLeft: Math.round(element.scrollLeft)
              }
            })
            .filter((item) => item.scrollWidth > item.clientWidth + 1)
            .every((item) => {
              const expected = Math.round((item.scrollWidth - item.clientWidth) / 2)
              return Math.abs(item.scrollLeft - expected) <= 2
            })
        })
      })
      .toBe(true)

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('manual mermaid scroll is preserved across zoom and reset recenters', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const diagram = page
    .locator('.kpo-mermaid')
    .filter({
      has: page.locator('.kpo-mermaid__viewport')
    })
    .first()
  const viewport = diagram.locator('.kpo-mermaid__viewport')

  await viewport.evaluate((node) => {
    const element = node as HTMLElement
    element.scrollLeft = 0
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  const ratioBefore = await viewport.evaluate((node) => {
    const element = node as HTMLElement
    return (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
  })

  await diagram.getByRole('button', { name: 'Увеличить диаграмму' }).click()
  await page.waitForTimeout(150)
  await expectNoPageOverflowFromVpDoc(page)

  const ratioAfterZoom = await viewport.evaluate((node) => {
    const element = node as HTMLElement
    return (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
  })
  expect(Math.abs(ratioAfterZoom - ratioBefore)).toBeLessThanOrEqual(0.03)

  await diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' }).click()
  await page.waitForTimeout(150)
  await expectNoPageOverflowFromVpDoc(page)

  const centered = await viewport.evaluate((node) => {
    const element = node as HTMLElement
    const expected = Math.round((element.scrollWidth - element.clientWidth) / 2)
    return Math.abs(Math.round(element.scrollLeft) - expected) <= 2
  })
  expect(centered).toBe(true)
})

test('mermaid zoom controls visibility follows overflow, hover and focus', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await hideSidebar(page)

  const fittingIndex = await page.locator('.kpo-mermaid').evaluateAll((nodes) => {
    return nodes.findIndex((node) => {
      const viewport = node.querySelector('.kpo-mermaid__viewport') as HTMLElement | null
      return viewport && viewport.scrollWidth <= viewport.clientWidth + 1
    })
  })
  expect(fittingIndex).toBeGreaterThanOrEqual(0)

  const fitting = page.locator('.kpo-mermaid').nth(fittingIndex)
  const toolbar = fitting.locator('.kpo-mermaid__toolbar')
  await expect(toolbar).toHaveCSS('opacity', '0')

  await fitting.hover()
  await expect(toolbar).toHaveCSS('opacity', '1')

  await fitting.getByRole('button', { name: 'Увеличить диаграмму' }).focus()
  await expect(toolbar).toHaveCSS('opacity', '1')
  await expectNoPageOverflowFromVpDoc(page)

  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const overflowing = page.locator('.kpo-mermaid--has-overflow').first()
  await expect(overflowing.locator('.kpo-mermaid__toolbar')).toHaveCSS('opacity', '1')
  await expectNoPageOverflowFromVpDoc(page)
})

test('fixture mermaid dark theme keeps label colors readable and token-based', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const isDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'))
  if (!isDark) {
    await page.locator('.VPSwitchAppearance').first().click()
  }
  await expect
    .poll(async () => {
      return page.locator('html').evaluate((node) => node.classList.contains('dark'))
    })
    .toBe(true)
  await page.waitForTimeout(500)

  const labels = await getMermaidLabelContrasts(page)

  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels) {
    expect(label.contrast).toBeGreaterThanOrEqual(4.5)
    expect(label.color).not.toBe('rgb(0, 0, 0)')
  }
  await expectNoPageOverflowFromVpDoc(page)
})

test('public mermaid dark theme labels are readable when present', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await waitForMermaid(page)

    const isDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'))
    if (!isDark) {
      await page.locator('.VPSwitchAppearance').first().click()
    }
    await expect
      .poll(async () => {
        return page.locator('html').evaluate((node) => node.classList.contains('dark'))
      })
      .toBe(true)
    await page.waitForTimeout(250)

    const labels = await getMermaidLabelContrasts(page)
    for (const label of labels) {
      expect(label.contrast, JSON.stringify({ route, label }, null, 2)).toBeGreaterThanOrEqual(4.5)
      expect(label.color).not.toBe('rgb(0, 0, 0)')
    }

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('fixture mermaid text and foreignObject labels are not clipped', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  await expect
    .poll(async () =>
      page.locator('.kpo-mermaid svg .nodeLabel, .kpo-mermaid svg .edgeLabel span').count()
    )
    .toBeGreaterThan(0)

  const issues = await getMermaidClipIssues(page)
  expect(issues, JSON.stringify({ route: UI_FIXTURE_ROUTE, issues }, null, 2)).toEqual([])
  await expectNoPageOverflowFromVpDoc(page)
})

test('public mermaid diagrams render without errors and labels are not clipped when present', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await waitForMermaid(page)

    await expect(page.locator('.kpo-mermaid__error')).toHaveCount(0)
    const issues = await getMermaidClipIssues(page)

    expect(issues, JSON.stringify({ route, issues }, null, 2)).toEqual([])
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('wide tables are centered in the hidden-sidebar wide lane', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await waitForAdaptiveTables(page)
  await hideSidebar(page)
  await waitForAdaptiveTables(page)

  const tableBlocks = page.locator('.kpo-content-block--table')
  const states = await tableBlocks.evaluateAll((nodes) => {
    return nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      const pageCenter = document.documentElement.clientWidth / 2
      return {
        centerDelta: Math.round(Math.abs((rect.left + rect.right) / 2 - pageCenter)),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        viewport: document.documentElement.clientWidth,
        width: Math.round(rect.width)
      }
    })
  })

  expect(states.length).toBeGreaterThan(0)
  for (const state of states) {
    expect(state.centerDelta, JSON.stringify(state)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
    expect(state.left).toBeGreaterThanOrEqual(-CENTER_TOLERANCE_PX)
    expect(state.right).toBeLessThanOrEqual(state.viewport + CENTER_TOLERANCE_PX)
  }
  await expectNoPageOverflowFromVpDoc(page)
})

test('wide elements use the expanded lane when sidebar is hidden', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  const cases = [
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-wide-block--mermaid' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-wide-block--code' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-content-block--table' },
    { route: UI_FIXTURE_ROUTE, selector: '.vp-doc p:has(> img:only-child)' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-playground', playground: true }
  ] as const

  for (const item of cases) {
    await page.goto(item.route)
    await waitForMermaid(page, { requireDiagrams: true })
    await waitForAdaptiveTables(page)

    if ('playground' in item && item.playground) {
      await page.evaluate(() => localStorage.setItem('kpo:playground-mode', '1'))
      await page.reload()
      await waitForAdaptiveTables(page)
      await page.locator('.kpo-switcher').first().getByRole('tab', { name: 'Kotlin' }).click()
    }

    await expect.poll(async () => page.locator(item.selector).count()).toBeGreaterThan(0)
    const openWidth = await measureFirstWidth(page, item.selector)

    await hideSidebar(page)

    const hiddenWidth = await measureFirstWidth(page, item.selector)
    expect(hiddenWidth, item.selector).toBeGreaterThan(openWidth + 100)
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('content pages do not create horizontal page overflow on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await waitForMermaid(page)
    await waitForAdaptiveTables(page)
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('published markdown tables all use the adaptive table contract on mobile', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  for (const route of PUBLIC_CONTENT_ROUTES) {
    await page.goto(route)
    await waitForMermaid(page)
    await waitForAdaptiveTables(page)

    const result = await page.evaluate(() => {
      const orphanTables = [...document.querySelectorAll('.vp-doc table')]
        .filter((table) => !table.closest('.kpo-content-block--table'))
        .map((table) =>
          String(table.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120)
        )

      const unresolvedTables = [...document.querySelectorAll('.kpo-content-block--table')]
        .filter((block) => {
          return (
            !block.classList.contains('kpo-table--fit') &&
            !block.classList.contains('kpo-table--wrap') &&
            !block.classList.contains('kpo-table--scroll')
          )
        })
        .map((block) =>
          String(block.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120)
        )

      return { orphanTables, unresolvedTables }
    })

    expect(result, route).toEqual({
      orphanTables: [],
      unresolvedTables: []
    })
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('markdown tables wrap before falling back to local scroll on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await waitForAdaptiveTables(page)

  const states = await getAdaptiveTableStates(page)
  const wrapped = states.filter((state) => state.mode === 'wrap')

  expect(states.length).toBeGreaterThan(0)
  expect(wrapped.length, JSON.stringify(states, null, 2)).toBeGreaterThan(0)

  for (const state of wrapped) {
    expect(state.display).toBe('table')
    expect(state.tableLayout).toBe('fixed')
    expect(state.cellOverflowWrap).toBe('anywhere')
    expect(state.hasLocalScroll, JSON.stringify(state)).toBe(false)
    expect(state.blockScrollWidth).toBeLessThanOrEqual(
      state.blockClientWidth + CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
    )
  }

  for (const state of states) {
    expect(['auto', 'scroll']).toContain(state.blockOverflowX)
    expect(state.right).toBeLessThanOrEqual(state.viewport)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('dense markdown tables keep overflow local after wrap is not readable', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await waitForAdaptiveTables(page)

  const states = await getAdaptiveTableStates(page)
  const dense = states.filter((state) => state.mode === 'scroll')

  expect(dense.length, JSON.stringify(states, null, 2)).toBeGreaterThan(0)

  for (const state of dense) {
    expect(state.display).toBe('table')
    expect(state.tableLayout).toBe('auto')
    expect(state.hasLocalScroll, JSON.stringify(state)).toBe(true)
    expect(state.columnCount * CONTENT_LAYOUT_TOKENS.tableDenseMinColumnWidth).toBeGreaterThan(
      state.blockClientWidth
    )
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('markdown tables preserve native table display in every adaptive mode', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await waitForAdaptiveTables(page)

  const states = await getAdaptiveTableStates(page)

  expect(states.length).toBeGreaterThan(0)
  for (const state of states) {
    expect(state.mode).not.toBe('none')
    expect(state.display).toBe('table')
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('wide mermaid diagrams keep readable size and scroll locally on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  let checkedWideDiagrams = 0

  for (const route of [UI_FIXTURE_ROUTE]) {
    await page.goto(route)
    await waitForMermaid(page, { requireDiagrams: true })

    const metrics = await getMermaidMetrics(page)
    const wide = metrics.filter((item) => item.viewBoxWidth > item.containerClientWidth)

    checkedWideDiagrams += wide.length

    for (const item of wide) {
      expect(item.scaleX).toBeLessThanOrEqual(1 + SCALE_TOLERANCE)
      expect(item.scaleX).toBeGreaterThanOrEqual(CONTENT_LAYOUT_TOKENS.mermaidMobileMinScale - 0.01)
      if (item.scaleX < 1 - SCALE_TOLERANCE) {
        expect(item.svgHeight).toBeGreaterThanOrEqual(MIN_READABLE_MERMAID_HEIGHT_PX)
      }
      expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
      if (item.svgWidth > item.containerClientWidth + 1) {
        expect(item.hasLocalXScroll).toBe(true)
      }
    }

    await expectNoPageOverflowFromVpDoc(page)
  }

  expect(checkedWideDiagrams).toBeGreaterThan(0)
})

test('LSP MathJax formula fits the mobile tip block without local scroll', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto('lectures/01#lsp')
  await page.locator('#lsp').waitFor()

  const metrics = await page.evaluate(() => {
    const lsp = document.querySelector('#lsp')
    let node = lsp?.nextElementSibling ?? null
    let tip: Element | null = null

    while (node && node.tagName !== 'H2') {
      if (node.matches('.tip.custom-block')) {
        tip = node
        break
      }
      node = node.nextElementSibling
    }

    const math = tip?.querySelector('mjx-container.MathJax') as HTMLElement | null
    const tipElement = tip as HTMLElement | null
    const tipRect = tipElement?.getBoundingClientRect()

    return {
      hasTip: Boolean(tipElement),
      hasMath: Boolean(math),
      rawDollarMath: tipElement?.innerText.includes('$$') ?? true,
      mathScrollWidth: math?.scrollWidth ?? 0,
      mathClientWidth: math?.clientWidth ?? 0,
      tipRight: Math.round(tipRect?.right ?? 0),
      viewport: document.documentElement.clientWidth
    }
  })

  expect(metrics.hasTip).toBe(true)
  expect(metrics.hasMath).toBe(true)
  expect(metrics.rawDollarMath).toBe(false)
  expect(metrics.mathScrollWidth).toBeLessThanOrEqual(metrics.mathClientWidth + 1)
  expect(metrics.tipRight).toBeLessThanOrEqual(metrics.viewport)
  await expectNoPageOverflowFromVpDoc(page)
})

test('special content elements are viewport-contained on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  const cases = [
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-content-block--table' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-mermaid' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-switcher' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-playground', playground: true },
    { route: UI_FIXTURE_ROUTE, selector: '.custom-block' },
    { route: UI_FIXTURE_ROUTE, selector: '.vp-doc blockquote' },
    { route: UI_FIXTURE_ROUTE, selector: '.vp-doc img' },
    { route: UI_FIXTURE_ROUTE, selector: '.vp-doc code:not(pre code)' },
    { route: UI_FIXTURE_ROUTE, selector: '.kpo-content-block--code' },
    { route: UI_FIXTURE_ROUTE, selector: '.vp-doc h1, .vp-doc h2, .vp-doc h3' }
  ] as const

  for (const item of cases) {
    await page.goto(item.route)
    await page.evaluate(() => localStorage.clear())

    if ('playground' in item && item.playground) {
      await page.evaluate(() => localStorage.setItem('kpo:playground-mode', '1'))
      await page.reload()
    }

    await waitForMermaid(page, { requireDiagrams: true })

    if ('playground' in item && item.playground) {
      await page.locator('.kpo-switcher').first().getByRole('tab', { name: 'Kotlin' }).click()
    }

    await expect.poll(async () => page.locator(item.selector).count()).toBeGreaterThan(0)
    await expectNoPageOverflowFromVpDoc(page)
  }
})
