import { expect, type Locator, type Page } from '@playwright/test'

import {
  CONTENT_LAYOUT_TOKENS,
  LAYOUT_VIEWPORTS
} from '../../../.vitepress/theme/lib/contentLayoutTokens'

import { openAskAiMenuWhenReady } from '../../helpers/askAi'

import {
  stubSelectionBoundaryAskAiContext,
  stubUiServiceAskAiContext
} from '../../helpers/serviceFixtures'

export {
  CONTENT_LAYOUT_TOKENS,
  LAYOUT_VIEWPORTS,
  openAskAiMenuWhenReady,
  stubSelectionBoundaryAskAiContext,
  stubUiServiceAskAiContext
}
export const CENTER_TOLERANCE_PX = 2
export const SCALE_TOLERANCE = 0.05
export const ANCHOR_TOLERANCE_PX = 4
export const DESKTOP_PROSE_TOLERANCE_PX = 12
export const MERMAID_FOREIGN_OBJECT_TOLERANCE_PX = 2
export const MERMAID_VIEWBOX_TOLERANCE_PX = 8
export const MIN_READABLE_MERMAID_HEIGHT_PX = CONTENT_LAYOUT_TOKENS.mermaidMinHeight
export const UI_FIXTURE_ROUTE = 'service-pages/ui-contract'
export const ASK_AI_FIXTURE_ROUTE = 'service-pages/ask-ai-contract'
export const PLAYGROUND_MODULE_REQUEST =
  /(?:kotlin-playground|playground\.min\.[^/]+\.js)(?:\?.*)?$/
export const SELECTION_TERMINAL_TEXT =
  'Terminal boundary paragraph belongs only to the learning content and must open Ask AI when selected fully.'
export const SELECTION_FIRST_TEXT =
  'First boundary paragraph starts inside the learning content and must survive a range that begins before the document.'
export const SELECTION_NESTED_TEXT =
  'Nested boundary phrase combines bold boundary text and inline boundary code inside one paragraph.'
export const SELECTION_MIDDLE_TEXT =
  'Middle boundary paragraph keeps enough ordinary text between the first and terminal paragraphs for block ordering checks.'
export const COMPONENT_STORAGE_BASELINE = {
  'kpo:playground-mode': '0',
  'kpo:code-language': 'kotlin',
  'kpo:ask-ai-provider': 'chatgpt'
} as const
export type AdaptiveTableMode = 'fit' | 'wrap' | 'scroll'
export async function resetComponentStorage(page: Page): Promise<void> {
  await writeStorage(page, COMPONENT_STORAGE_BASELINE)
}
export async function setStorage(page: Page, entries: Record<string, string>): Promise<void> {
  await writeStorage(page, { ...COMPONENT_STORAGE_BASELINE, ...entries })
}

