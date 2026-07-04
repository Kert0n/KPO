import { expect, test, type Locator, type Page } from '@playwright/test'

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

test('code switchers without author defaults follow the latest global language', async ({ page }) => {
  await clearStorage(page)
  await page.goto('lectures/02')

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  await switchers.nth(0).getByRole('tab', { name: 'Java' }).click()

  await expectActiveTab(switchers.nth(0), 'Java')
  await expectActiveTab(switchers.nth(1), 'Java')
  await expectActiveTab(switchers.nth(2), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()

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

  await switcher.getByRole('tab', { name: 'Kotlin' }).click()

  await expectActiveTab(switcher, 'Kotlin')
  await expect(page.locator('.kpo-playground')).toHaveCount(1)
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
  await page.setViewportSize({ width: 414, height: 896 })
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
})

test('last updated footer uses european date with AM PM time', async ({ page }) => {
  await page.goto('lectures/02')

  await expect(page.locator('.VPLastUpdated')).toContainText(
    /Обновлено:\s+\d{2}\.\d{2}\.\d{2},\s+\d{2}:\d{2}\s+(AM|PM)/
  )
})

test('hidden sidebar expands wide content lane but keeps prose narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('lectures/02')
  await waitForMermaid(page)

  const open = await measureWideLane(page)
  const beforeUrl = page.url()

  await hideSidebar(page)

  const hidden = await measureWideLane(page)

  await expect(page).toHaveURL(beforeUrl)
  expect(hidden.contentContainerWidth).toBeGreaterThan(open.contentContainerWidth + 200)
  expect(hidden.mermaidWideBlockWidth).toBeGreaterThan(open.mermaidWideBlockWidth + 200)
  expect(hidden.paragraphWidth).toBeLessThanOrEqual(700)
  await expectNoPageOverflowFromVpDoc(page)
})

test('moderately wide mermaid diagrams fit the expanded lane when sidebar is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('lectures/02')
  await waitForMermaid(page)
  const openMetrics = await getMermaidMetrics(page)

  await hideSidebar(page)

  const hiddenMetrics = await getMermaidMetrics(page)
  const fitted = hiddenMetrics.filter((item) => {
    return openMetrics[item.index]?.hasLocalXScroll && !item.hasLocalXScroll
  })

  expect(fitted.length).toBeGreaterThan(0)

  for (const item of fitted) {
    expect(item.hasLocalXScroll).toBe(false)
    expect(item.svgWidth).toBeLessThanOrEqual(item.containerClientWidth + 1)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(0.05)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('very wide mermaid diagrams stay readable and scroll locally on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('lectures/02')
  await waitForMermaid(page)
  await hideSidebar(page)

  const metrics = await getMermaidMetrics(page)
  const veryWide = metrics.filter((item) => {
    return item.viewBoxWidth > item.containerClientWidth / 0.72
  })

  expect(veryWide.length).toBeGreaterThan(0)

  for (const item of veryWide) {
    expect(item.scaleX).toBeGreaterThanOrEqual(0.71)
    expect(item.svgHeight).toBeGreaterThanOrEqual(120)
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(0.05)
    expect(item.hasLocalXScroll).toBe(true)
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('mermaid zoom controls adjust scale without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
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

  const zoomedWidth = await width()
  await diagram.getByRole('button', { name: 'Уменьшить диаграмму' }).click()
  await expect.poll(width).toBeLessThan(zoomedWidth)

  await diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' }).click()
  await expect.poll(width).toBeCloseTo(autoWidth, 0)

  await expectNoPageOverflowFromVpDoc(page)
})

test('wide elements use the expanded lane when sidebar is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  const cases = [
    { route: 'lectures/02', selector: '.kpo-wide-block--mermaid' },
    { route: 'lectures/02', selector: '.kpo-wide-block--code' },
    { route: 'lectures/12', selector: '.vp-doc table' },
    { route: 'lectures/13', selector: '.vp-doc div[class*="language-"]' },
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
  await page.setViewportSize({ width: 414, height: 896 })

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
  await page.setViewportSize({ width: 414, height: 896 })

  for (const route of ['lectures/12', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)

    const states = await page.locator('.vp-doc table').evaluateAll((nodes) => {
      return nodes.map((node) => {
        const table = node as HTMLElement
        const rect = table.getBoundingClientRect()
        const style = getComputedStyle(table)
        return {
          display: style.display,
          overflowX: style.overflowX,
          right: Math.round(rect.right),
          viewport: document.documentElement.clientWidth,
          hasLocalScroll: table.scrollWidth > table.clientWidth + 1
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
  await page.setViewportSize({ width: 414, height: 896 })

  for (const route of ['lectures/02', 'lectures/11', 'lectures/14']) {
    await page.goto(route)
    await waitForMermaid(page)

    const metrics = await getMermaidMetrics(page)
    const wide = metrics.filter((item) => item.viewBoxWidth > item.containerClientWidth)

    expect(wide.length).toBeGreaterThan(0)

    for (const item of wide) {
      expect(item.svgWidth).toBeGreaterThanOrEqual(680)
      expect(item.svgHeight).toBeGreaterThanOrEqual(120)
      expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(0.05)
      expect(item.hasLocalXScroll).toBe(true)
    }

    await expectNoPageOverflowFromVpDoc(page)
  }
})

test('special content elements are viewport-contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 })

  const cases = [
    { route: 'lectures/12', selector: '.vp-doc table' },
    { route: 'lectures/13', selector: '.kpo-mermaid' },
    { route: 'lectures/02', selector: '.kpo-switcher' },
    { route: 'extras/01', selector: '.kpo-playground', playground: true },
    { route: 'lectures/02', selector: '.custom-block' },
    { route: 'intro', selector: '.vp-doc blockquote' },
    { route: 'lectures/02', selector: '.vp-doc img' },
    { route: 'extras/01', selector: '.vp-doc code:not(pre code)' },
    { route: 'lectures/13', selector: '.vp-doc div[class*="language-"]' },
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
