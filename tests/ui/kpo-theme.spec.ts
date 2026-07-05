import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONTENT_LAYOUT_TOKENS, LAYOUT_VIEWPORTS } from '../../.vitepress/theme/lib/contentLayoutTokens'

const CENTER_TOLERANCE_PX = 2
const SCALE_TOLERANCE = 0.05
const ANCHOR_TOLERANCE_PX = 4
const DESKTOP_PROSE_TOLERANCE_PX = 12
const MIN_READABLE_MERMAID_HEIGHT_PX = CONTENT_LAYOUT_TOKENS.mermaidMinHeight

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

async function waitForMermaid(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
    return diagrams.every((diagram) => {
      return diagram.querySelector('svg') || diagram.querySelector('.kpo-mermaid__error')
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
          text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
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

async function getMermaidMetrics(page: Page): Promise<Array<{
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
  hasLocalYScroll: boolean
}>> {
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
        hasLocalXScroll: element.scrollWidth > element.clientWidth + 1,
        hasLocalYScroll: element.scrollHeight > element.clientHeight + 1
      }
    })
  })
}

async function hideSidebar(page: Page): Promise<void> {
  const html = page.locator('html')
  const isHidden = await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
  if (!isHidden) {
    await page.locator('.kpo-sidebar-toggle').click()
    await expect.poll(async () => {
      return html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
    }).toBe(true)
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
  return page.locator(selector).first().evaluate((node) => {
    return Math.round(node.getBoundingClientRect().width)
  })
}

async function measureViewportRelativeTo(locator: Locator): Promise<number> {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return Math.round(window.scrollY - (rect.top + window.scrollY))
  })
}

async function expectViewportAnchorStable(
  before: number,
  after: number,
  tolerance = ANCHOR_TOLERANCE_PX
): Promise<void> {
  expect(Math.abs(after - before)).toBeLessThanOrEqual(tolerance)
}

async function expectCenteredAgainstPage(page: Page, locator: Locator): Promise<void> {
  const result = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return {
      centerDelta: Math.abs((rect.left + rect.right) / 2 - document.documentElement.clientWidth / 2),
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth
    }
  })

  expect(result.centerDelta, JSON.stringify(result)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  expect(result.left).toBeGreaterThanOrEqual(-CENTER_TOLERANCE_PX)
  expect(result.right).toBeLessThanOrEqual(result.viewport + CENTER_TOLERANCE_PX)
}

test('code switchers without author defaults follow the latest global language', async ({ page }) => {
  await clearStorage(page)
  await page.goto('lectures/02')
  await waitForMermaid(page)
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

test('author default beats restored language until that block is clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto('extras/01')

  const switcher = page.locator('.kpo-switcher').first()
  await expectActiveTab(switcher, 'Go')
  await expect(page.locator('.kpo-playground')).toHaveCount(0)
  await expectNoPageOverflowFromVpDoc(page)

  await switcher.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switcher, 'Kotlin')
  await expect(page.locator('.kpo-playground')).toHaveCount(1)
  await expectNoPageOverflowFromVpDoc(page)
})

test('lecture 13 renders mermaid and keeps playground disabled for marked blocks', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto('lectures/13')

  await waitForMermaid(page)

  await expect(page.locator('.kpo-mermaid__error')).toHaveCount(0)
  await expect(page.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
  await expect(page.locator('.kpo-playground')).toHaveCount(0)
})

test('lecture 02 mobile layout has no pdf text code overflow', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await clearStorage(page)
  await page.goto('lectures/02')
  await waitForMermaid(page)

  await expect(page.locator('.language-text').filter({
    hasText: 'Пример функционального тестирования'
  })).toHaveCount(0)

  await expectNoPageOverflowFromVpDoc(page)
})

test('sidebar toggle does not navigate away from the current page', async ({ page }) => {
  await page.goto('lectures/13')

  const beforeUrl = page.url()
  const html = page.locator('html')
  const wasHidden = await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))

  await page.locator('.kpo-sidebar-toggle').click()

  await expect(page).toHaveURL(beforeUrl)
  await expect.poll(async () => {
    return html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
  }).toBe(!wasHidden)
  await expectNoPageOverflowFromVpDoc(page)
})

test('last updated footer uses european date with AM PM time', async ({ page }) => {
  await page.goto('lectures/02')

  await expect(page.locator('.VPLastUpdated')).toContainText(
    /Обновлено:\s+\d{2}\.\d{2}\.\d{2},\s+\d{2}:\d{2}\s+(AM|PM)/
  )
})