async function writeStorage(page: Page, values: Record<string, string>): Promise<void> {
  const write = (entries: Record<string, string>) => {
    localStorage.clear()
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
  }
  if (page.url() === 'about:blank') {
    await page.addInitScript(write, values)
  } else {
    await page.evaluate(write, values)
  }
}
export async function expectActiveTab(switcher: Locator, language: string): Promise<void> {
  await expect(switcher.locator('.kpo-switcher__tab--active')).toHaveText(language)
}
export async function searchFor(page: Page, query: string): Promise<void> {
  await page.locator('.DocSearch-Button').first().click()
  const input = page.locator('.VPLocalSearchBox .search-input')
  await input.fill(query)
  await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible()
}
export async function waitForMermaid(
  page: Page,
  options: { requireDiagrams?: boolean } = {}
): Promise<void> {
  await page.locator('.vp-doc').first().waitFor({ state: 'attached' })

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
}
export async function waitForAdaptiveTables(page: Page): Promise<void> {
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
}
export async function expectNoPageOverflowFromVpDoc(page: Page): Promise<void> {
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
export async function getAdaptiveTableStates(page: Page): Promise<
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
export async function expectNoGlobalOverflowMask(page: Page): Promise<void> {
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
export async function getMermaidMetrics(page: Page): Promise<
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
export type MermaidLabelContrast = {
  color: string
  background: string
  contrast: number
}
export type MermaidThemeSyncIssue = {
  diagramIndex: number
  selector: string
  property: string
  actual: string
  expected: string
}
export async function getMermaidLabelContrasts(page: Page): Promise<MermaidLabelContrast[]> {
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
export async function expectMermaidThemeSynchronized(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const issues = await page.evaluate(() => {
        function normalizeColor(value: string): string {
          const probe = document.createElement('span')
          probe.style.color = value.trim()
          document.body.append(probe)
          const normalized = getComputedStyle(probe).color
          probe.remove()
          return normalized
        }

        function cssColor(style: CSSStyleDeclaration, property: string): string {
          return normalizeColor(style.getPropertyValue(property))
        }

        function computedColor(element: Element, property: 'backgroundColor' | 'color'): string {
          return normalizeColor(getComputedStyle(element)[property])
        }

        function computedSvgColor(element: Element, property: 'fill' | 'stroke'): string {
          return normalizeColor(getComputedStyle(element)[property])
        }

        function addIssue(
          list: MermaidThemeSyncIssue[],
          diagramIndex: number,
          selector: string,
          property: string,
          actual: string,
          expected: string
        ): void {
          if (actual === expected) return
          list.push({ diagramIndex, selector, property, actual, expected })
        }

        const rootStyle = getComputedStyle(document.documentElement)
        const tokens = {
          background: cssColor(rootStyle, '--vp-c-bg'),
          softBackground: cssColor(rootStyle, '--vp-c-bg-soft'),
          text: cssColor(rootStyle, '--vp-c-text-1'),
          mutedText: cssColor(rootStyle, '--vp-c-text-2'),
          border: cssColor(rootStyle, '--vp-c-border')
        }
        const issues: MermaidThemeSyncIssue[] = []
        const diagrams = [...document.querySelectorAll('.kpo-mermaid svg')]

        if (diagrams.length === 0) {
          issues.push({
            diagramIndex: -1,
            selector: '.kpo-mermaid svg',
            property: 'count',
            actual: '0',
            expected: '>0'
          })
          return issues
        }

        for (const [diagramIndex, svg] of diagrams.entries()) {
          const edgeLabel = svg.querySelector('.edgeLabel span')
          const nodeLabel = svg.querySelector('.nodeLabel')
          const nodeShape = svg.querySelector(
            '.node rect, .node polygon, .node circle, .node ellipse'
          )
          const line = svg.querySelector('.edgePath path, .flowchart-link')

          if (!edgeLabel) {
            issues.push({
              diagramIndex,
              selector: '.edgeLabel span',
              property: 'presence',
              actual: 'missing',
              expected: 'present'
            })
          } else {
            addIssue(
              issues,
              diagramIndex,
              '.edgeLabel span',
              'background-color',
              computedColor(edgeLabel, 'backgroundColor'),
              tokens.background
            )
            addIssue(
              issues,
              diagramIndex,
              '.edgeLabel span',
              'color',
              computedColor(edgeLabel, 'color'),
              tokens.text
            )
          }

          if (!nodeLabel) {
            issues.push({
              diagramIndex,
              selector: '.nodeLabel',
              property: 'presence',
              actual: 'missing',
              expected: 'present'
            })
          } else {
            addIssue(
              issues,
              diagramIndex,
              '.nodeLabel',
              'color',
              computedColor(nodeLabel, 'color'),
              tokens.text
            )
          }

          if (!nodeShape) {
            issues.push({
              diagramIndex,
              selector: '.node rect, .node polygon, .node circle, .node ellipse',
              property: 'presence',
              actual: 'missing',
              expected: 'present'
            })
          } else {
            addIssue(
              issues,
              diagramIndex,
              '.node shape',
              'fill',
              computedSvgColor(nodeShape, 'fill'),
              tokens.background
            )
            addIssue(
              issues,
              diagramIndex,
              '.node shape',
              'stroke',
              computedSvgColor(nodeShape, 'stroke'),
              tokens.border
            )
          }

          if (!line) {
            issues.push({
              diagramIndex,
              selector: '.edgePath path, .flowchart-link',
              property: 'presence',
              actual: 'missing',
              expected: 'present'
            })
          } else {
            addIssue(
              issues,
              diagramIndex,
              '.edgePath path, .flowchart-link',
              'stroke',
              computedSvgColor(line, 'stroke'),
              tokens.mutedText
            )
          }
        }

        return issues
      })
      return JSON.stringify(issues)
    })
    .toBe('[]')
}
export type MermaidClipIssue = {
  diagramIndex: number
  reason: string
  text: string
}
export async function getMermaidClipIssues(page: Page): Promise<MermaidClipIssue[]> {
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
export async function hideSidebar(page: Page): Promise<void> {
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
  await page.locator('.VPSidebar').evaluate(async (sidebar) => {
    const durations = getComputedStyle(sidebar)
      .transitionDuration.split(',')
      .map((value) => Number.parseFloat(value) || 0)
    if (Math.max(...durations) === 0) return
    await new Promise<void>((resolve) => {
      sidebar.addEventListener('transitionend', () => resolve(), { once: true })
    })
  })
}
export async function measureWideLane(page: Page): Promise<{
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
export async function measureFirstWidth(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => {
      return Math.round(node.getBoundingClientRect().width)
    })
}
export async function measureViewportRelativeTo(locator: Locator): Promise<number> {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return Math.round(window.scrollY - (rect.top + window.scrollY))
  })
}
export async function waitForPageLayoutReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
}
export async function expectViewportAnchorStable(
  before: number,
  after: number,
  tolerance = ANCHOR_TOLERANCE_PX
): Promise<void> {
  expect(
    Math.abs(after - before),
    `viewport anchor moved from ${before}px to ${after}px`
  ).toBeLessThanOrEqual(tolerance)
}
export async function waitForScopedPlayground(switcher: Locator): Promise<void> {
  const playground = switcher.locator('.kpo-playground:visible')
  await expect(playground).toHaveClass(/kpo-playground--ready/, { timeout: 12_000 })
}
export async function expectViewportAnchorRestored(
  before: number,
  locator: Locator
): Promise<void> {
  await expect
    .poll(async () => Math.abs((await measureViewportRelativeTo(locator)) - before))
    .toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX)
}
export async function expectCenteredAgainstPage(page: Page, locator: Locator): Promise<void> {
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
export async function selectTextAndOpenAskAiMenu(
  page: Page,
  text: string,
  activate = false
): Promise<void> {
  await openAskAiMenuWhenReady(page, text, { activate })
}
export async function selectTextAndClickAskAiMenuItem(page: Page, text: string): Promise<void> {
  await selectTextAndOpenAskAiMenu(page, text, true)
}
export type SelectionBoundaryScenario =
  | 'terminal-inside'
  | 'terminal-after-content'
  | 'terminal-reverse'
  | 'before-content-to-first'
  | 'first-through-terminal'
  | 'terminal-through-footer'
  | 'pager-only'
  | 'collapsed-terminal'
  | 'whitespace-only'
  | 'nested-inline'
export async function dispatchAskAiBoundarySelection(
  page: Page,
  scenario: SelectionBoundaryScenario,
  options: { mobile?: boolean } = {}
): Promise<void> {
  await page.evaluate(
    ({ scenario, mobile, terminalText, firstText, nestedText }) => {
      function elementContaining(selector: string, text: string): HTMLElement {
        const element = [...document.querySelectorAll<HTMLElement>(selector)].find((node) =>
          node.textContent?.includes(text)
        )
        if (!element) throw new Error(`Missing element for text: ${text}`)
        return element
      }

      function textNodeContaining(root: Element, text: string): Text {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          if (node.nodeValue?.includes(text)) return node
        }
        throw new Error(`Missing text node for text: ${text}`)
      }

      function dispatchContextMenu(target: Element, range: Range): void {
        const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
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

      const content = document.querySelector<HTMLElement>('.vp-doc')
      if (!content) throw new Error('Missing .vp-doc')
      const terminal = elementContaining('.vp-doc p', terminalText)
      const first = elementContaining('.vp-doc p', firstText)
      const nested = elementContaining('.vp-doc p', nestedText)
      const footer = document.querySelector<HTMLElement>('.VPDocFooter')
      const whitespace = document.querySelector<HTMLElement>('#selection-whitespace')
      const selection = window.getSelection()
      if (!selection) throw new Error('Missing Selection API')

      const range = document.createRange()
      let target: Element = terminal

      if (scenario === 'terminal-inside') {
        range.selectNodeContents(terminal)
      } else if (scenario === 'terminal-after-content') {
        const node = textNodeContaining(terminal, terminalText)
        range.setStart(node, 0)
        range.setEndAfter(content)
      } else if (scenario === 'terminal-reverse') {
        const node = textNodeContaining(terminal, terminalText)
        selection.removeAllRanges()
        selection.setBaseAndExtent(node, node.length, node, 0)
        if (!mobile) dispatchContextMenu(terminal, selection.getRangeAt(0))
        else document.dispatchEvent(new Event('selectionchange'))
        return
      } else if (scenario === 'before-content-to-first') {
        const node = textNodeContaining(first, firstText)
        range.setStartBefore(content)
        range.setEnd(node, node.length)
        target = first
      } else if (scenario === 'first-through-terminal') {
        const firstNode = textNodeContaining(first, firstText)
        const terminalNode = textNodeContaining(terminal, terminalText)
        range.setStart(firstNode, 0)
        range.setEnd(terminalNode, terminalNode.length)
        target = first
      } else if (scenario === 'terminal-through-footer') {
        if (!footer) throw new Error('Missing footer')
        const node = textNodeContaining(terminal, terminalText)
        range.setStart(node, 0)
        range.setEndAfter(footer)
      } else if (scenario === 'pager-only') {
        if (!footer) throw new Error('Missing footer')
        range.selectNodeContents(footer)
        target = footer
      } else if (scenario === 'collapsed-terminal') {
        const node = textNodeContaining(terminal, terminalText)
        range.setStart(node, 0)
        range.collapse(true)
      } else if (scenario === 'whitespace-only') {
        if (!whitespace) throw new Error('Missing whitespace fixture')
        range.selectNodeContents(whitespace)
        target = whitespace
      } else {
        range.selectNodeContents(nested)
        target = nested
      }

      selection.removeAllRanges()
      selection.addRange(range)
      if (mobile) document.dispatchEvent(new Event('selectionchange'))
      else dispatchContextMenu(target, range)
    },
    {
      scenario,
      mobile: options.mobile ?? false,
      terminalText: SELECTION_TERMINAL_TEXT,
      firstText: SELECTION_FIRST_TEXT,
      nestedText: SELECTION_NESTED_TEXT
    }
  )
}
export async function waitForAskAiBoundaryFixture(page: Page): Promise<void> {
  await page.locator('.vp-doc [data-kpo-ask-block-id]').first().waitFor({ state: 'attached' })
  await page.locator('.KpoAskAiProvider').first().waitFor({ state: 'attached' })
  await waitForPageLayoutReady(page)
}
export async function mountAskAiBoundaryFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ firstText, middleText, nestedText, terminalText }) => {
      const content = document.querySelector<HTMLElement>('.vp-doc')
      if (!content) throw new Error('Missing .vp-doc')

      content.innerHTML = `
        <h1 data-kpo-ask-block-id="selection-heading">Selection Boundary Contract</h1>
        <p data-kpo-ask-block-id="selection-first">${firstText}</p>
        <p data-kpo-ask-block-id="selection-middle">${middleText}</p>
        <p data-kpo-ask-block-id="selection-nested">Nested boundary phrase combines <strong>bold boundary text</strong> and <code>inline boundary code</code> inside one paragraph.</p>
        <p data-kpo-ask-block-id="selection-whitespace-block">
          <span id="selection-whitespace">   </span>
        </p>
        <p data-kpo-ask-block-id="selection-terminal">${terminalText}</p>
      `

      const nested = content.querySelector<HTMLElement>(
        '[data-kpo-ask-block-id="selection-nested"]'
      )
      if (nested) nested.dataset.expectedText = nestedText
    },
    {
      firstText: SELECTION_FIRST_TEXT,
      middleText: SELECTION_MIDDLE_TEXT,
      nestedText: SELECTION_NESTED_TEXT,
      terminalText: SELECTION_TERMINAL_TEXT
    }
  )
}
export async function stubAskAiSideEffects(page: Page): Promise<void> {
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
export async function stubClipboardFailure(page: Page): Promise<void> {
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
}
export async function selectAskAiProviderDesktop(page: Page, providerLabel: string): Promise<void> {
  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  await expect(flyout.locator('.VPMenu')).toBeVisible()
  await flyout.locator('.KpoAskAiProviderMenu__item', { hasText: providerLabel }).click()
}
