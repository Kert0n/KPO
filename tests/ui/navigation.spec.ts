import { expect, test } from './fixtures'
import {
  CENTER_TOLERANCE_PX,
  CONTENT_LAYOUT_TOKENS,
  DESKTOP_PROSE_TOLERANCE_PX,
  LAYOUT_VIEWPORTS,
  UI_FIXTURE_ROUTE,
  expectCenteredAgainstPage,
  expectNoPageOverflowFromVpDoc,
  hideSidebar,
  measureWideLane,
  resetComponentStorage,
  waitForMermaid
} from './helpers/kpoTestSupport'

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

test('tablet navbar has correct element ordering', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

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
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

  const search = page.locator('.VPNavBar .VPNavBarSearch')
  const flexGrow = await search.evaluate((n) => getComputedStyle(n).flexGrow)
  const paddingLeft = await search.evaluate((n) => getComputedStyle(n).paddingLeft)

  expect(flexGrow).toBe('0')
  expect(paddingLeft).toBe('0px')
})

test('tablet DocSearch button uses KPO compact styling', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

  const btn = page.locator('.VPNavBar .DocSearch-Button')
  const height = await btn.evaluate((n) => getComputedStyle(n).height)
  const borderRadius = await btn.evaluate((n) => getComputedStyle(n).borderRadius)
  const width = await btn.evaluate((n) => getComputedStyle(n).width)

  expect(parseInt(height)).toBe(28)
  expect(borderRadius).toBe('6px')
  expect(width).not.toBe(`${LAYOUT_VIEWPORTS.tablet.width}px`)
})

test('tablet nav links have KPO styling', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

  const link = page.locator('.VPNavBar .VPNavBarMenuLink').first()
  const fontSize = await link.evaluate((n) => getComputedStyle(n).fontSize)
  const fontWeight = await link.evaluate((n) => getComputedStyle(n).fontWeight)

  expect(fontSize).toBe('14px')
  expect(Number(fontWeight)).toBeGreaterThanOrEqual(650)
})

test('tablet hides native VPNavBarExtra and hamburger', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.tablet)
  await page.goto(UI_FIXTURE_ROUTE)

  await expect(page.locator('.VPNavBar .VPNavBarExtra.extra')).toBeHidden()
  await expect(page.locator('.VPNavBar .VPNavBarHamburger')).toBeHidden()
  await expect(page.locator('.VPNavBar .KpoNavBarExtra')).toBeVisible()
})