test('hidden sidebar expands wide content lane but keeps prose narrow', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto('lectures/02')
  await waitForMermaid(page)

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

test('moderately wide mermaid diagrams fit the expanded lane when sidebar is hidden', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  const fitted = []

  for (const route of ['lectures/02', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)
    const openMetrics = await getMermaidMetrics(page)

    await hideSidebar(page)
    await expectNoPageOverflowFromVpDoc(page)

    const hiddenMetrics = await getMermaidMetrics(page)
    fitted.push(...hiddenMetrics.filter((item) => {
      return openMetrics[item.index]?.hasLocalXScroll && !item.hasLocalXScroll
    }))
  }

  expect(fitted.length).toBeGreaterThan(0)

  for (const item of fitted) {
    expect(item.hasLocalXScroll).toBe(false)
    expect(item.svgWidth).toBeLessThanOrEqual(item.containerClientWidth + 1)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('small mermaid diagrams are not auto-upscaled on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto('lectures/01')
  await expect.poll(async () => page.locator('.kpo-mermaid').count()).toBeGreaterThan(0)
  await waitForMermaid(page)

  const metrics = await getMermaidMetrics(page)
  expect(metrics.length).toBeGreaterThan(0)

  for (const item of metrics) {
    expect(item.scaleX, JSON.stringify(item)).toBeLessThanOrEqual(1 + SCALE_TOLERANCE)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('very wide mermaid diagrams stay readable and scroll locally on desktop', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto('lectures/02')
  await waitForMermaid(page)
  await hideSidebar(page)
  await expectNoPageOverflowFromVpDoc(page)

  const metrics = await getMermaidMetrics(page)
  const veryWide = metrics.filter((item) => {
    return item.viewBoxWidth > item.containerClientWidth / CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale
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

test('hidden sidebar enters focused-wide mode and removes the outline from layout', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto('lectures/14')
  await hideSidebar(page)

  const state = await page.evaluate(() => {
    const aside = document.querySelector('.VPDoc.has-aside > .container > .aside')
    const contentContainer = document.querySelector('.VPDoc.has-aside > .container > .content > .content-container')
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
  await page.goto('lectures/02')
  await waitForMermaid(page)

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

test('theme switch does not create page overflow or rely on global overflow masking', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto('lectures/01')
  await waitForMermaid(page)

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

test('language click preserves viewport position inside the interacted code block', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto('lectures/02')
  await waitForMermaid(page)

  const switcher = page.locator('.kpo-switcher').nth(1)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 260))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('tab', { name: 'Java' }).click()
  await page.waitForTimeout(150)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('keyboard language switch preserves viewport position inside the interacted code block', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto('lectures/02')
  await waitForMermaid(page)

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

test('playground toggle preserves viewport position inside the interacted code block', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await clearStorage(page)
  await page.goto('lectures/02')
  await waitForMermaid(page)

  const switcher = page.locator('.kpo-switcher').nth(1)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 260))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('button', { name: /Playground/ }).click()
  await page.waitForTimeout(250)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('overflowing mermaid diagrams start centered in their local viewport', async ({ page }) => {
  for (const viewport of [
    LAYOUT_VIEWPORTS.mobilePhone,
    LAYOUT_VIEWPORTS.narrowDesktop
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('lectures/02')
    await waitForMermaid(page)

    await expect.poll(async () => {
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
    }).toBe(true)

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('manual mermaid scroll is preserved across zoom and reset recenters', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto('lectures/02')
  await waitForMermaid(page)

  const diagram = page.locator('.kpo-mermaid').filter({
    has: page.locator('.kpo-mermaid__viewport')
  }).first()
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
  await page.goto('lectures/02')
  await waitForMermaid(page)
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
  await page.goto('lectures/02')
  await waitForMermaid(page)

  const overflowing = page.locator('.kpo-mermaid--has-overflow').first()
  await expect(overflowing.locator('.kpo-mermaid__toolbar')).toHaveCSS('opacity', '1')
  await expectNoPageOverflowFromVpDoc(page)
})

test('mermaid dark theme keeps label colors readable and token-based', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await page.goto('lectures/01')
  await waitForMermaid(page)

  const isDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'))
  if (!isDark) {
    await page.locator('.VPSwitchAppearance').first().click()
  }
  await expect.poll(async () => {
    return page.locator('html').evaluate((node) => node.classList.contains('dark'))
  }).toBe(true)
  await page.waitForTimeout(500)

  const result = await page.evaluate(() => {
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
    const pageText = rootStyle.getPropertyValue('--vp-c-text-1').trim()
    const labels = [...document.querySelectorAll('.kpo-mermaid svg .nodeLabel, .kpo-mermaid svg .edgeLabel span')]
      .map((node) => {
        const style = getComputedStyle(node)
        return {
          color: style.color,
          background: style.backgroundColor,
          contrast: contrast(style.color, style.backgroundColor === 'rgba(0, 0, 0, 0)'
            ? pageBackground
            : style.backgroundColor)
        }
      })

    return {
      labels,
      pageBackground,
      pageText
    }
  })

  expect(result.labels.length).toBeGreaterThan(0)
  for (const label of result.labels) {
    expect(label.contrast).toBeGreaterThanOrEqual(4.5)
    expect(label.color).not.toBe('rgb(0, 0, 0)')
  }
  await expectNoPageOverflowFromVpDoc(page)
})

test('mermaid text and foreignObject labels are not clipped', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  for (const route of ['lectures/01', 'lectures/02', 'lectures/03', 'lectures/11', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)

    const issues = await page.evaluate(() => {
      return [...document.querySelectorAll('.kpo-mermaid svg')].flatMap((svg, diagramIndex) => {
        const svgIssues: Array<{ diagramIndex: number; reason: string; text: string }> = []
        const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number) ?? []
        const [, , viewWidth, viewHeight] = viewBox

        for (const node of [...svg.querySelectorAll('foreignObject')]) {
          const child = node.firstElementChild
          if (!child) continue

          const containerRect = node.getBoundingClientRect()
          const childRect = child.getBoundingClientRect()
          const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
          if (childRect.width > containerRect.width + 2) {
            svgIssues.push({ diagramIndex, reason: 'foreignObject-x', text })
          }
          if (childRect.height > containerRect.height + 2) {
            svgIssues.push({ diagramIndex, reason: 'foreignObject-y', text })
          }
        }

        if (Number.isFinite(viewWidth) && Number.isFinite(viewHeight)) {
          try {
            const box = (svg as SVGSVGElement).getBBox()
            if (box.x < -2 || box.y < -2 || box.x + box.width > viewWidth + 2 || box.y + box.height > viewHeight + 2) {
              svgIssues.push({ diagramIndex, reason: 'svg-viewbox', text: '' })
            }
          } catch {
            // Some SVG fragments may not expose getBBox while hidden during route changes.
          }
        }

        return svgIssues
      })
    })

    expect(issues, JSON.stringify({ route, issues }, null, 2)).toEqual([])
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('wide tables are centered in the hidden-sidebar wide lane', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  for (const route of ['lectures/12', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)
    await hideSidebar(page)

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
  }
})

test('wide elements use the expanded lane when sidebar is hidden', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  const cases = [
    { route: 'lectures/02', selector: '.kpo-wide-block--mermaid' },
    { route: 'lectures/02', selector: '.kpo-wide-block--code' },
    { route: 'lectures/12', selector: '.kpo-content-block--table' },
    { route: 'lectures/13', selector: '.kpo-content-block--code' },
    { route: 'lectures/02', selector: '.vp-doc p:has(> img:only-child)' },
    { route: 'extras/01', selector: '.kpo-playground', playground: true }
  ] as const

  for (const item of cases) {
    await page.goto(item.route)
    await waitForMermaid(page)

    if (item.playground) {
      await page.evaluate(() => localStorage.setItem('kpo:playground-mode', '1'))
      await page.reload()
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

  for (const route of [
    'intro',
    'lectures/01',
    'lectures/02',
    'lectures/03',
    'lectures/04',
    'lectures/05',
    'lectures/06',
    'lectures/07',
    'lectures/08',
    'lectures/09',
    'lectures/10',
    'lectures/11',
    'lectures/12',
    'lectures/13',
    'lectures/14',
    'extras/',
    'extras/01',
    'extras/02',
    'conclusion'
  ]) {
    await page.goto(route)
    await waitForMermaid(page)
    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('wide markdown tables scroll locally on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  for (const route of ['lectures/12', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)

    const states = await page.locator('.kpo-content-block--table').evaluateAll((nodes) => {
      return nodes.map((node) => {
        const block = node as HTMLElement
        const rect = block.getBoundingClientRect()
        const style = getComputedStyle(block)
        return {
          display: style.display,
          overflowX: style.overflowX,
          right: Math.round(rect.right),
          viewport: document.documentElement.clientWidth,
          hasLocalScroll: block.scrollWidth > block.clientWidth + 1
        }
      })
    })

    expect(states.length).toBeGreaterThan(0)

    for (const state of states) {
      expect(state.display).toBe('block')
      expect(['auto', 'scroll']).toContain(state.overflowX)
      expect(state.right).toBeLessThanOrEqual(state.viewport)
    }

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('wide mermaid diagrams keep readable size and scroll locally on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  let checkedWideDiagrams = 0

  for (const route of ['lectures/02', 'lectures/11', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)

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

test('special content elements are viewport-contained on mobile', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)

  const cases = [
    { route: 'lectures/12', selector: '.kpo-content-block--table' },
    { route: 'lectures/13', selector: '.kpo-mermaid' },
    { route: 'lectures/02', selector: '.kpo-switcher' },
    { route: 'extras/01', selector: '.kpo-playground', playground: true },
    { route: 'lectures/02', selector: '.custom-block' },
    { route: 'intro', selector: '.vp-doc blockquote' },
    { route: 'lectures/02', selector: '.vp-doc img' },
    { route: 'extras/01', selector: '.vp-doc code:not(pre code)' },
    { route: 'lectures/13', selector: '.kpo-content-block--code' },
    { route: 'lectures/14', selector: '.vp-doc h1, .vp-doc h2, .vp-doc h3' }
  ] as const

  for (const item of cases) {
    await page.goto(item.route)
    await page.evaluate(() => localStorage.clear())

    if (item.playground) {
      await page.evaluate(() => localStorage.setItem('kpo:playground-mode', '1'))
      await page.reload()
    }

    await waitForMermaid(page)

    if (item.playground) {
      await page.locator('.kpo-switcher').first().getByRole('tab', { name: 'Kotlin' }).click()
    }

    await expect.poll(async () => page.locator(item.selector).count()).toBeGreaterThan(0)
    await expectNoPageOverflowFromVpDoc(page)
  }
})
