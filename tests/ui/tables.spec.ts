import { expect, test } from './fixtures'
import {
  CENTER_TOLERANCE_PX,
  CONTENT_LAYOUT_TOKENS,
  LAYOUT_VIEWPORTS,
  SIDEBAR_FIXTURE_ROUTE,
  UI_FIXTURE_ROUTE,
  expectNoPageOverflowFromVpDoc,
  getAdaptiveTableStates,
  hideSidebar,
  waitForAdaptiveTables,
  waitForMermaid
} from './helpers/kpoTestSupport'

test('wide tables are centered in the hidden-sidebar wide lane', async ({ page }) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)

  await page.goto(SIDEBAR_FIXTURE_ROUTE)
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
