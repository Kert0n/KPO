import { expect, test } from './fixtures'
import {
  CONTENT_LAYOUT_TOKENS,
  LAYOUT_VIEWPORTS,
  MIN_READABLE_MERMAID_HEIGHT_PX,
  SCALE_TOLERANCE,
  UI_FIXTURE_ROUTE,
  expectMermaidThemeSynchronized,
  expectNoPageOverflowFromVpDoc,
  getMermaidClipIssues,
  getMermaidLabelContrasts,
  getMermaidMetrics,
  hideSidebar,
  setStorage,
  waitForMermaid
} from './helpers/kpoTestSupport'

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

test('mermaid theme assertion rejects a deliberately corrupted label surface', async ({ page }) => {
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  const background = page.locator('.kpo-mermaid svg .edgeLabel .labelBkg').first()
  await expect(background).toBeAttached()
  await background.evaluate((element) => {
    ;(element as HTMLElement).style.setProperty('background-color', 'rgb(255, 0, 255)', 'important')
  })

  await expect(expectMermaidThemeSynchronized(page)).rejects.toThrow()
})

test('moderately wide mermaid diagrams fit the fixture content lane', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await hideSidebar(page)
  await expectNoPageOverflowFromVpDoc(page)

  const metrics = await getMermaidMetrics(page)
  const fitted = metrics.filter((item) => !item.hasLocalXScroll)

  expect(fitted.length, JSON.stringify({ metrics }, null, 2)).toBeGreaterThan(0)

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
    if (item.viewBoxHeight >= MIN_READABLE_MERMAID_HEIGHT_PX) {
      expect(item.svgHeight).toBeGreaterThanOrEqual(MIN_READABLE_MERMAID_HEIGHT_PX)
    } else {
      // Auto-layout never enlarges a naturally short diagram merely to meet the
      // minimum-height guard used while shrinking tall diagrams.
      expect(item.scaleY).toBeCloseTo(1, 2)
    }
    expect(Math.abs(item.scaleX - item.scaleY)).toBeLessThan(SCALE_TOLERANCE)
    expect(item.hasLocalXScroll).toBe(true)
  }

  await expectNoPageOverflowFromVpDoc(page)
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
  await expectNoPageOverflowFromVpDoc(page)

  await expect
    .poll(async () => {
      const ratioAfterZoom = await viewport.evaluate((node) => {
        const element = node as HTMLElement
        return (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
      })
      return Math.abs(ratioAfterZoom - ratioBefore) <= 0.03
    })
    .toBe(true)

  await diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expect
    .poll(async () => {
      return viewport.evaluate((node) => {
        const element = node as HTMLElement
        const expected = Math.round((element.scrollWidth - element.clientWidth) / 2)
        return Math.abs(Math.round(element.scrollLeft) - expected) <= 2
      })
    })
    .toBe(true)
})

test('rapid mermaid zoom resize and reset publish only the latest layout', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const diagram = page.locator('.kpo-mermaid--has-overflow').first()
  const viewport = diagram.locator('.kpo-mermaid__viewport')
  await diagram.evaluate((node) => {
    const buttons = [...node.querySelectorAll<HTMLButtonElement>('button')]
    const zoomIn = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Увеличить диаграмму'
    )
    const zoomOut = buttons.find(
      (button) => button.getAttribute('aria-label') === 'Уменьшить диаграмму'
    )
    zoomIn?.click()
    zoomIn?.click()
    zoomOut?.click()
  })
  await page.setViewportSize(LAYOUT_VIEWPORTS.narrowDesktop)
  await diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' }).click()

  await expect(diagram.getByRole('button', { name: 'Сбросить масштаб диаграммы' })).toBeDisabled()
  await expect
    .poll(async () => {
      return viewport.evaluate((node) => {
        const element = node as HTMLElement
        const expected = Math.round((element.scrollWidth - element.clientWidth) / 2)
        return Math.abs(Math.round(element.scrollLeft) - expected) <= 2
      })
    })
    .toBe(true)
  await expectNoPageOverflowFromVpDoc(page)
})

test('mermaid theme render preserves manual viewport ownership', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, { 'vitepress-theme-appearance': 'light' })
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const diagram = page.locator('.kpo-mermaid--has-overflow').first()
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

  await page.locator('.VPSwitchAppearance').first().click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)
  await expect
    .poll(async () => {
      const ratioAfter = await viewport.evaluate((node) => {
        const element = node as HTMLElement
        return (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
      })
      return Math.abs(ratioAfter - ratioBefore) <= 0.03
    })
    .toBe(true)
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
  await expectMermaidThemeSynchronized(page)

  const labels = await getMermaidLabelContrasts(page)

  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels) {
    expect(label.contrast).toBeGreaterThanOrEqual(4.5)
    expect(label.color).not.toBe('rgb(0, 0, 0)')
  }
  await expectNoPageOverflowFromVpDoc(page)
})

test('fixture mermaid theme transitions keep SVG tokens synchronized with site theme', async ({
  page
}) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      consoleErrors.push(`${message.text()} ${location.url}`)
    }
  })

  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, { 'vitepress-theme-appearance': 'light' })
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)

  await page.locator('.VPSwitchAppearance').first().click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)

  for (let index = 0; index < 20; index += 1) {
    await page.locator('.VPSwitchAppearance').first().click()
  }
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expectMermaidThemeSynchronized(page)
  await expectNoPageOverflowFromVpDoc(page)

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
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
